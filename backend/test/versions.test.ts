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

describe('API: versiones de un presupuesto rechazado (Contrato API §6 y BD §15)', () => {
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

  // Presupuesto terminado y enviado, listo para marcarlo como rechazado o aceptado.
  const enviado = async () => {
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan Pérez', phone: '+56933333333' }, address: 'Av. X 1234' } })).json;
    await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { service_description: 'Instalar puerta', validity_days: 15, warranty: { kind: 'M3' }, discount: 1000, include_vat: true, observations: 'Pago contra entrega' } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit: 'un', unit_price: 50000 }, { kind: 'TASK', description: 'Botar escombros', unit_price: 5000 }] } });
    await app.api('PUT', `/quotes/${q.id}/measurements`, { token: a.token, body: { measurements: [{ label: 'Alto', value: '2 m' }] } });
    await app.api('PUT', `/quotes/${q.id}/survey`, { token: a.token, body: { notes: 'Marco torcido' } });
    assert.equal((await app.api('POST', `/quotes/${q.id}/finalize`, { token: a.token, body: {} })).status, 200);
    assert.equal((await app.api('POST', `/quotes/${q.id}/mark-sent`, { token: a.token, body: { channel: 'LINK' } })).status, 200);
    return q.id as string;
  };
  const estado = (id: string, status: string, token = a.token) => app.api('PUT', `/quotes/${id}/commercial-status`, { token, body: { status } });
  const rehacer = (id: string, token = a.token, body?: object) => app.api('POST', `/quotes/${id}/revise`, { token, body: body ?? {} });

  it('solo un rechazado se rehace; los demás estados responden 409', async () => {
    const id = await enviado();
    for (const s of ['SENT', 'FOLLOW_UP', 'ACCEPTED']) {
      await estado(id, s);
      assert.equal((await rehacer(id)).status, 409, s);
    }
    const borrador = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'X', phone: '+56933333334' } } })).json.id;
    assert.equal((await rehacer(borrador)).json.error.code, 'INVALID_STATE', 'un borrador no es rechazado');
  });

  it('crea la versión 2: copia lo que se vuelve a trabajar, no las fotos ni el seguimiento, y deja el original intacto', async () => {
    const id = await enviado();
    await estado(id, 'REJECTED');
    const original = (await app.api('GET', `/quotes/${id}`, { token: a.token })).json;
    const r = await rehacer(id);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const v2 = r.json;
    assert.deepEqual([v2.version, v2.previous_number, v2.doc_status, v2.commercial_status, v2.number], [2, original.number, 'DRAFT', 'NONE', null]);
    assert.match(v2.access_code, /^[0-9A-HJKMNP-TV-Z]{6}-[0-9A-HJKMNP-TV-Z]{10}$/);
    assert.notEqual(v2.code_id, original.code_id, 'tiene su propio código');
    assert.equal(v2.customer.id, original.customer.id);
    assert.deepEqual([v2.service_description, v2.address, v2.observations, v2.warranty.kind, v2.validity_days], ['Instalar puerta', 'Av. X 1234', 'Pago contra entrega', 'M3', 15]);
    assert.deepEqual([v2.subtotal, v2.discount, v2.include_vat, v2.vat, v2.total], [original.subtotal, 1000, true, original.vat, original.total], 'descuento e IVA se conservan');
    assert.deepEqual(v2.items.map((i: { kind: string; description: string; line_total: number }) => [i.kind, i.description, i.line_total]), [['ITEM', 'Puerta', 50000], ['TASK', 'Botar escombros', 5000]]);
    assert.notEqual(v2.items[0].id, original.items[0].id, 'las líneas son nuevas');
    assert.deepEqual([v2.survey.notes, v2.survey.measurements.map((m: { label: string }) => m.label), v2.survey.photos, v2.survey.voice_notes], ['Marco torcido', ['Alto'], [], []]);
    assert.equal(v2.public_url, null);
    assert.deepEqual([v2.next_version_id], [null]);
    // el original no cambió, salvo que ahora dice cuál lo reemplazó
    const despues = (await app.api('GET', `/quotes/${id}`, { token: a.token })).json;
    assert.deepEqual([despues.doc_status, despues.commercial_status, despues.number, despues.version, despues.next_version_id], ['FINALIZED', 'REJECTED', original.number, 1, v2.id]);
    assert.equal(despues.total, original.total);
  });

  it('se rehace una sola vez (ALREADY_REVISED con el id de la versión) y el reintento con el mismo id no duplica', async () => {
    const id = await enviado();
    await estado(id, 'REJECTED');
    const nuevoId = crypto.randomUUID();
    const r1 = await rehacer(id, a.token, { id: nuevoId });
    assert.equal(r1.status, 201);
    assert.equal(r1.json.id, nuevoId);
    const reintento = await rehacer(id, a.token, { id: nuevoId });
    assert.equal(reintento.status, 200, 'reintento seguro');
    assert.equal(reintento.json.access_code, undefined, 'el secreto no se vuelve a leer');
    const otra = await rehacer(id);
    assert.equal(otra.status, 409);
    assert.equal(otra.json.error.code, 'ALREADY_REVISED');
    assert.equal(otra.json.error.details[0].message, nuevoId);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM quotes WHERE parent_quote_id = $1', [id])).rows[0].n, 1);
  });

  it('la versión 2 se termina como cualquier presupuesto y lo dice en el snapshot y la vista pública; la 3 sube de 1 en 1', async () => {
    const id = await enviado();
    await estado(id, 'REJECTED');
    const v1 = (await app.api('GET', `/quotes/${id}`, { token: a.token })).json;
    const v2 = (await rehacer(id)).json;
    const fin = await app.api('POST', `/quotes/${v2.id}/finalize`, { token: a.token, body: {} });
    assert.equal(fin.status, 200, JSON.stringify(fin.json));
    assert.notEqual(fin.json.number, v1.number, 'cada versión tiene su número');
    const { rows } = await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [v2.id]);
    assert.deepEqual([rows[0].snapshot.version, rows[0].snapshot.previous_number], [2, v1.number]);
    const pub = await (await fetch(`${app.base}/public/quotes/${fin.json.public_url.split('/q/')[1]}`)).json();
    assert.deepEqual([pub.version, pub.previous_number, pub.number], [2, v1.number, fin.json.number]);
    const original = await (await fetch(`${app.base}/public/quotes/${(await pool.query("SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC'", [id])).rows[0].token}`)).json();
    assert.deepEqual([original.version, original.previous_number], [1, null], 'la versión 1 no dice nada extra');

    await app.api('POST', `/quotes/${v2.id}/mark-sent`, { token: a.token, body: { channel: 'LINK' } });
    await estado(v2.id, 'REJECTED');
    const v3 = await rehacer(v2.id);
    assert.equal(v3.status, 201);
    assert.deepEqual([v3.json.version, v3.json.previous_number], [3, fin.json.number]);
  });

  it('el listado trae la versión y solo el dueño puede rehacer, con sesión de usuario', async () => {
    const id = await enviado();
    await estado(id, 'REJECTED');
    assert.equal((await rehacer(id, b.token)).status, 404, 'otro usuario');
    const codigo = (await app.api('POST', `/quotes/${id}/access-code`, { token: a.token, body: {} })).json.code;
    const ses = (await app.api('POST', '/access/code/exchange', { body: { code: codigo } })).json.token;
    assert.equal((await rehacer(id, ses)).status, 403, 'la sesión del código no rehace');
    const v2 = (await rehacer(id)).json;
    const lista = (await app.api('GET', '/quotes', { token: a.token })).json.data;
    assert.deepEqual(lista.map((q: { id: string; version: number }) => [q.id, q.version]).sort(), [[id, 1], [v2.id, 2]].sort());
    await assert.rejects(pool.query('UPDATE quotes SET version = 5 WHERE id = $1', [id]), /quotes_version_parent_check/, 'versión > 1 sin padre');
    await assert.rejects(pool.query('UPDATE quotes SET parent_quote_id = $1 WHERE id = $2', [id, (await enviado())]), /./, 'dos hijos del mismo padre o versión incoherente');
  });
});
