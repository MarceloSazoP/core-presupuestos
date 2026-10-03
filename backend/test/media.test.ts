import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { sweepOrphans } from '../scripts/sweep-files';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let b: { token: string; user: { id: string } };
let q: { id: string; access_code: string };

const root = () => process.env.STORAGE_DIR!;
const filesOnDisk = (dir = join(root(), 'u')): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesOnDisk(join(dir, e.name)) : [join(dir, e.name)])) : [];
const tmpFiles = () => (existsSync(join(root(), 'tmp')) ? readdirSync(join(root(), 'tmp')) : []);

// Contenidos mínimos con la firma correcta de cada formato.
const JPG = (n = 100) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 1)]);
const PNG = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50, 2)]);
const M4A = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(50, 3)]);
const MP3 = () => Buffer.concat([Buffer.from('ID3'), Buffer.alloc(50, 4)]);
const TXT = () => Buffer.from('esto no es una imagen, aunque se llame .jpg');

describe('API: archivos (Contrato API §4 y §6, Contrato BD §8)', () => {
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
    for (const d of ['u', 'tmp']) rmSync(join(root(), d), { recursive: true, force: true });
    app = await startApp();
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    b = await app.login('+56922222222', 'b@test.cl', 'Beto');
    q = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
  });
  afterEach(async () => {
    await app.close();
  });

  // Estado de una descarga (el cuerpo puede ser binario, así que no pasa por app.api).
  const dlStatus = async (path: string, token: string) => (await fetch(app.base + path, { headers: { Authorization: `Bearer ${token}` } })).status;

  const foto = (token = a.token, file: Buffer = JPG(), fields: Record<string, string> = {}, id = q.id) =>
    app.upload('POST', `/quotes/${id}/photos`, { token, file, fields });
  const voz = (token = a.token, file: Buffer = M4A(), fields: Record<string, string> = { duration_seconds: '42' }, id = q.id) =>
    app.upload('POST', `/quotes/${id}/voice-notes`, { token, file, fields });

  it('sube una foto: queda en el presupuesto, en disco y se descarga con su tipo real', async () => {
    const r = await foto(a.token, JPG(), { caption: 'Tablero' });
    assert.equal(r.status, 201);
    assert.equal(r.json.caption, 'Tablero');
    assert.equal(r.json.url, `/files/${r.json.id}`);
    const detalle = await app.api('GET', `/quotes/${q.id}`, { token: a.token });
    assert.deepEqual(detalle.json.survey.photos.map((p: { id: string }) => p.id), [r.json.id]);
    assert.equal(filesOnDisk().length, 1);
    assert.ok(filesOnDisk()[0]!.includes(`${a.user.id}`) && filesOnDisk()[0]!.endsWith(`${r.json.id}.jpg`), 'ruta u/{usuario}/q/{presupuesto}/{id}.jpg');
    assert.deepEqual(tmpFiles(), [], 'no queda nada en la carpeta temporal');
  });

  it('el tipo sale de los bytes, no de lo que declara el cliente', async () => {
    assert.equal((await foto(a.token, TXT())).status, 415);
    assert.equal((await foto(a.token, M4A())).status, 415, 'audio en una foto');
    assert.equal((await voz(a.token, JPG())).status, 415, 'imagen en una nota de voz');
    assert.equal((await foto(a.token, PNG())).status, 201);
    assert.equal((await voz(a.token, MP3())).status, 201);
    const { rows } = await pool.query('SELECT kind, mime_type FROM files ORDER BY kind');
    assert.deepEqual(rows, [{ kind: 'PHOTO', mime_type: 'image/png' }, { kind: 'VOICE', mime_type: 'audio/mpeg' }]);
    assert.equal((await app.upload('POST', `/quotes/${q.id}/photos`, { token: a.token })).status, 422, 'sin archivo');
    assert.equal(filesOnDisk().length, 2, 'los rechazados no dejan archivos');
    assert.deepEqual(tmpFiles(), []);
  });

  it('límites de tamaño: foto 10 MB y logo 2 MB ⇒ 413, sin dejar basura', async () => {
    assert.equal((await foto(a.token, JPG(10 * 1024 * 1024))).status, 413);
    assert.equal((await app.upload('PUT', '/me/logo', { token: a.token, file: PNG().length ? Buffer.concat([PNG(), Buffer.alloc(2 * 1024 * 1024)]) : PNG() })).status, 413);
    assert.equal((await foto(a.token, JPG(10 * 1024 * 1024 - 100))).status, 201, 'justo bajo el límite pasa');
    assert.deepEqual(tmpFiles(), []);
  });

  it('descarga autenticada: solo el dueño; el usuario B y la sesión sin token reciben 404/401', async () => {
    const f = (await foto()).json;
    const get = (token?: string) => fetch(`${app.base}/files/${f.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const ok = await get(a.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await ok.arrayBuffer()), JPG());
    assert.equal((await get(b.token)).status, 404);
    assert.equal((await get()).status, 401);
    assert.equal((await app.api('GET', '/files/no-es-uuid', { token: a.token })).status, 404);
  });

  it('aislamiento: B no puede subir ni borrar en el presupuesto de A', async () => {
    const f = (await foto()).json;
    assert.equal((await foto(b.token)).status, 404);
    assert.equal((await voz(b.token)).status, 404);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/photos/${f.id}`, { token: b.token })).status, 404);
    assert.equal(filesOnDisk().length, 1);
    assert.deepEqual(tmpFiles(), [], 'ni siquiera se recibió el archivo ajeno');
  });

  it('sesión del código: sube y lee los archivos de su presupuesto, pero no el logo ni los de otro', async () => {
    const otro = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'O', phone: '+56944444444' } } })).json;
    const ajena = (await foto(a.token, JPG(), {}, otro.id)).json;
    await app.upload('PUT', '/me/logo', { token: a.token, file: PNG() });
    const logoId = (await pool.query('SELECT logo_file_id AS id FROM users WHERE id = $1', [a.user.id])).rows[0].id;
    const t = (await app.api('POST', '/access/code/exchange', { body: { code: q.access_code } })).json.token;
    const suya = await foto(t);
    assert.equal(suya.status, 201);
    assert.equal(await dlStatus(`/files/${suya.json.id}`, t), 200);
    assert.equal(await dlStatus(`/files/${ajena.id}`, t), 404);
    assert.equal(await dlStatus(`/files/${logoId}`, t), 404);
    assert.equal((await app.upload('PUT', '/me/logo', { token: t, file: PNG() })).status, 403);
    assert.equal((await foto(t, JPG(), {}, otro.id)).status, 404);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/photos/${suya.json.id}`, { token: t })).status, 204);
  });

  it('un presupuesto finalizado no recibe ni pierde archivos (409)', async () => {
    const f = (await foto()).json;
    await pool.query(`UPDATE quotes SET doc_status='FINALIZED', number='CP-2026-0001', finalized_at=now(), service_description='x', validity_days=15 WHERE id=$1`, [q.id]);
    assert.equal((await foto()).status, 409);
    assert.equal((await voz()).status, 409);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/photos/${f.id}`, { token: a.token })).status, 409);
    assert.equal(filesOnDisk().length, 1);
  });

  it('máximo 30 fotos y 5 notas de voz; el rechazado no deja archivo', async () => {
    for (let i = 0; i < 30; i++) assert.equal((await foto(a.token, JPG(10))).status, 201, `foto ${i + 1}`);
    const r = await foto(a.token, JPG(10));
    assert.equal(r.status, 422);
    assert.match(r.json.error.details[0].message, /30 fotos/);
    for (let i = 0; i < 5; i++) assert.equal((await voz()).status, 201);
    assert.equal((await voz()).status, 422);
    assert.equal(filesOnDisk().length, 35, 'el archivo del intento rechazado se borró');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM files')).rows[0].n, 35);
    assert.deepEqual(tmpFiles(), []);
  });

  it('idempotencia: mismo id ⇒ 200 sin duplicar; id usado en otro presupuesto ⇒ 409', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    assert.equal((await foto(a.token, JPG(), { id })).status, 201);
    const otra = await foto(a.token, JPG(), { id });
    assert.equal(otra.status, 200);
    assert.equal(otra.json.id, id);
    assert.equal(filesOnDisk().length, 1);
    const q2 = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'O', phone: '+56944444444' } } })).json;
    assert.equal((await foto(a.token, JPG(), { id }, q2.id)).status, 409);
    assert.deepEqual(tmpFiles(), []);
  });

  it('notas de voz: duración entre 1 y 300 s', async () => {
    for (const d of ['0', '301', '1.5', 'x']) assert.equal((await voz(a.token, M4A(), { duration_seconds: d })).status, 422, d);
    assert.equal((await voz(a.token, M4A(), {})).status, 422);
    const ok = await voz(a.token, M4A(), { duration_seconds: '300' });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.duration_seconds, 300);
    assert.equal((await app.upload('POST', `/quotes/${q.id}/photos`, { token: a.token, file: JPG(), fields: { otro: 'campo' } })).status, 422, 'campos desconocidos');
    assert.deepEqual(tmpFiles(), []);
  });

  it('borrar una foto elimina la fila y el archivo; borrar el presupuesto elimina todos', async () => {
    const f1 = (await foto()).json;
    await foto();
    await voz();
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/photos/${f1.id}`, { token: a.token })).status, 204);
    assert.equal(filesOnDisk().length, 2);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}/photos/${f1.id}`, { token: a.token })).status, 404);
    assert.equal((await app.api('DELETE', `/quotes/${q.id}`, { token: a.token })).status, 204);
    assert.deepEqual(filesOnDisk(), []);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM files')).rows[0].n, 0);
  });

  it('logo y firma: reemplazan al anterior (borrando su archivo), se quitan y no son de otros', async () => {
    const put = (path: string, file: Buffer, token = a.token) => app.upload('PUT', path, { token, file });
    assert.equal((await put('/me/logo', PNG())).json.has_logo, true);
    assert.equal((await put('/me/signature', JPG())).json.has_signature, true);
    assert.equal(filesOnDisk().length, 2);
    const antes = filesOnDisk().find((f) => f.endsWith('.png'));
    assert.equal((await put('/me/logo', JPG())).status, 200);
    assert.equal(existsSync(antes!), false, 'el logo anterior se borró del disco');
    assert.equal(filesOnDisk().length, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM files')).rows[0].n, 2);
    assert.equal((await put('/me/logo', M4A())).status, 415, 'un logo no puede ser audio');
    assert.equal((await app.api('DELETE', '/me/logo', { token: a.token })).status, 204);
    assert.equal((await app.api('GET', '/me', { token: a.token })).json.has_logo, false);
    assert.equal((await app.api('GET', '/me', { token: a.token })).json.has_signature, true);
    assert.equal(filesOnDisk().length, 1);
    assert.equal((await app.api('GET', '/me', { token: b.token })).json.has_signature, false, 'B no ve lo de A');
    assert.equal((await app.api('DELETE', '/me/logo', { token: a.token })).status, 204, 'borrar sin logo no falla');
  });

  it('sweep-files borra solo los huérfanos con más de 1 hora y respeta los que tienen fila', async () => {
    const conFila = (await foto()).json;
    const dir = join(root(), 'u', a.user.id, 'q', q.id);
    mkdirSync(dir, { recursive: true });
    const viejo = join(dir, 'huerfano-viejo.jpg');
    const nuevo = join(dir, 'huerfano-nuevo.jpg');
    writeFileSync(viejo, JPG());
    writeFileSync(nuevo, JPG());
    const haceDosHoras = new Date(Date.now() - 2 * 3_600_000);
    utimesSync(viejo, haceDosHoras, haceDosHoras);
    const barridos = await sweepOrphans();
    assert.deepEqual(barridos.map((k) => k.split('/').pop()), ['huerfano-viejo.jpg']);
    assert.equal(existsSync(viejo), false);
    assert.equal(existsSync(nuevo), true, 'uno reciente puede estar subiéndose ahora mismo');
    assert.equal((await app.api('GET', `/quotes/${q.id}`, { token: a.token })).json.survey.photos[0].id, conFila.id);
    assert.equal(filesOnDisk().filter((f) => f.endsWith(`${conFila.id}.jpg`)).length, 1, 'el que tiene fila sigue ahí');
  });
});
