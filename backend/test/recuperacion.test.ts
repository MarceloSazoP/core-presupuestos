import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { sha256 } from '../src/lib/crypto';
import { assertTestDb, resetDb, startApp } from './helpers';

// QR de recuperación de la cuenta (Recuperación de cuenta con QR.md §5).
let app: Awaited<ReturnType<typeof startApp>>;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
// El código de texto del correo (el mismo token del QR): la línea de 43 caracteres base64url.
const tokenDelCorreo = (texto: string) => /^([A-Za-z0-9_-]{43})$/m.exec(texto)![1]!;
const ultimoToken = () => tokenDelCorreo(app.mails.at(-1)!.text);

describe('API: recuperar la cuenta con el QR del correo', () => {
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

  it('un registro nuevo manda el QR solo al correo de la cuenta; volver a ingresar no manda otro', async () => {
    await app.login('+56911111111', 'ana@test.cl', 'Ana');
    assert.equal(app.mails.length, 1);
    const m = app.mails[0]!;
    assert.equal(m.to, 'ana@test.cl');
    assert.equal(m.attachment.filename, 'qr-recuperacion.png');
    assert.deepEqual(m.attachment.content.subarray(0, 4), PNG, 'el adjunto es un PNG');
    assert.equal(m.attachment.contentType, 'image/png');
    await app.login('+56911111111', 'ana@test.cl', 'Ana'); // la cuenta ya existe
    assert.equal(app.mails.length, 1);
    const { rows } = await pool.query<{ token_hash: string }>('SELECT token_hash FROM recovery_tokens');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.token_hash, sha256(ultimoToken()), 'se guarda el hash, no el token');
    assert.notEqual(rows[0]!.token_hash, ultimoToken());
  });

  it('entrar con el QR abre sesión de esa cuenta, cierra las otras, se gasta y manda el siguiente', async () => {
    const a = await app.login('+56911111111', 'ana@test.cl', 'Ana');
    const b = await app.login('+56922222222', 'beto@test.cl', 'Beto');
    const qrDeAna = tokenDelCorreo(app.mails[0]!.text);
    const r = await app.api('POST', '/auth/recovery', { body: { token: qrDeAna } });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.id, a.user.id);
    assert.equal(r.json.is_new_user, false);
    assert.equal((await app.api('GET', '/me', { token: r.json.token })).status, 200);
    assert.equal((await app.api('GET', '/me', { token: a.token })).status, 401, 'la sesión del teléfono viejo se cerró');
    assert.equal((await app.api('GET', '/me', { token: b.token })).status, 200, 'la cuenta de otra persona no se toca');
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: qrDeAna } })).status, 401, 'se usa una sola vez');
    // llegó el siguiente al correo de Ana y sirve; el anterior ya no
    assert.equal(app.mails.at(-1)!.to, 'ana@test.cl');
    assert.match(app.mails.at(-1)!.subject, /Se usó tu QR/);
    assert.notEqual(ultimoToken(), qrDeAna);
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: ultimoToken(), close_other_sessions: false } })).status, 200);
  });

  it('un token inventado, usado o malformado no entra; con el esquema de la app también sirve', async () => {
    await app.login('+56911111111', 'ana@test.cl', 'Ana');
    const bueno = ultimoToken();
    for (const malo of ['x'.repeat(43), 'A'.repeat(43), 'corto']) {
      const r = await app.api('POST', '/auth/recovery', { body: { token: malo } });
      assert.ok(r.status === 401 || r.status === 422, `${malo.slice(0, 6)}: ${r.status}`);
    }
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: `corepresupuesto://recuperar/${bueno}` } })).status, 200, 'el contenido del QR completo');
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: bueno, otro: 1 } })).status, 422);
  });

  it('dos lecturas a la vez del mismo QR: solo una entra', async () => {
    await app.login('+56911111111', 'ana@test.cl', 'Ana');
    const t = ultimoToken();
    const r = await Promise.all([app.api('POST', '/auth/recovery', { body: { token: t } }), app.api('POST', '/auth/recovery', { body: { token: t } })]);
    assert.deepEqual(r.map((x) => x.status).sort(), [200, 401]);
  });

  it('pedir un QR nuevo invalida el anterior, va al correo de la cuenta y tiene tope por hora', async () => {
    const a = await app.login('+56911111111', 'ana@test.cl', 'Ana');
    const viejo = ultimoToken();
    assert.equal((await app.api('POST', '/me/recovery-qr')).status, 401, 'sin sesión');
    const p = await app.api('POST', '/me/recovery-qr', { token: a.token });
    assert.equal(p.status, 202);
    assert.match(p.json.destination_masked, /\*/);
    assert.equal(app.mails.at(-1)!.to, 'ana@test.cl');
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: viejo } })).status, 401, 'el anterior ya no sirve');
    assert.equal((await app.api('POST', '/me/recovery-qr', { token: a.token })).status, 202);
    assert.equal((await app.api('POST', '/me/recovery-qr', { token: a.token })).status, 429, 'el registro cuenta como el primero: tope de 3 por hora');
    const { rows } = await pool.query('SELECT 1 FROM recovery_tokens WHERE used_at IS NULL AND revoked_at IS NULL');
    assert.equal(rows.length, 1, 'a lo sumo uno vigente');
  });

  it('si el correo del registro falla, la cuenta se crea igual y se puede pedir otro QR', async () => {
    app.mailState.fail = true;
    const a = await app.login('+56911111111', 'ana@test.cl', 'Ana');
    assert.equal(app.mails.length, 0);
    assert.equal((await pool.query('SELECT 1 FROM recovery_tokens')).rows.length, 0, 'sin correo no queda un QR que nadie recibió');
    app.mailState.fail = false;
    assert.equal((await app.api('POST', '/me/recovery-qr', { token: a.token })).status, 202);
    assert.equal(app.mails.length, 1);
  });

  it('si el correo del QR nuevo falla, el anterior sigue valiendo', async () => {
    const a = await app.login('+56911111111', 'ana@test.cl', 'Ana');
    const viejo = ultimoToken();
    app.mailState.fail = true;
    assert.equal((await app.api('POST', '/me/recovery-qr', { token: a.token })).status, 502);
    app.mailState.fail = false;
    assert.equal((await app.api('POST', '/auth/recovery', { body: { token: viejo, close_other_sessions: false } })).status, 200);
  });
});
