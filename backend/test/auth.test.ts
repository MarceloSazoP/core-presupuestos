import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
const PHONE = '+56911111111';
const start = (body: object = {}) =>
  app.api('POST', '/auth/start', { body: { phone: PHONE, name: 'Pedro', email: 'pedro@test.cl', channel: 'EMAIL', ...body } });

describe('API: autenticación (Contrato API §3 y §14)', () => {
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
  });
  afterEach(async () => {
    await app.close();
  });

  it('registro completo: código → token → /me → logout revoca la sesión', async () => {
    const s = await start();
    assert.equal(s.status, 202);
    assert.deepEqual(Object.keys(s.json).sort(), ['challenge_id', 'destination_masked', 'expires_in_seconds']);
    assert.equal(s.json.destination_masked, 'p***@test.cl');
    const v = await app.api('POST', '/auth/verify', { body: { challenge_id: s.json.challenge_id, code: app.sent[0]!.code } });
    assert.equal(v.status, 200);
    assert.equal(v.json.is_new_user, true);
    assert.equal(v.json.user.phone, PHONE);
    const me = await app.api('GET', '/me', { token: v.json.token });
    assert.equal(me.status, 200);
    assert.equal(me.json.name, 'Pedro');
    assert.equal((await app.api('POST', '/auth/logout', { token: v.json.token })).status, 204);
    assert.equal((await app.api('GET', '/me', { token: v.json.token })).status, 401);
  });

  it('cuenta existente: el código va al contacto guardado y la respuesta tiene la misma forma', async () => {
    const nueva = await start();
    await app.api('POST', '/auth/verify', { body: { challenge_id: nueva.json.challenge_id, code: app.sent[0]!.code } });
    const otra = await start({ name: 'Intruso', email: 'intruso@evil.cl' });
    assert.equal(otra.status, 202);
    assert.deepEqual(Object.keys(otra.json).sort(), Object.keys(nueva.json).sort());
    assert.equal(app.sent[1]!.destination, 'pedro@test.cl', 'nunca al correo enviado en la petición');
    assert.equal(otra.json.destination_masked, 'p***@test.cl');
    const v = await app.api('POST', '/auth/verify', { body: { challenge_id: otra.json.challenge_id, code: app.sent[1]!.code } });
    assert.equal(v.json.is_new_user, false);
    assert.equal(v.json.user.email, 'pedro@test.cl');
    assert.equal(v.json.user.name, 'Pedro');
  });

  it('el código es de un solo uso y el intento 6 falla aunque sea el correcto', async () => {
    const s = await start();
    const code = app.sent[0]!.code;
    const mal = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      assert.equal((await app.api('POST', '/auth/verify', { body: { challenge_id: s.json.challenge_id, code: mal } })).status, 401);
    }
    assert.equal((await app.api('POST', '/auth/verify', { body: { challenge_id: s.json.challenge_id, code } })).status, 401);

    const s2 = await start({ phone: '+56922222222', email: 'otro@test.cl' });
    const ok = { challenge_id: s2.json.challenge_id, code: app.sent[1]!.code };
    assert.equal((await app.api('POST', '/auth/verify', { body: ok })).status, 200);
    assert.equal((await app.api('POST', '/auth/verify', { body: ok })).status, 401, 'reusar el código');
  });

  it('un código vencido no sirve', async () => {
    const s = await start();
    await pool.query(`UPDATE auth_challenges SET expires_at = now() - interval '1 second'`);
    assert.equal((await app.api('POST', '/auth/verify', { body: { challenge_id: s.json.challenge_id, code: app.sent[0]!.code } })).status, 401);
  });

  it('máximo 3 códigos por teléfono por hora (429 con Retry-After)', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await start()).status, 202);
    const r = await start();
    assert.equal(r.status, 429);
    assert.equal(r.json.error.code, 'RATE_LIMITED');
    assert.ok(r.headers.get('retry-after'));
  });

  it('límite por IP en /auth/start', async () => {
    await app.close();
    app = await startApp({ ipStartLimit: 2 });
    assert.equal((await start({ phone: '+56911111111' })).status, 202);
    assert.equal((await start({ phone: '+56922222222', email: 'b@test.cl' })).status, 202);
    assert.equal((await start({ phone: '+56933333333', email: 'c@test.cl' })).status, 429);
  });

  it('valida el borde: campos desconocidos, teléfono, canal y JSON mal formado', async () => {
    const extra = await start({ admin: true });
    assert.equal(extra.status, 422);
    assert.equal(extra.json.error.code, 'VALIDATION_FAILED');
    assert.ok(extra.json.error.details.length > 0);
    assert.equal((await start({ phone: '56911111111' })).status, 422);
    assert.equal((await start({ channel: 'FAX' })).status, 422);
    assert.equal((await app.api('POST', '/auth/start', { raw: '{malo' })).status, 400);
    assert.equal(app.sent.length, 0, 'ninguna petición inválida envía un código');
  });

  it('sin token, con token falso o vencido ⇒ 401', async () => {
    assert.equal((await app.api('GET', '/me')).status, 401);
    assert.equal((await app.api('GET', '/me', { token: 'falso' })).status, 401);
    const { token } = await app.login(PHONE, 'pedro@test.cl');
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`);
    assert.equal((await app.api('GET', '/me', { token })).status, 401);
  });

  it('PUT /me solo cambia el nombre', async () => {
    const { token } = await app.login(PHONE, 'pedro@test.cl');
    assert.equal((await app.api('PUT', '/me', { token, body: { name: 'Pedro Soto' } })).json.name, 'Pedro Soto');
    assert.equal((await app.api('PUT', '/me', { token, body: { name: 'X', phone: '+56900000000' } })).status, 422);
    assert.equal((await app.api('PUT', '/me', { token, body: { name: '' } })).status, 422);
  });

  it('la auditoría registra el envío y el ingreso sin guardar el código', async () => {
    await app.login(PHONE, 'pedro@test.cl');
    const { rows } = await pool.query<{ event: string; metadata: unknown }>('SELECT event, metadata FROM audit_events ORDER BY id');
    assert.deepEqual(rows.map((r) => r.event), ['AUTH_CODE_SENT', 'LOGIN']);
    assert.ok(!JSON.stringify(rows).includes(app.sent[0]!.code));
  });
});
