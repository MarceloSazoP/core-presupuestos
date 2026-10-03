import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { parseCode } from '../src/lib/code';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string; user: { id: string } };
let quote: { id: string; access_code: string };
const exchange = (code: string) => app.api('POST', '/access/code/exchange', { body: { code } });

describe('API: acceso por código del presupuesto (Contrato API §9 y §14)', () => {
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
    quote = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json;
  });
  afterEach(async () => {
    await app.close();
  });

  const sesion = async () => (await exchange(quote.access_code)).json.token as string;

  it('parseCode: tolera minúsculas, espacios, guiones y confusiones I/L/O; rechaza lo que no es un código', () => {
    const ok = { shortId: '7K4M2Q', secret: 'X9D2P4HT1B' };
    assert.deepEqual(parseCode('7K4M2Q-X9D2P4HT1B'), ok);
    assert.deepEqual(parseCode('7k4m2q x9d2p4ht1b'), ok);
    assert.deepEqual(parseCode(' 7K4M2QX9D2P4HTIB '), ok, 'I se lee como 1');
    assert.deepEqual(parseCode('7K4M2Q-X9D2P4HTLB'), ok, 'L se lee como 1');
    assert.deepEqual(parseCode('7K4M2Q-X9D2P4HTOB')?.secret, 'X9D2P4HT0B', 'O se lee como 0');
    for (const malo of ['', '7K4M2Q', '7K4M2Q-X9D2P4HT1', '7K4M2Q-X9D2P4HT1BB', '7K4M2U-X9D2P4HT1B', '7K4M2Q-X9D2P4H!1B']) assert.equal(parseCode(malo), null, malo);
  });

  it('canjea el código por una sesión de 30 min limitada a ese presupuesto', async () => {
    const r = await exchange(quote.access_code);
    assert.equal(r.status, 200);
    assert.equal(r.json.quote_id, quote.id);
    assert.equal(r.json.doc_status, 'DRAFT');
    const minutos = (Date.parse(r.json.expires_at) - Date.now()) / 60_000;
    assert.ok(minutos > 29 && minutos <= 30, `expira en ${minutos} min`);
    const { rows } = await pool.query('SELECT scope, quote_id, user_id FROM sessions WHERE token_hash = encode(sha256($1::bytea), \'hex\')', [r.json.token]);
    assert.deepEqual(rows[0], { scope: 'QUOTE_CODE', quote_id: quote.id, user_id: a.user.id });
  });

  it('acepta el código escrito de varias formas', async () => {
    const [id, secreto] = quote.access_code.split('-');
    for (const forma of [quote.access_code.toLowerCase(), `${id}${secreto}`, `${id} ${secreto}`, ` ${quote.access_code} `]) {
      assert.equal((await exchange(forma)).status, 200, forma);
    }
  });

  it('con la sesión del código: completa, edita y guarda SU presupuesto', async () => {
    const t = await sesion();
    assert.equal((await app.api('GET', `/quotes/${quote.id}`, { token: t })).json.customer.name, 'Juan');
    assert.equal((await app.api('PATCH', `/quotes/${quote.id}`, { token: t, body: { service_description: 'Instalación' } })).status, 200);
    assert.equal((await app.api('PUT', `/quotes/${quote.id}/survey`, { token: t, body: { notes: 'n' } })).status, 200);
    assert.equal((await app.api('PUT', `/quotes/${quote.id}/measurements`, { token: t, body: { measurements: [{ label: 'a', value: 'b' }] } })).status, 200);
    const it = await app.api('PUT', `/quotes/${quote.id}/items`, { token: t, body: { items: [{ description: 'x', quantity: 2, unit_price: 1000 }] } });
    assert.equal(it.json.total, 2000);
    assert.equal((await app.api('POST', `/quotes/${quote.id}/save`, { token: t, body: {} })).json.doc_status, 'PENDING');
  });

  it('con la sesión del código NO puede: borrar, gestionar el código, listar, clientes, perfil ni otro presupuesto', async () => {
    const otro = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Otro', phone: '+56944444444' } } })).json;
    const t = await sesion();
    for (const [m, p, body] of [
      ['DELETE', `/quotes/${quote.id}`], ['POST', `/quotes/${quote.id}/access-code`, {}], ['DELETE', `/quotes/${quote.id}/access-code`],
      ['GET', '/quotes'], ['POST', '/quotes', { customer: { name: 'x', phone: '+56955555555' } }], ['GET', '/customers'], ['GET', '/me'],
    ] as [string, string, object?][]) {
      assert.equal((await app.api(m, p, { token: t, ...(body && { body }) })).status, 403, `${m} ${p}`);
    }
    for (const [m, p, body] of [['GET', `/quotes/${otro.id}`], ['PATCH', `/quotes/${otro.id}`, { address: 'x' }], ['PUT', `/quotes/${otro.id}/items`, { items: [] }]] as [string, string, object?][]) {
      assert.equal((await app.api(m, p, { token: t, ...(body && { body }) })).status, 404, `${m} ${p}: ni siquiera es suyo`);
    }
    assert.equal((await app.api('GET', `/quotes/${quote.id}`, { token: a.token })).status, 200);
  });

  it('un presupuesto finalizado se puede leer pero no editar con la sesión del código', async () => {
    const t = await sesion();
    await pool.query(`UPDATE quotes SET doc_status='FINALIZED', number='CP-2026-0001', finalized_at=now(), service_description='x', validity_days=15 WHERE id=$1`, [quote.id]);
    assert.equal((await app.api('GET', `/quotes/${quote.id}`, { token: t })).status, 200);
    assert.equal((await app.api('PATCH', `/quotes/${quote.id}`, { token: t, body: { address: 'x' } })).status, 409);
    assert.equal((await exchange(quote.access_code)).json.doc_status, 'FINALIZED');
  });

  it('secreto equivocado, ID inexistente, formato inválido y código revocado ⇒ el mismo 404', async () => {
    const [id] = quote.access_code.split('-');
    const respuestas = [
      await exchange(`${id}-${'0'.repeat(10)}`),
      await exchange('ZZZZZZ-0123456789'),
      await exchange('no-es-un-codigo'),
      await exchange(''),
    ];
    for (const r of respuestas) {
      assert.equal(r.status, 404);
      assert.deepEqual(r.json, respuestas[0]!.json);
    }
    await app.api('DELETE', `/quotes/${quote.id}/access-code`, { token: a.token });
    const revocado = await exchange(quote.access_code);
    assert.equal(revocado.status, 404);
    assert.deepEqual(revocado.json, respuestas[0]!.json);
  });

  it('5 fallos seguidos bloquean el código 15 min, incluso con el secreto correcto', async () => {
    const [id] = quote.access_code.split('-');
    for (let i = 0; i < 5; i++) assert.equal((await exchange(`${id}-${'0'.repeat(10)}`)).status, 404);
    const bloqueado = await exchange(quote.access_code);
    assert.equal(bloqueado.status, 429);
    assert.equal(bloqueado.json.error.code, 'RATE_LIMITED');
    assert.equal(bloqueado.headers.get('retry-after'), '900');
    await pool.query(`UPDATE quote_access SET locked_until = now() - interval '1 second'`);
    assert.equal((await exchange(quote.access_code)).status, 200, 'pasado el bloqueo vuelve a funcionar');
    const { rows } = await pool.query('SELECT failed_attempts FROM quote_access');
    assert.equal(rows[0].failed_attempts, 0, 'un acierto reinicia el contador');
  });

  it('una ráfaga en paralelo no se salta el límite de intentos', async () => {
    const [id] = quote.access_code.split('-');
    const rs = await Promise.all(Array.from({ length: 12 }, () => exchange(`${id}-${'0'.repeat(10)}`)));
    assert.ok(rs.filter((r) => r.status === 404).length <= 5, 'como mucho 5 llegan a verificarse');
    assert.equal((await exchange(quote.access_code)).status, 429);
  });

  it('límite por IP: 10 por hora', async () => {
    await app.close();
    app = await startApp({ ipExchangeLimit: 2 });
    assert.equal((await exchange('AAAAAA-0000000000')).status, 404);
    assert.equal((await exchange('AAAAAA-0000000000')).status, 404);
    const r = await exchange('AAAAAA-0000000000');
    assert.equal(r.status, 429);
    assert.ok(r.headers.get('retry-after'));
  });

  it('valida el cuerpo y deja rastro de auditoría sin guardar el código', async () => {
    assert.equal((await app.api('POST', '/access/code/exchange', { body: { code: quote.access_code, extra: 1 } })).status, 422);
    assert.equal((await app.api('POST', '/access/code/exchange', { body: {} })).status, 422);
    await exchange(quote.access_code);
    await exchange(`${quote.access_code.split('-')[0]}-${'0'.repeat(10)}`);
    const { rows } = await pool.query<{ event: string; metadata: unknown }>(`SELECT event, metadata FROM audit_events WHERE event LIKE 'ACCESS_CODE%' ORDER BY id`);
    assert.deepEqual(rows.map((r) => r.event), ['ACCESS_CODE_CREATED', 'ACCESS_CODE_USED', 'ACCESS_CODE_FAILED']);
    assert.ok(!JSON.stringify(rows).includes(quote.access_code.split('-')[1]!), 'el secreto no queda en la auditoría');
  });
});
