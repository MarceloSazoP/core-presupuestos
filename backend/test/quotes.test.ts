import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { lineTotal, sumTotals, vatOf } from '../src/modules/quotes/totals';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };
const cliente = { name: 'Juan Pérez', phone: '+56933333333' };

describe('API: presupuestos (Contrato API §6, §9 y §14)', () => {
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

  const crear = async (token = a.token, body: object = { customer: cliente }) => {
    const r = await app.api('POST', '/quotes', { token, body });
    assert.ok(r.status === 201 || r.status === 200, JSON.stringify(r.json));
    return r.json;
  };
  const items = (token: string, id: string, list: object[]) => app.api('PUT', `/quotes/${id}/items`, { token, body: { items: list } });
  const finalizar = (id: string) =>
    pool.query(`UPDATE quotes SET doc_status='FINALIZED', number='CP-2026-' || substr($1::text, 1, 4), finalized_at=now(), service_description='x', validity_days=15 WHERE id=$1`, [id]);

  it('lineTotal: round(cantidad × precio) con .5 hacia arriba y sin errores de flotante', () => {
    assert.equal(lineTotal(12.5, 18000), 225000);
    assert.equal(lineTotal(0.5, 5001), 2501); // 2500,5 → 2501
    assert.equal(lineTotal(1.001, 999), 1000); // 999,999
    assert.equal(lineTotal(0.001, 1), 0);
    assert.equal(lineTotal(1_000_000, 999_999_999), 999_999_999_000_000);
    assert.equal(lineTotal(1.005, 100), 101); // 100,5 → 101 (en flotante 1.005*100 = 100.49999…)
  });

  it('crea con cliente en línea: DRAFT, ID corto, código una sola vez y cliente creado', async () => {
    const q = await crear();
    assert.equal(q.doc_status, 'DRAFT');
    assert.match(q.code_id, /^[0-9A-HJKMNP-TV-Z]{6}$/);
    assert.match(q.access_code, /^[0-9A-HJKMNP-TV-Z]{6}-[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.ok(q.access_code.startsWith(q.code_id));
    assert.equal(q.customer.name, 'Juan Pérez');
    assert.equal(q.public_url, null);
    const get = await app.api('GET', `/quotes/${q.id}`, { token: a.token });
    assert.equal(get.json.access_code, undefined, 'el secreto no se vuelve a leer');
    const { rows } = await pool.query('SELECT code_hash FROM quote_access WHERE quote_id = $1', [q.id]);
    assert.ok(rows[0].code_hash.startsWith('$argon2id$'));
    assert.ok(!JSON.stringify(rows).includes(q.access_code.slice(7)), 'el secreto no se guarda en claro');
  });

  it('el listado trae el ID corto de cada presupuesto (no el secreto)', async () => {
    const q = await crear();
    const lista = (await app.api('GET', '/quotes', { token: a.token })).json.data;
    assert.equal(lista[0].code_id, q.code_id);
    assert.ok(!JSON.stringify(lista).includes(q.access_code.slice(7)), 'el secreto no sale en listados');
    const dash = (await app.api('GET', '/dashboard', { token: a.token })).json;
    assert.equal(dash.pending[0].code_id, q.code_id);
  });

  it('cliente: o customer_id o customer; el de otro usuario no sirve', async () => {
    const c = (await app.api('POST', '/customers', { token: a.token, body: cliente })).json;
    assert.equal((await crear(a.token, { customer_id: c.id })).customer.id, c.id);
    assert.equal((await app.api('POST', '/quotes', { token: a.token, body: {} })).status, 422);
    assert.equal((await app.api('POST', '/quotes', { token: a.token, body: { customer_id: c.id, customer: cliente } })).status, 422);
    const ajeno = await app.api('POST', '/quotes', { token: b.token, body: { customer_id: c.id } });
    assert.equal(ajeno.status, 422);
    assert.equal(ajeno.json.error.details[0].field, 'customer_id');
  });

  it('idempotencia: mismo id ⇒ 200 sin código ni duplicado; id de otro usuario ⇒ 409', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const r1 = await app.api('POST', '/quotes', { token: a.token, body: { id, customer: cliente } });
    assert.equal(r1.status, 201);
    const r2 = await app.api('POST', '/quotes', { token: a.token, body: { id, customer: cliente } });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.access_code, undefined);
    assert.equal((await app.api('GET', '/quotes', { token: a.token })).json.total, 1);
    assert.equal((await app.api('GET', '/customers', { token: a.token })).json.total, 1, 'el reintento no duplica el cliente');
    const r3 = await app.api('POST', '/quotes', { token: b.token, body: { id, customer: cliente } });
    assert.equal(r3.status, 409);
    assert.equal(r3.json.error.code, 'ID_CONFLICT');
  });

  it('aislamiento: el usuario B recibe 404 en cada ruta con el presupuesto del usuario A', async () => {
    const q = await crear();
    const rutas: [string, string, object?][] = [
      ['GET', `/quotes/${q.id}`], ['PATCH', `/quotes/${q.id}`, { address: 'x' }], ['PUT', `/quotes/${q.id}/survey`, { notes: 'x' }],
      ['PUT', `/quotes/${q.id}/measurements`, { measurements: [] }], ['PUT', `/quotes/${q.id}/items`, { items: [] }],
      ['POST', `/quotes/${q.id}/save`, {}], ['POST', `/quotes/${q.id}/access-code`, {}], ['DELETE', `/quotes/${q.id}/access-code`],
      ['DELETE', `/quotes/${q.id}`],
    ];
    for (const [m, p, body] of rutas) assert.equal((await app.api(m, p, { token: b.token, ...(body && { body }) })).status, 404, `${m} ${p}`);
    assert.deepEqual((await app.api('GET', '/quotes', { token: b.token })).json, { total: 0, data: [] });
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).status, 200, 'A sigue intacto');
    assert.equal((await app.api('GET', '/quotes/no-es-uuid', { token: a.token })).status, 404);
  });

  it('ítems: el backend calcula line_total, subtotal y total; el descuento recalcula', async () => {
    const q = await crear();
    const r = await items(a.token, q.id, [
      { description: 'Piso flotante', quantity: 12.5, unit: 'm2', unit_price: 18000 },
      { description: 'Pilas', quantity: 1, unit_price: 5000 },
      { description: 'Medio', quantity: 0.5, unit_price: 5001 },
    ]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.items.map((i: { line_total: number }) => i.line_total), [225000, 5000, 2501]);
    assert.equal(r.json.items[1].unit, 'un', 'unidad por defecto');
    assert.equal(r.json.subtotal, 232501);
    assert.equal(r.json.total, 232501);
    const p = await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { discount: 2501 } });
    assert.equal(p.json.discount, 2501);
    assert.equal(p.json.total, 230000);
    const otra = await items(a.token, q.id, [{ description: 'Uno', quantity: 2, unit_price: 1000 }]);
    assert.equal(otra.json.subtotal, 2000);
    assert.equal(otra.json.total, -501, 'el descuento previo sigue aplicando (finalize lo rechaza si supera el subtotal)');
  });

  it('IVA: 19 % de (subtotal − descuento), redondeo .5 hacia arriba, y sin IVA no cambia nada', () => {
    assert.equal(vatOf(100000), 19000);
    assert.equal(vatOf(50), 10, '9,5 sube');
    assert.equal(vatOf(2), 0, '0,38 baja');
    assert.equal(vatOf(3), 1, '0,57 sube');
    assert.equal(vatOf(0), 0);
    assert.equal(vatOf(-500), 0, 'un neto negativo no genera IVA');
    assert.equal(vatOf(999_999_999_000_000), 189_999_999_810_000, 'sin perder precisión con montos enormes');
    assert.deepEqual(sumTotals([10000], 1000, true), { subtotal: 10000, vat: 1710, total: 10710 }, 'el descuento va antes del IVA');
    assert.deepEqual(sumTotals([10000], 1000, false), { subtotal: 10000, vat: 0, total: 9000 });
  });

  it('IVA: la casilla recalcula; cambiar ítems o descuento también; el esquema no deja un total que no cuadra', async () => {
    const q = await crear();
    await items(a.token, q.id, [{ description: 'Uno', quantity: 1, unit_price: 10000 }]);
    let r = await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { include_vat: true } });
    assert.deepEqual([r.json.include_vat, r.json.subtotal, r.json.vat, r.json.total], [true, 10000, 1900, 11900]);
    r = await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { discount: 1000 } });
    assert.deepEqual([r.json.discount, r.json.vat, r.json.total], [1000, 1710, 10710], 'el descuento se aplica antes del IVA');
    r = await items(a.token, q.id, [{ description: 'Uno', quantity: 1, unit_price: 20000 }]);
    assert.deepEqual([r.json.subtotal, r.json.vat, r.json.total], [20000, 3610, 22610], 'cambiar los ítems recalcula el IVA');
    r = await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { include_vat: false } });
    assert.deepEqual([r.json.include_vat, r.json.vat, r.json.total], [false, 0, 19000]);
    assert.equal((await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { include_vat: 'si' } })).status, 422);
    assert.equal((await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { vat: 5 } })).status, 422, 'el cliente nunca envía el IVA');
    await assert.rejects(pool.query('UPDATE quotes SET vat = 5 WHERE id = $1', [q.id]), /quotes_/, 'IVA sin la casilla');
    await assert.rejects(pool.query('UPDATE quotes SET total = total + 1 WHERE id = $1', [q.id]), /quotes_total_check/);
  });

  it('ítems: rechaza lo que el contrato rechaza, sin dejar nada a medias', async () => {
    const q = await crear();
    await items(a.token, q.id, [{ description: 'Bueno', quantity: 1, unit_price: 100 }]);
    const malos: object[] = [
      { description: 'x', quantity: 0, unit_price: 1 }, { description: 'x', quantity: -1, unit_price: 1 },
      { description: 'x', quantity: 1.0001, unit_price: 1 }, { description: 'x', quantity: 1_000_001, unit_price: 1 },
      { description: 'x', quantity: 1, unit_price: -1 }, { description: 'x', quantity: 1, unit_price: 1.5 },
      { description: 'x', quantity: 1, unit_price: 1_000_000_000 }, { description: '', quantity: 1, unit_price: 1 },
      { description: 'x'.repeat(301), quantity: 1, unit_price: 1 }, { description: 'x', quantity: 1, unit: 'M²', unit_price: 1 },
      { description: 'x', quantity: 1, unit_price: 1, line_total: 1 },
    ];
    for (const it of malos) assert.equal((await items(a.token, q.id, [it])).status, 422, JSON.stringify(it));
    assert.equal((await items(a.token, q.id, Array.from({ length: 101 }, () => ({ description: 'x', quantity: 1, unit_price: 1 })))).status, 422);
    const get = await app.api('GET', `/quotes/${q.id}`, { token: a.token });
    assert.equal(get.json.items.length, 1, 'lo anterior queda intacto');
    assert.equal(get.json.items[0].description, 'Bueno');
  });

  it('estados: guardar pasa DRAFT → PENDING (idempotente) y un FINALIZED rechaza toda escritura', async () => {
    const q = await crear();
    assert.equal((await app.api('POST', `/quotes/${q.id}/save`, { token: a.token, body: {} })).json.doc_status, 'PENDING');
    assert.equal((await app.api('POST', `/quotes/${q.id}/save`, { token: a.token, body: {} })).json.doc_status, 'PENDING');
    assert.equal((await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { address: 'x' } })).json.doc_status, 'PENDING', 'editar no cambia el estado');
    await finalizar(q.id);
    for (const [m, p, body] of [
      ['PATCH', '', { address: 'x' }], ['PUT', '/survey', { notes: 'x' }], ['PUT', '/measurements', { measurements: [] }],
      ['PUT', '/items', { items: [] }], ['POST', '/save', {}], ['DELETE', '', undefined],
    ] as [string, string, object?][]) {
      const r = await app.api(m, `/quotes/${q.id}${p}`, { token: a.token, ...(body && { body }) });
      assert.equal(r.status, 409, `${m} ${p}`);
      assert.equal(r.json.error.code, 'INVALID_STATE');
    }
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).status, 200, 'leer sí se puede');
  });

  it('PATCH valida: garantía personalizada, coordenadas, vigencia y campos que no son del cliente', async () => {
    const q = await crear();
    const patch = (body: object) => app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body });
    assert.equal((await patch({ warranty: { kind: 'CUSTOM' } })).status, 422);
    const ok = await patch({ warranty: { kind: 'CUSTOM', text: '2 años' }, latitude: -33.45, longitude: -70.66, validity_days: 15, include_qr: true });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json.warranty, { kind: 'CUSTOM', text: '2 años' });
    assert.equal((await patch({ warranty: { kind: 'M3' } })).json.warranty.text, null, 'solo CUSTOM lleva texto');
    assert.equal((await patch({ latitude: -33.45 })).status, 422);
    assert.equal((await patch({ latitude: 91, longitude: 0 })).status, 422);
    assert.equal((await patch({ latitude: null, longitude: null })).json.latitude, null);
    for (const bad of [{ validity_days: 0 }, { validity_days: 366 }, { discount: -1 }, { discount: 1.5 }, { user_id: b.user.id }, { total: 1 }, { doc_status: 'FINALIZED' }, { short_id: 'AAAAAA' }]) {
      assert.equal((await patch(bad)).status, 422, JSON.stringify(bad));
    }
    assert.equal((await patch({ customer_id: '00000000-0000-4000-8000-000000000000' })).status, 422);
  });

  it('levantamiento: notas parciales, medidas reemplazan en orden y respetan límites', async () => {
    const q = await crear();
    await app.api('PUT', `/quotes/${q.id}/survey`, { token: a.token, body: { notes: 'Casa de dos pisos' } });
    const s = await app.api('PUT', `/quotes/${q.id}/survey`, { token: a.token, body: { field_observations: 'Tablero antiguo' } });
    assert.deepEqual([s.json.survey.notes, s.json.survey.field_observations], ['Casa de dos pisos', 'Tablero antiguo'], 'lo no enviado se conserva');
    const m = await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: { measurements: [{ label: 'Largo', value: '3,5 m' }, { label: 'Ancho', value: '2 m' }] } });
    assert.deepEqual(m.json.survey.measurements.map((x: { label: string }) => x.label), ['Largo', 'Ancho']);
    const m2 = await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: { measurements: [{ label: 'Alto', value: '2,4 m' }] } });
    assert.equal(m2.json.survey.measurements.length, 1);
    const largo = (n: number) => ({ measurements: Array.from({ length: n }, () => ({ label: 'x', value: 'y' })) });
    assert.equal((await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: largo(51) })).status, 422);
    assert.equal((await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: { measurements: [{ label: '', value: 'y' }] } })).status, 422);
    assert.equal((await app.api('PUT', `/quotes/${q.id}/survey`, { token: a.token, body: { notes: 'x'.repeat(10_001) } })).status, 422);
  });

  it('borrar un DRAFT lo elimina con todo; ids repetidos entre presupuestos ⇒ 409', async () => {
    const q = await crear();
    const mid = '33333333-3333-4333-8333-333333333333';
    await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: { measurements: [{ id: mid, label: 'Largo', value: '1 m' }] } });
    const q2 = await crear();
    const choque = await app.api('PUT', `/quotes/${q2.id}/measurements`, { token: a.token, body: { measurements: [{ id: mid, label: 'x', value: 'y' }] } });
    assert.equal(choque.status, 409);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}`, { token: a.token })).status, 204);
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).status, 404);
    const { rows } = await pool.query('SELECT (SELECT count(*) FROM survey_measurements WHERE id = $1)::int AS m, (SELECT count(*) FROM quote_access WHERE quote_id = $2)::int AS acc', [mid, q.id]);
    assert.deepEqual(rows[0], { m: 0, acc: 0 });
    const auditoria = await pool.query(`SELECT 1 FROM audit_events WHERE event = 'QUOTE_DELETED' AND quote_id = $1`, [q.id]);
    assert.equal(auditoria.rowCount, 1);
  });

  it('listado: secciones, filtros y paginación según el contrato de BD §4', async () => {
    const q1 = await crear();
    const q2 = await crear();
    const q3 = await crear();
    const q4 = await crear();
    await app.api('POST', `/quotes/${q2.id}/save`, { token: a.token, body: {} });
    for (const q of [q3, q4]) await finalizar(q.id);
    await pool.query(`UPDATE quotes SET commercial_status='SENT', sent_at=now(), next_contact_date=((now() AT TIME ZONE 'America/Santiago')::date - 1) WHERE id=$1`, [q3.id]);
    const ids = async (qs: string) => (await app.api('GET', `/quotes${qs}`, { token: a.token })).json.data.map((x: { id: string }) => x.id).sort();
    assert.deepEqual(await ids('?section=pending'), [q1.id, q2.id].sort());
    assert.deepEqual(await ids('?section=follow_up'), [q3.id]);
    assert.deepEqual(await ids('?section=finalized'), [q4.id], 'lo que está en Seguimiento no se repite en Finalizados');
    assert.deepEqual(await ids('?doc_status=PENDING'), [q2.id]);
    assert.deepEqual(await ids('?commercial_status=SENT'), [q3.id]);
    const page = await app.api('GET', '/quotes?limit=3&offset=3', { token: a.token });
    assert.equal(page.json.data.length, 1);
    assert.equal(page.json.total, 4);
    assert.equal(page.json.data[0].customer.name, 'Juan Pérez');
    assert.equal((await app.api('GET', '/quotes?section=otra', { token: a.token })).status, 422);
  });

  it('rotar el código invalida el anterior y revocarlo lo deja sin acceso', async () => {
    const q = await crear();
    const rot = await app.api('POST', `/quotes/${q.id}/access-code`, { token: a.token, body: {} });
    assert.equal(rot.status, 200);
    assert.notEqual(rot.json.code, q.access_code);
    assert.equal((await app.api('POST', '/access/code/exchange', { body: { code: q.access_code } })).status, 404, 'el código viejo ya no sirve');
    const ok = await app.api('POST', '/access/code/exchange', { body: { code: rot.json.code } });
    assert.equal(ok.status, 200);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/access-code`, { token: a.token })).status, 204);
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: ok.json.token })).status, 401, 'la sesión del código revocado también cae');
    assert.equal((await app.api('POST', '/access/code/exchange', { body: { code: rot.json.code } })).status, 404);
  });
});
