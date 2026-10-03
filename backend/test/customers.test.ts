import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };
const cli = { name: 'Juan Pérez', phone: '+56933333333', email: 'JUAN@Mail.cl', address: 'Av. X 1234' };

describe('API: clientes y aislamiento por usuario (Contrato API §5 y §14)', () => {
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

  const crear = async (token = a.token, body: object = cli) => (await app.api('POST', '/customers', { token, body })).json;

  it('crea, lee, reemplaza y borra; el correo se guarda en minúsculas', async () => {
    const c = await crear();
    assert.equal(c.email, 'juan@mail.cl');
    const get = await app.api('GET', `/customers/${c.id}`, { token: a.token });
    assert.deepEqual(get.json.summary, { quotes: 0, accepted: 0, follow_up: 0 });
    const put = await app.api('PUT', `/customers/${c.id}`, { token: a.token, body: { name: 'Juan P.', phone: '+56944444444' } });
    assert.equal(put.json.name, 'Juan P.');
    assert.equal(put.json.email, null, 'PUT reemplaza: lo que no se envía se limpia');
    assert.equal((await app.api('DELETE', `/customers/${c.id}`, { token: a.token })).status, 204);
    assert.equal((await app.api('GET', `/customers/${c.id}`, { token: a.token })).status, 404);
  });

  it('aislamiento: el usuario B recibe 404 en cada ruta con el cliente del usuario A', async () => {
    const c = await crear();
    assert.equal((await app.api('GET', `/customers/${c.id}`, { token: b.token })).status, 404);
    assert.equal((await app.api('PUT', `/customers/${c.id}`, { token: b.token, body: cli })).status, 404);
    assert.equal((await app.api('DELETE', `/customers/${c.id}`, { token: b.token })).status, 404);
    const lista = await app.api('GET', '/customers', { token: b.token });
    assert.deepEqual(lista.json, { data: [], total: 0 });
    const buscar = await app.api('GET', '/customers?q=Juan', { token: b.token });
    assert.equal(buscar.json.total, 0);
    assert.equal((await app.api('GET', `/customers/${c.id}`, { token: a.token })).status, 200, 'y A sigue intacto');
  });

  it('un id que no es UUID responde 404, igual que uno ajeno', async () => {
    assert.equal((await app.api('GET', '/customers/no-es-uuid', { token: a.token })).status, 404);
  });

  it('idempotencia: mismo id ⇒ 200 sin duplicar; id de otro usuario ⇒ 409', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const r1 = await app.api('POST', '/customers', { token: a.token, body: { id, ...cli } });
    assert.equal(r1.status, 201);
    const r2 = await app.api('POST', '/customers', { token: a.token, body: { id, ...cli } });
    assert.equal(r2.status, 200);
    assert.equal((await app.api('GET', '/customers', { token: a.token })).json.total, 1);
    const r3 = await app.api('POST', '/customers', { token: b.token, body: { id, ...cli } });
    assert.equal(r3.status, 409);
    assert.equal(r3.json.error.code, 'ID_CONFLICT');
  });

  it('busca por nombre o teléfono, sin distinguir mayúsculas, y los comodines van escapados', async () => {
    await crear(a.token, { ...cli, name: 'Juan Pérez' });
    await crear(a.token, { ...cli, name: 'Descuento 50% oferta', phone: '+56955555555' });
    await crear(a.token, { ...cli, name: 'María', phone: '+56966666666' });
    const q = async (s: string) => (await app.api('GET', `/customers?q=${encodeURIComponent(s)}`, { token: a.token })).json;
    assert.equal((await q('juan')).total, 1);
    assert.equal((await q('5555')).total, 1);
    assert.equal((await q('50%')).total, 1, '"%" se busca literal');
    assert.equal((await q('%')).total, 1, '"%" no es comodín');
    assert.equal((await q('_')).total, 0, '"_" no es comodín');
    const pag = await app.api('GET', '/customers?limit=2&offset=2', { token: a.token });
    assert.equal(pag.json.data.length, 1);
    assert.equal(pag.json.total, 3);
    assert.equal((await app.api('GET', '/customers?limit=500', { token: a.token })).status, 422);
  });

  it('valida: teléfono, nombre, campos desconocidos y user_id no se acepta', async () => {
    const malos: object[] = [
      { ...cli, phone: '912345678' },
      { ...cli, name: '' },
      { ...cli, name: 'x'.repeat(121) },
      { ...cli, email: 'no-es-correo' },
      { ...cli, address: 'x'.repeat(301) },
      { ...cli, user_id: b.user.id },
    ];
    for (const body of malos) assert.equal((await app.api('POST', '/customers', { token: a.token, body })).status, 422, JSON.stringify(body).slice(0, 60));
    assert.equal((await app.api('GET', '/customers', { token: a.token })).json.total, 0);
  });

  it('no se puede borrar un cliente con presupuestos (409) y el resumen los cuenta', async () => {
    const c = await crear();
    await pool.query(`INSERT INTO quotes (user_id, customer_id, short_id) VALUES ($1, $2, '7K4M2Q')`, [a.user.id, c.id]);
    const del = await app.api('DELETE', `/customers/${c.id}`, { token: a.token });
    assert.equal(del.status, 409);
    assert.equal(del.json.error.code, 'CUSTOMER_HAS_QUOTES');
    assert.equal((await app.api('GET', `/customers/${c.id}`, { token: a.token })).json.summary.quotes, 1);
  });

  it('una sesión QUOTE_CODE no accede a clientes ni perfil (403)', async () => {
    const c = await crear();
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO quotes (user_id, customer_id, short_id) VALUES ($1, $2, '7K4M2Q') RETURNING id`, [a.user.id, c.id]);
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, scope, quote_id, expires_at)
       VALUES ($1, encode(sha256('tok-code'), 'hex'), 'QUOTE_CODE', $2, now() + interval '30 minutes')`, [a.user.id, rows[0]!.id]);
    for (const path of ['/customers', `/customers/${c.id}`, '/me']) {
      assert.equal((await app.api('GET', path, { token: 'tok-code' })).status, 403, path);
    }
  });
});
