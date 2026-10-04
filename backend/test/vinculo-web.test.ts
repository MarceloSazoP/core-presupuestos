import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string };
let quoteId: string;
const crear = async () => (await app.api('POST', '/access/pair')).json as { id: string; code: string; secret: string };
const esperar = (p: { id: string; secret: string }) => app.api('POST', '/access/pair/poll', { body: { id: p.id, secret: p.secret } });
const vincular = (code: string, quote_id = quoteId, token = a.token) => app.api('POST', '/access/pair/claim', { token, body: { code, quote_id } });

describe('API: vínculo de la web con la app por QR (Contrato API §9)', () => {
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

  it('crear → esperar → vincular → recoger una sola vez, con una sesión limitada a ese presupuesto', async () => {
    const p = await crear();
    assert.deepEqual((await esperar(p)).json, { status: 'WAITING' });
    assert.equal((await vincular(p.code)).status, 204);
    const r = await esperar(p);
    assert.equal(r.json.status, 'CLAIMED');
    assert.equal(r.json.quote_id, quoteId);
    assert.equal(r.json.doc_status, 'DRAFT');
    assert.equal((await app.api('GET', `/quotes/${quoteId}`, { token: r.json.token })).status, 200, 'la sesión entregada abre el presupuesto');
    assert.equal((await app.api('GET', '/me', { token: r.json.token })).status, 403, 'y nada más');
    assert.equal((await esperar(p)).status, 404, 'se entrega una sola vez');
    const { rows } = await pool.query('SELECT session_token FROM web_pairings WHERE id = $1', [p.id]);
    assert.equal(rows[0].session_token, null, 'el token en claro no queda guardado');
  });

  it('el QR (code) no sirve para recoger la sesión; secreto equivocado, id inexistente y vencido dan el mismo 404', async () => {
    const p = await crear();
    await vincular(p.code);
    for (const malo of [{ id: p.id, secret: p.code }, { id: p.id, secret: 'x' }, { id: crypto.randomUUID(), secret: p.secret }]) assert.equal((await esperar(malo)).status, 404);
    await pool.query("UPDATE web_pairings SET expires_at = now() - interval '1 second' WHERE id = $1", [p.id]);
    assert.equal((await esperar(p)).status, 404, 'vencido');
    const otro = await crear();
    await pool.query("UPDATE web_pairings SET expires_at = now() - interval '1 second' WHERE id = $1", [otro.id]);
    assert.equal((await vincular(otro.code)).status, 404, 'no se puede vincular un QR vencido');
  });

  it('vincular exige sesión de usuario, un presupuesto propio y un QR sin usar', async () => {
    const p = await crear();
    const b = await app.login('+56922222222', 'b@test.cl', 'Beto');
    assert.equal((await vincular(p.code, quoteId, b.token)).status, 404, 'presupuesto ajeno');
    assert.equal((await app.api('POST', '/access/pair/claim', { body: { code: p.code, quote_id: quoteId } })).status, 401, 'sin sesión');
    const sesionCodigo = (await app.api('POST', '/access/code/exchange', { body: { code: (await app.api('POST', `/quotes/${quoteId}/access-code`, { token: a.token })).json.code } })).json.token;
    assert.equal((await vincular(p.code, quoteId, sesionCodigo)).status, 403, 'una sesión de código no vincula');
    assert.equal((await vincular('inexistente')).status, 404);
    assert.equal((await vincular(p.code)).status, 204);
    assert.equal((await vincular(p.code)).status, 404, 'un QR se usa una vez');
  });
});
