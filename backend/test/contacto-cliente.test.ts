import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };

describe('API: corregir el teléfono y el correo del cliente (Contrato API §6)', () => {
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
    for (const d of ['u', 'tmp']) rmSync(join(process.env.STORAGE_DIR!, d), { recursive: true, force: true });
    app = await startApp();
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    b = await app.login('+56922222222', 'b@test.cl', 'Beto');
  });
  afterEach(async () => {
    await app.close();
  });

  const crear = async (customer: object = { name: 'Juan Pérez', phone: '+56933333333', email: 'juan@mal.cl' }) =>
    (await app.api('POST', '/quotes', { token: a.token, body: { customer } })).json as { id: string; customer: { id: string } };
  const corregir = (id: string, body: object, token = a.token) => app.api('PATCH', `/quotes/${id}/customer`, { token, body });
  const terminar = async (id: string) => {
    await app.api('PATCH', `/quotes/${id}`, { token: a.token, body: { service_description: 'Instalar puerta', validity_days: 15 } });
    await app.api('PUT', `/quotes/${id}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit_price: 1000 }] } });
    return app.api('POST', `/quotes/${id}/finalize`, { token: a.token, body: {} });
  };

  it('corrige teléfono y correo (y el correo puede quedar vacío); lo no enviado no cambia', async () => {
    const q = await crear();
    const r = await corregir(q.id, { phone: '+56988887777', email: 'JUAN@bien.cl' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual([r.json.customer.name, r.json.customer.phone, r.json.customer.email], ['Juan Pérez', '+56988887777', 'juan@bien.cl']);
    const solo = await corregir(q.id, { email: null });
    assert.deepEqual([solo.json.customer.phone, solo.json.customer.email], ['+56988887777', null]);
  });

  it('rechaza lo inválido y lo que no corresponde, sin cambiar nada', async () => {
    const q = await crear();
    for (const mal of [{}, { phone: '912345678' }, { email: 'no-es-correo' }, { name: '' }, { customer_id: 'x' }, { phone: '+56988887777', extra: 1 }]) {
      assert.equal((await corregir(q.id, mal)).status, 422, JSON.stringify(mal));
    }
    const { rows } = await pool.query('SELECT phone, email FROM customers WHERE id = $1', [q.customer.id]);
    assert.deepEqual(rows[0], { phone: '+56933333333', email: 'juan@mal.cl' });
  });

  it('con el presupuesto terminado el teléfono, el correo y el nombre se siguen corrigiendo, y lo ya emitido (snapshot) no cambia', async () => {
    const q = await crear();
    const fin = await terminar(q.id);
    assert.equal(fin.status, 200, JSON.stringify(fin.json));
    const antes = (await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [q.id])).rows[0].snapshot;
    const r = await corregir(q.id, { phone: '+56977776666', email: 'nuevo@cliente.cl' });
    assert.equal(r.status, 200);
    assert.equal(r.json.doc_status, 'FINALIZED');
    const nombre = await corregir(q.id, { name: 'Otro Nombre' });
    assert.equal(nombre.status, 200);
    assert.equal(nombre.json.customer.name, 'Otro Nombre');
    const despues = (await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [q.id])).rows[0].snapshot;
    assert.deepEqual(despues, antes, 'el snapshot no cambia: el documento emitido conserva el nombre con que salió');
    // el siguiente correo usa el dato corregido
    const envio = await app.api('POST', `/quotes/${q.id}/send-email`, { token: a.token, body: {} });
    assert.equal(envio.status, 200);
    assert.equal(app.mails.at(-1)!.to, 'nuevo@cliente.cl');
  });

  it('el nombre sí se cambia mientras se edita, y el cambio vale para todos los presupuestos del cliente', async () => {
    const c = (await app.api('POST', '/customers', { token: a.token, body: { name: 'Juan', phone: '+56933333333' } })).json;
    const q1 = (await app.api('POST', '/quotes', { token: a.token, body: { customer_id: c.id } })).json;
    const q2 = (await app.api('POST', '/quotes', { token: a.token, body: { customer_id: c.id } })).json;
    assert.equal((await corregir(q1.id, { name: 'Juan Soto', phone: '+56900001111' })).status, 200);
    const otro = (await app.api('GET', `/quotes/${q2.id}`, { token: a.token })).json;
    assert.deepEqual([otro.customer.name, otro.customer.phone], ['Juan Soto', '+56900001111']);
  });

  it('con el código del presupuesto también se corrige (solo al cliente de ese presupuesto); otro usuario recibe 404', async () => {
    const q = await crear();
    const otroCliente = await crear({ name: 'Pedro', phone: '+56944444444' });
    const codigo = (await app.api('POST', `/quotes/${q.id}/access-code`, { token: a.token, body: {} })).json.code;
    const ses = (await app.api('POST', '/access/code/exchange', { body: { code: codigo } })).json.token;
    assert.equal((await corregir(q.id, { phone: '+56955556666' }, ses)).status, 200);
    assert.equal((await corregir(otroCliente.id, { phone: '+56955556666' }, ses)).status, 404, 'no toca a otro presupuesto');
    assert.equal((await corregir(q.id, { phone: '+56955557777' }, b.token)).status, 404, 'otro usuario');
    assert.equal((await pool.query('SELECT phone FROM customers WHERE id = $1', [otroCliente.customer.id])).rows[0].phone, '+56944444444');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE event = 'CUSTOMER_CONTACT_UPDATED'")).rows[0].n, 1);
  });
});
