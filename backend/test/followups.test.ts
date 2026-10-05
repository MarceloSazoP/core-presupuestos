import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };

const iso = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d); // YYYY-MM-DD
};
const mes = () => iso(0).slice(0, 7);

describe('API: seguimiento comercial y dashboard (Contrato API §8, §11 y §14)', () => {
  before(async () => {
    await assertTestDb();
    await migrate(pool);
  });
  after(async () => {
    await resetDb();
    await pool.end();
  });
  beforeEach(async () => {
    await resetDb();
    app = await startApp();
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    b = await app.login('+56922222222', 'b@test.cl', 'Beto');
  });
  afterEach(async () => {
    await app.close();
  });

  const finalizado = async (token = a.token, precio = 10000) => {
    const q = (await app.api('POST', '/quotes', { token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
    await app.api('PATCH', `/quotes/${q.id}`, { token, body: { service_description: 'Servicio', validity_days: 15 } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token, body: { items: [{ description: 'x', quantity: 1, unit_price: precio }] } });
    assert.equal((await app.api('POST', `/quotes/${q.id}/finalize`, { token, body: {} })).status, 200);
    return q as { id: string; access_code: string };
  };
  const enviado = async (token = a.token, precio = 10000) => {
    const q = await finalizado(token, precio);
    await app.api('POST', `/quotes/${q.id}/mark-sent`, { token, body: { channel: 'WHATSAPP' } });
    return q;
  };
  const estado = (id: string, status: string, note?: string, token = a.token) => app.api('PUT', `/quotes/${id}/commercial-status`, { token, body: { status, ...(note && { note }) } });
  const seg = (id: string, body: object, token = a.token) => app.api('POST', `/quotes/${id}/follow-ups`, { token, body });
  const detalle = async (id: string) => (await app.api('GET', `/quotes/${id}`, { token: a.token })).json;

  it('el estado comercial solo existe tras enviar; cambia libremente entre los cuatro y nunca vuelve a NONE', async () => {
    const q = await finalizado();
    assert.equal((await estado(q.id, 'ACCEPTED')).status, 409, 'finalizado pero sin enviar');
    await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'LINK' } });
    for (const s of ['FOLLOW_UP', 'ACCEPTED', 'REJECTED', 'SENT', 'ACCEPTED', 'FOLLOW_UP']) assert.equal((await estado(q.id, s)).json.commercial_status, s, s);
    assert.equal((await estado(q.id, 'NONE')).status, 422);
    assert.equal((await estado(q.id, 'ACCEPTED', undefined)).status, 200);
    assert.equal((await app.api('PUT', `/quotes/${q.id}/commercial-status`, { token: a.token, body: { status: 'SENT', extra: 1 } })).status, 422);
  });

  it('aceptar fija accepted_at una vez; salir de ACCEPTED lo limpia; aceptar o rechazar limpia el próximo contacto', async () => {
    const q = await enviado();
    await seg(q.id, { next_contact_date: iso(3) });
    assert.equal((await detalle(q.id)).next_contact_date, iso(3));
    const acc = await estado(q.id, 'ACCEPTED');
    assert.ok(acc.json.accepted_at);
    assert.equal(acc.json.next_contact_date, null);
    assert.equal((await estado(q.id, 'ACCEPTED')).json.accepted_at, acc.json.accepted_at, 'aceptar de nuevo no cambia la fecha');
    assert.equal((await estado(q.id, 'FOLLOW_UP')).json.accepted_at, null);
    await seg(q.id, { next_contact_date: iso(2) });
    const rej = await estado(q.id, 'REJECTED');
    assert.equal(rej.json.next_contact_date, null);
    assert.equal(rej.json.accepted_at, null);
  });

  it('una nota con el cambio queda en la bitácora con el estado nuevo; el cambio queda en la auditoría', async () => {
    const q = await enviado();
    await estado(q.id, 'ACCEPTED', 'Aprobó por WhatsApp');
    await estado(q.id, 'ACCEPTED'); // sin cambio: no se audita
    const lista = (await app.api('GET', `/quotes/${q.id}/follow-ups`, { token: a.token })).json.data;
    assert.equal(lista.length, 1);
    assert.deepEqual([lista[0].note, lista[0].commercial_status], ['Aprobó por WhatsApp', 'ACCEPTED']);
    const ev = await pool.query(`SELECT metadata FROM audit_events WHERE event = 'COMMERCIAL_STATUS_CHANGED'`);
    assert.deepEqual(ev.rows.map((r) => r.metadata), [{ from: 'SENT', to: 'ACCEPTED' }]);
  });

  it('seguimiento: nota, fecha o ambas; más reciente primero; la fecha actualiza el presupuesto', async () => {
    const q = await enviado();
    assert.deepEqual((await app.api('GET', `/quotes/${q.id}/follow-ups`, { token: a.token })).json, { data: [] });
    const n = await seg(q.id, { note: 'Revisará con su socio' });
    assert.equal(n.status, 201);
    assert.deepEqual([n.json.note, n.json.next_contact_date, n.json.commercial_status], ['Revisará con su socio', null, 'SENT']);
    const f = await seg(q.id, { next_contact_date: iso(5), note: 'Llamar el viernes' });
    assert.equal(f.json.next_contact_date, iso(5));
    assert.equal((await detalle(q.id)).next_contact_date, iso(5));
    const hoy = await seg(q.id, { next_contact_date: iso(0) });
    assert.equal(hoy.status, 201, 'hoy vale');
    const lista = (await app.api('GET', `/quotes/${q.id}/follow-ups`, { token: a.token })).json.data;
    assert.deepEqual(lista.map((x: { id: string }) => x.id), [hoy.json.id, f.json.id, n.json.id]);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/next-contact`, { token: a.token })).status, 204);
    assert.equal((await detalle(q.id)).next_contact_date, null);
  });

  it('seguimiento: valida fecha y cuerpo, y no se programa contacto en aceptados ni rechazados', async () => {
    const q = await enviado();
    for (const malo of [{}, { note: '   ' }, { next_contact_date: iso(-1) }, { next_contact_date: '2026-13-45' }, { next_contact_date: '15/10/2026' }, { note: 'x'.repeat(2001) }, { note: 'a', extra: 1 }]) {
      assert.equal((await seg(q.id, malo)).status, 422, JSON.stringify(malo));
    }
    await estado(q.id, 'ACCEPTED');
    assert.equal((await seg(q.id, { next_contact_date: iso(2) })).status, 409);
    assert.equal((await seg(q.id, { note: 'Cobrar anticipo' })).status, 201, 'una nota sí se puede');
    const sin = await finalizado();
    assert.equal((await seg(sin.id, { note: 'x' })).status, 409, 'sin enviar no hay seguimiento');
  });

  it('aislamiento y alcance: B recibe 404 y una sesión del código recibe 403', async () => {
    const q = await enviado();
    const t = (await app.api('POST', '/access/code/exchange', { body: { code: q.access_code } })).json.token;
    for (const [m, p, body] of [
      ['PUT', `/quotes/${q.id}/commercial-status`, { status: 'ACCEPTED' }], ['GET', `/quotes/${q.id}/follow-ups`], ['POST', `/quotes/${q.id}/follow-ups`, { note: 'x' }], ['DELETE', `/quotes/${q.id}/next-contact`],
    ] as [string, string, object?][]) {
      assert.equal((await app.api(m, p, { token: b.token, ...(body && { body }) })).status, 404, `B ${m} ${p}`);
      assert.equal((await app.api(m, p, { token: t, ...(body && { body }) })).status, 403, `código ${m} ${p}`);
    }
    assert.equal((await detalle(q.id)).commercial_status, 'SENT');
  });

  it('dashboard: secciones, conteos, tope de 5 y días desde el envío', async () => {
    for (let i = 0; i < 7; i++) await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: `C${i}`, phone: '+56933333333' } } });
    const vencido = await enviado();
    const futuro = await enviado();
    const sinFecha = await enviado();
    const fin = await finalizado();
    await seg(futuro.id, { next_contact_date: iso(4) });
    await pool.query(`UPDATE quotes SET next_contact_date = $2::date, sent_at = now() - interval '5 days' WHERE id = $1`, [vencido.id, iso(-1)]);
    const d = (await app.api('GET', '/dashboard', { token: a.token })).json;
    assert.deepEqual(d.counts, { pending: 7, follow_up: 1, finalized: 3 });
    assert.equal(d.pending.length, 5, 'el tablero muestra hasta 5');
    assert.deepEqual(d.follow_up.map((q: { id: string }) => q.id), [vencido.id]);
    assert.equal(d.follow_up[0].days_since_sent, 5);
    assert.deepEqual(d.finalized.map((q: { id: string }) => q.id).sort(), [futuro.id, sinFecha.id, fin.id].sort(), 'lo que está en Seguimiento no se repite');
    const lista = (await app.api('GET', '/quotes?section=finalized', { token: a.token })).json;
    assert.equal(lista.total, 3, 'el listado por sección coincide con el tablero (un enviado sin fecha sigue en Finalizados)');
    assert.deepEqual(Object.keys(d.pending[0]).sort(), ['code_id', 'commercial_status', 'currency', 'customer', 'doc_status', 'id', 'next_contact_date', 'number', 'sent_at', 'service_description', 'total', 'updated_at', 'version']);
    assert.deepEqual((await app.api('GET', '/dashboard', { token: b.token })).json.counts, { pending: 0, follow_up: 0, finalized: 0 }, 'B no ve nada de A');
  });

  it('indicadores del mes: monto, aceptados, ticket promedio y tasa solo entre decididos', async () => {
    const q1 = await enviado(a.token, 100000);
    const q2 = await enviado(a.token, 50000);
    const q3 = await enviado(a.token, 30000);
    await enviado(a.token, 20000); // sin respuesta: no cuenta como rechazo
    await estado(q1.id, 'ACCEPTED');
    await estado(q2.id, 'ACCEPTED');
    await estado(q3.id, 'REJECTED');
    const k = (await app.api('GET', '/dashboard/kpis', { token: a.token })).json;
    assert.deepEqual(k, {
      month: mes(), quotes_count: 4, quoted_amount: 200000, accepted_count: 2, accepted_amount: 150000,
      avg_ticket: 75000, acceptance_rate: 2 / 3, follow_up_pending: 0,
      waiting_count: 1, waiting_amount: 20000, todo_count: 0, // el de $20.000 sigue esperando respuesta; ninguno falta por terminar
    });
    assert.equal((await app.api('GET', `/dashboard/kpis?month=${mes()}`, { token: a.token })).json.quotes_count, 4);
    const otro = (await app.api('GET', '/dashboard/kpis?month=2020-01', { token: a.token })).json;
    assert.deepEqual([otro.quotes_count, otro.quoted_amount, otro.accepted_count, otro.avg_ticket, otro.acceptance_rate], [0, 0, 0, 0, null]);
    for (const malo of ['2026-13', '26-10', 'octubre', '2026-1']) assert.equal((await app.api('GET', `/dashboard/kpis?month=${malo}`, { token: a.token })).status, 422, malo);
    assert.equal((await app.api('GET', '/dashboard/kpis', { token: b.token })).json.quotes_count, 0);
    // Un borrador y un terminado sin enviar cuentan como «por terminar o enviar» (igual que la pestaña Pendientes), sin tocar lo que espera respuesta.
    await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Borrador', phone: '+56933333333' } } });
    await finalizado();
    const k2 = (await app.api('GET', '/dashboard/kpis', { token: a.token })).json;
    assert.deepEqual([k2.todo_count, k2.waiting_count, k2.waiting_amount], [2, 1, 20000]);
  });

  it('el rechazo se fecha por su último cambio: uno rechazado el mes pasado no cuenta este mes', async () => {
    const q1 = await enviado();
    const q2 = await enviado();
    await estado(q1.id, 'ACCEPTED');
    await estado(q2.id, 'REJECTED');
    await pool.query(`UPDATE audit_events SET created_at = now() - interval '40 days' WHERE quote_id = $1 AND event = 'COMMERCIAL_STATUS_CHANGED'`, [q2.id]);
    assert.equal((await app.api('GET', '/dashboard/kpis', { token: a.token })).json.acceptance_rate, 1);
  });
});
