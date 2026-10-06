import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { pathOf } from '../src/lib/storage';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('API: exportar mis datos y eliminar la cuenta (Exportar y eliminar la cuenta.md)', () => {
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
    app.mails.length = 0; // el QR del registro no es parte de lo que se prueba
  });
  afterEach(async () => {
    await app.close();
  });

  const conPresupuesto = async () => {
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan Soto', phone: '+56933333333', email: 'juan@mail.cl' }, service_description: 'Instalar enchufes', address: 'Av. X 123', latitude: -33.42, longitude: -70.61 } })).json;
    await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Enchufe', quantity: 4, unit: 'un', unit_price: 5000 }] } });
    await app.api('PUT', `/quotes/${q.id}/survey`, { token: a.token, body: { notes: 'Casa de dos pisos' } });
    return q as { id: string };
  };

  it('exportar manda al correo de la cuenta un Excel con los datos del usuario', async () => {
    await conPresupuesto();
    const r = await app.api('POST', '/me/export', { token: a.token });
    assert.equal(r.status, 202);
    assert.match(r.json.destination_masked, /^a\*\*\*@test\.cl$/);
    const m = app.mails.at(-1)!;
    assert.equal(m.to, 'a@test.cl');
    assert.match(m.attachment.filename, /^corepresupuesto-mis-datos-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(m.attachment.content as unknown as ArrayBuffer);
    assert.deepEqual(wb.worksheets.map((w) => w.name), ['Cuenta', 'Clientes', 'Presupuestos', 'Ítems', 'Visita', 'Medidas', 'Seguimiento']);
    assert.equal(wb.getWorksheet('Clientes')!.getRow(2).getCell(1).value, 'Juan Soto');
    assert.equal(wb.getWorksheet('Presupuestos')!.getRow(2).getCell(6).value, 'Instalar enchufes');
    assert.equal(wb.getWorksheet('Ítems')!.getRow(2).getCell(4).value, 'Enchufe');
    assert.equal(wb.getWorksheet('Visita')!.getRow(2).getCell(2).value, 'Casa de dos pisos');
  });

  it('exportar tiene tope por hora y sin sesión no se puede', async () => {
    assert.equal((await app.api('POST', '/me/export')).status, 401);
    for (let i = 0; i < 3; i++) assert.equal((await app.api('POST', '/me/export', { token: a.token })).status, 202);
    assert.equal((await app.api('POST', '/me/export', { token: a.token })).status, 429);
  });

  it('eliminar pide un código al correo; uno incorrecto o malformado no borra nada y al quinto fallo se invalida', async () => {
    await app.api('POST', '/me/delete-request', { token: a.token });
    const code = app.sent.at(-1)!.code;
    assert.equal(app.sent.at(-1)!.destination, 'a@test.cl');
    assert.equal(app.sent.at(-1)!.channel, 'EMAIL');
    assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code: 'abc' } })).status, 422, 'no son 6 dígitos');
    assert.equal((await app.api('POST', '/me/delete', { token: a.token })).status, 422, 'sin código');
    const mal = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code: mal } })).json.error.code, 'CODE_INVALID');
    assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code: mal } })).status, 429, 'el quinto intento invalida el código');
    assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code } })).status, 422, 'ya ni el código bueno sirve: hay que pedir otro');
    assert.equal((await app.api('GET', '/me', { token: a.token })).status, 200, 'la cuenta sigue ahí');
  });

  it('un código nuevo invalida el anterior y sin pedir código no se elimina', async () => {
    assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code: '123456' } })).status, 422);
    await app.api('POST', '/me/delete-request', { token: a.token });
    const primero = app.sent.at(-1)!.code;
    await app.api('POST', '/me/delete-request', { token: a.token });
    const segundo = app.sent.at(-1)!.code;
    if (primero !== segundo) assert.equal((await app.api('POST', '/me/delete', { token: a.token, body: { code: primero } })).status, 422, 'el primero ya no vale');
    assert.equal((await app.api('GET', '/me', { token: a.token })).status, 200);
  });

  it('pedir códigos de eliminación tiene tope por hora', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await app.api('POST', '/me/delete-request', { token: a.token })).status, 202);
    assert.equal((await app.api('POST', '/me/delete-request', { token: a.token })).status, 429);
  });

  it('con el código correcto se elimina todo: presupuestos, clientes, archivos, sesiones; la auditoría queda sin usuario', async () => {
    const q = await conPresupuesto();
    const logo = await app.upload('PUT', '/me/logo', { token: a.token, file: PNG });
    assert.equal(logo.status, 200);
    const claves = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM files WHERE user_id = $1', [a.user.id])).rows.map((f) => f.storage_key);
    assert.ok(claves.length > 0 && claves.every((k) => existsSync(pathOf(k))), 'el logo está en el disco');

    const pedido = await app.api('POST', '/me/delete-request', { token: a.token });
    assert.equal(pedido.status, 202);
    assert.equal(pedido.json.expires_in_seconds, 600);
    const r = await app.api('POST', '/me/delete', { token: a.token, body: { code: app.sent.at(-1)!.code } });
    assert.equal(r.status, 204);

    assert.equal((await app.api('GET', '/me', { token: a.token })).status, 401, 'la sesión ya no existe');
    for (const t of ['users', 'customers', 'quotes', 'files', 'sessions', 'recovery_tokens', 'account_deletion_codes']) {
      const col = t === 'users' ? 'id' : 'user_id';
      assert.equal((await pool.query(`SELECT 1 FROM ${t} WHERE ${col} = $1`, [a.user.id])).rowCount, 0, `${t} quedó vacía`);
    }
    assert.equal((await pool.query('SELECT 1 FROM quotes WHERE id = $1', [q.id])).rowCount, 0);
    assert.ok(claves.every((k) => !existsSync(pathOf(k))), 'los archivos se quitaron del disco');
    const audit = (await pool.query(`SELECT user_id FROM audit_events WHERE event = 'ACCOUNT_DELETED'`)).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].user_id, null, 'la auditoría no guarda quién fue');
  });
});
