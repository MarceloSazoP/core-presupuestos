import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };

describe('API: perfil y datos de contacto (Contrato API §4 y BD §16)', () => {
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
  });
  afterEach(async () => {
    await app.close();
  });

  const put = (body: object) => app.api('PUT', '/me', { token: a.token, body });

  it('cambia nombre y contacto sin tocar la cuenta; lo no enviado se conserva y null vuelve a los de la cuenta', async () => {
    const r = await put({ name: 'Instalaciones R. Sazo', contact_phone: '+56988887777', contact_email: 'Contacto@Sazo.cl' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual([r.json.name, r.json.phone, r.json.email, r.json.contact_phone, r.json.contact_email], ['Instalaciones R. Sazo', '+56911111111', 'a@test.cl', '+56988887777', 'contacto@sazo.cl']);
    const solo = await put({ contact_phone: null });
    assert.deepEqual([solo.json.name, solo.json.contact_phone, solo.json.contact_email], ['Instalaciones R. Sazo', null, 'contacto@sazo.cl'], 'lo no enviado no cambia');
    assert.deepEqual([(await app.api('GET', '/me', { token: a.token })).json.contact_phone], [null]);
  });

  it('rechaza lo inválido y lo que no se puede cambiar: nada a medias', async () => {
    for (const mal of [{}, { contact_phone: '912345678' }, { contact_email: 'no-es-correo' }, { phone: '+56900000000' }, { email: 'otro@x.cl' }, { name: '' }, { contact_phone: '+56988887777', extra: 1 }]) {
      assert.equal((await put(mal)).status, 422, JSON.stringify(mal));
    }
    const { rows } = await pool.query('SELECT name, phone, email, contact_phone, contact_email FROM users WHERE id = $1', [a.user.id]);
    assert.deepEqual(rows[0], { name: 'Ana', phone: '+56911111111', email: 'a@test.cl', contact_phone: null, contact_email: null });
  });

  it('los presupuestos muestran el contacto configurado; uno ya terminado conserva el que tenía', async () => {
    const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
    assert.deepEqual([q.professional.phone, q.professional.email], ['+56911111111', 'a@test.cl'], 'sin configurar: los de la cuenta');
    await put({ name: 'Instalaciones R. Sazo', contact_phone: '+56988887777', contact_email: 'contacto@sazo.cl' });
    const detalle = (await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json;
    assert.deepEqual([detalle.professional.name, detalle.professional.phone, detalle.professional.email], ['Instalaciones R. Sazo', '+56988887777', 'contacto@sazo.cl']);

    await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { service_description: 'Instalar puerta', validity_days: 15 } });
    await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit_price: 1000 }] } });
    const fin = await app.api('POST', `/quotes/${q.id}/finalize`, { token: a.token, body: {} });
    assert.equal(fin.status, 200, JSON.stringify(fin.json));
    const token = fin.json.public_url.split('/q/')[1];
    const vista = async () => (await (await fetch(`${app.base}/public/quotes/${token}`)).json()).professional;
    assert.deepEqual([(await vista()).name, (await vista()).phone, (await vista()).email], ['Instalaciones R. Sazo', '+56988887777', 'contacto@sazo.cl']);

    await put({ name: 'Otro nombre', contact_phone: '+56900000001', contact_email: null });
    assert.deepEqual([(await vista()).name, (await vista()).phone, (await vista()).email], ['Instalaciones R. Sazo', '+56988887777', 'contacto@sazo.cl'], 'lo ya enviado no cambia');
  });

  it('el logo propio se sube, se descarga y se quita; sin logo responde 404', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    assert.equal((await app.api('GET', '/me/logo', { token: a.token })).status, 404);
    const subida = await app.upload('PUT', '/me/logo', { token: a.token, file: png });
    assert.equal(subida.status, 200);
    assert.equal(subida.json.has_logo, true);
    assert.match(subida.json.logo_id, /^[0-9a-f-]{36}$/);
    assert.equal(subida.json.signature_id, null);
    const otra = await app.upload('PUT', '/me/logo', { token: a.token, file: png });
    assert.notEqual(otra.json.logo_id, subida.json.logo_id, 'cada logo nuevo cambia logo_id (para romper la caché de las apps)');
    const bajada = await fetch(`${app.base}/me/logo`, { headers: { Authorization: `Bearer ${a.token}` } });
    assert.equal(bajada.status, 200);
    assert.equal(bajada.headers.get('content-type'), 'image/png');
    assert.equal((await fetch(`${app.base}/me/logo`)).status, 401, 'sin sesión no se descarga');
    assert.equal((await app.api('DELETE', '/me/logo', { token: a.token })).status, 204);
    assert.equal((await app.api('GET', '/me/logo', { token: a.token })).status, 404);
  });

  it('un interruptor por imagen: se puede encender sin imagen, subirla lo enciende, apagado no se usa en ningún presupuesto y encendido en todos', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const inicial = (await app.api('GET', '/me', { token: a.token })).json;
    assert.deepEqual([inicial.use_logo, inicial.include_signature], [false, false]);
    const sinImagen = await put({ use_logo: true, include_signature: true });
    assert.equal(sinImagen.status, 200, 'encender no exige tener ya la imagen');
    assert.deepEqual([sinImagen.json.use_logo, sinImagen.json.include_signature, sinImagen.json.has_logo, sinImagen.json.has_signature], [true, true, false, false]);
    await put({ use_logo: false, include_signature: false });
    const subida = await app.upload('PUT', '/me/logo', { token: a.token, file: png });
    assert.equal(subida.json.use_logo, true, 'subir el logo enciende su interruptor');
    assert.equal(subida.json.include_signature, false, 'y no el de la firma');
    assert.equal((await app.upload('PUT', '/me/signature', { token: a.token, file: png })).json.include_signature, true);

    const terminar = async () => {
      const q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
      await app.api('PATCH', `/quotes/${q.id}`, { token: a.token, body: { service_description: 'Instalar puerta', validity_days: 15 } });
      await app.api('PUT', `/quotes/${q.id}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit_price: 1000 }] } });
      assert.equal((await app.api('POST', `/quotes/${q.id}/finalize`, { token: a.token, body: {} })).status, 200);
      const snap = (await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [q.id])).rows[0].snapshot;
      return { id: q.id as string, snap };
    };
    const conAmbas = await terminar();
    assert.ok(conAmbas.snap.professional.logo_file_id && conAmbas.snap.professional.signature_file_id, 'encendidas: las dos imágenes quedan fijadas');
    assert.equal(conAmbas.snap.include_signature, true);

    await put({ use_logo: false, include_signature: false });
    const detalle = await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Pedro', phone: '+56933333339' } } });
    assert.equal(detalle.json.professional.has_logo, false, 'con el interruptor apagado el presupuesto no muestra logo');
    const sinAmbas = await terminar();
    assert.deepEqual([sinAmbas.snap.professional.logo_file_id, sinAmbas.snap.professional.signature_file_id, sinAmbas.snap.include_signature], [null, null, false], 'apagadas: en ningún presupuesto nuevo');
    assert.equal((await app.api('GET', '/me', { token: a.token })).json.has_logo, true, 'la imagen subida se conserva');
    assert.equal((await fetch(`${app.base}/quotes/${detalle.json.id}/logo`, { headers: { Authorization: `Bearer ${a.token}` } })).status, 404, 'y no se sirve en un presupuesto en edición');
    const anterior = (await pool.query('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [conAmbas.id])).rows[0].snapshot;
    assert.deepEqual(anterior, conAmbas.snap, 'lo ya terminado no cambió');

    assert.equal((await app.api('DELETE', '/me/signature', { token: a.token })).status, 204);
    await put({ include_signature: true });
    assert.equal((await app.api('DELETE', '/me/signature', { token: a.token })).status, 204);
    assert.equal((await app.api('GET', '/me', { token: a.token })).json.include_signature, true, 'borrar la imagen no apaga el interruptor');
    const algunId = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Borrador', phone: '+56933333330' } } })).json.id;
    assert.equal((await app.api('PATCH', `/quotes/${algunId}`, { token: a.token, body: { include_signature: true } })).status, 422, 'ya no se elige por presupuesto');
  });
});
