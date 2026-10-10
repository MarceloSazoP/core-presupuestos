import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };

// El cliente acepta desde su enlace (Contrato API §10, decisión del 2026-10-10).
describe('API: el cliente acepta el presupuesto desde el enlace', () => {
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
    app.mails.length = 0;
  });
  afterEach(async () => {
    await app.close();
  });

  // Un presupuesto terminado y enviado por correo; devuelve su id y el token público.
  const enviado = async () => {
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333', email: 'juan@cliente.cl' } } })).json;
    await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { service_description: 'Instalación', validity_days: 15 } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Mano de obra', quantity: 1, unit_price: 100000 }] } });
    await app.api('POST', `/quotes/${q.id}/finalize`, { token: a.token, body: {} });
    await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: {} });
    const token = (await pool.query(`SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC'`, [q.id])).rows[0].token as string;
    app.mails.length = 0;
    return { id: q.id as string, token };
  };
  const aceptar = (token: string) => fetch(`${app.base}/public/quotes/${token}/accept`, { method: 'POST' });

  it('acepta, deja el seguimiento, envía el PDF timbrado al cliente y al profesional, y no repite nada', async () => {
    const q = await enviado();
    const r = await aceptar(q.token);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.can_accept, false);
    assert.match(j.accepted_on, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(j.confirmation_sent, true);

    const d = (await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json;
    assert.equal(d.commercial_status, 'ACCEPTED');
    assert.ok(d.accepted_at);
    const notas = (await app.api('GET', `/quotes/${q.id}/follow-ups`, { token: a.token })).json.data;
    assert.equal(notas[0].note, 'Aceptado por el cliente desde el enlace');

    assert.deepEqual(app.mails.map((m) => m.to).sort(), ['a@test.cl', 'juan@cliente.cl']);
    for (const m of app.mails) {
      assert.match(m.attachment!.filename, /-aceptado\.pdf$/);
      assert.equal(m.attachment!.content.subarray(0, 5).toString(), '%PDF-');
      assert.ok(m.html!.includes('ACEPTADO'));
    }

    const pdf = await fetch(`${app.base}/quotes/${q.id}/pdf`, { headers: { Authorization: `Bearer ${a.token}` } });
    assert.match(pdf.headers.get('content-disposition')!, /-aceptado\.pdf/, 'el PDF del profesional también lleva el timbre');

    assert.equal((await aceptar(q.token)).status, 200, 'aceptar de nuevo no falla');
    assert.equal(app.mails.length, 2, 'ni vuelve a enviar correos');
    const eventos = await pool.query(`SELECT count(*)::int AS n FROM audit_events WHERE event = 'QUOTE_ACCEPTED_BY_CUSTOMER'`);
    assert.equal(eventos.rows[0].n, 1);
  });

  it('no se acepta uno rechazado ni uno vencido: 409 y la vista no ofrece el botón', async () => {
    const rechazado = await enviado();
    await app.api('PUT', `/quotes/${rechazado.id}/commercial-status`, { token: a.token, body: { status: 'REJECTED' } });
    assert.equal((await aceptar(rechazado.token)).status, 409);

    const vencido = await enviado();
    await pool.query(`UPDATE quote_documents SET snapshot = jsonb_set(snapshot, '{valid_until}', '"2020-01-01"') WHERE quote_id = $1`, [vencido.id]);
    assert.equal((await (await fetch(`${app.base}/public/quotes/${vencido.token}`)).json()).can_accept, false);
    const r = await aceptar(vencido.token);
    assert.equal(r.status, 409);
    assert.match((await r.json()).error.message, /venció el 01-01-2020/);
    assert.equal((await app.api('GET', `/quotes/${vencido.id}`, { token: a.token })).json.commercial_status, 'SENT', 'no cambia nada');
  });

  it('con logo, la propuesta y la confirmación al cliente lo llevan incrustado arriba; el aviso al profesional, no', async () => {
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await app.upload('PUT', '/me/logo', { token: a.token, file: PNG });
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333', email: 'juan@cliente.cl' } } })).json;
    await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { service_description: 'Instalación', validity_days: 15 } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Mano de obra', quantity: 1, unit_price: 100000 }] } });
    await app.api('POST', `/quotes/${q.id}/finalize`, { token: a.token, body: {} });
    await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: {} });
    const propuesta = app.mails.at(-1)!;
    assert.deepEqual(propuesta.logo?.content, PNG);
    assert.ok(propuesta.html!.includes('src="cid:logo"'));

    app.mails.length = 0;
    const token = (await pool.query(`SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC'`, [q.id])).rows[0].token as string;
    await aceptar(token);
    const cliente = app.mails.find((m) => m.to === 'juan@cliente.cl')!;
    const profesional = app.mails.find((m) => m.to === 'a@test.cl')!;
    assert.ok(cliente.logo && cliente.html!.includes('src="cid:logo"'));
    assert.ok(!profesional.logo && !profesional.html!.includes('cid:logo'));
  });

  it('si el correo falla, la aceptación queda igual', async () => {
    const q = await enviado();
    app.mailState.fail = true;
    const r = await aceptar(q.token);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).confirmation_sent, false);
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.commercial_status, 'ACCEPTED');
  });
});
