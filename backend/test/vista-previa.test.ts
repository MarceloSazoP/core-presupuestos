import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string };
let quoteId: string;
const preview = (id = quoteId, token = a.token) => fetch(`${app.base}/quotes/${id}/preview`, { headers: { Authorization: `Bearer ${token}` } });

describe('API: vista previa del borrador (Contrato API §7)', () => {
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
    quoteId = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json.id;
  });
  afterEach(async () => {
    await app.close();
  });

  it('entrega un PDF aunque el borrador esté incompleto, sin numerar ni fijar nada; después se puede terminar y recibe el 0001', async () => {
    const r = await preview();
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /application\/pdf/);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    const { rows } = await pool.query('SELECT doc_status, number FROM quotes WHERE id = $1', [quoteId]);
    assert.deepEqual(rows[0], { doc_status: 'DRAFT', number: null });
    assert.equal((await pool.query('SELECT 1 FROM quote_documents WHERE quote_id = $1', [quoteId])).rowCount, 0, 'no queda snapshot');

    await app.api('PATCH', `/quotes/${quoteId}`, { token: a.token, body: { service_description: 'Instalar puerta', validity_days: 15 } });
    await app.api('PUT', `/quotes/${quoteId}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit_price: 1000 }] } });
    assert.equal((await preview()).status, 200);
    const fin = await app.api('POST', `/quotes/${quoteId}/finalize`, { token: a.token, body: {} });
    assert.equal(fin.status, 200);
    assert.match(fin.json.number, /-0001$/, 'la vista previa no gastó ningún número');
  });

  it('un presupuesto terminado (409), uno ajeno (404) y sin sesión (401) no se previsualizan; la sesión del código sí', async () => {
    const codigo = (await app.api('POST', `/quotes/${quoteId}/access-code`, { token: a.token })).json.code;
    const s = (await app.api('POST', '/access/code/exchange', { body: { code: codigo } })).json.token;
    assert.equal((await preview(quoteId, s)).status, 200);
    const b = await app.login('+56922222222', 'b@test.cl', 'Beto');
    assert.equal((await preview(quoteId, b.token)).status, 404);
    assert.equal((await fetch(`${app.base}/quotes/${quoteId}/preview`)).status, 401);
    await app.api('PATCH', `/quotes/${quoteId}`, { token: a.token, body: { service_description: 'X', validity_days: 15 } });
    await app.api('PUT', `/quotes/${quoteId}/items`, { token: a.token, body: { items: [{ description: 'P', quantity: 1, unit_price: 1000 }] } });
    await app.api('POST', `/quotes/${quoteId}/finalize`, { token: a.token, body: {} });
    assert.equal((await preview()).status, 409);
  });
});
