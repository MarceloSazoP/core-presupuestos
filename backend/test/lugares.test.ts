import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { AppError } from '../src/errors';
import type { Lugares } from '../src/lib/places';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string };
const llamadas: unknown[][] = [];
const falso: Lugares = {
  autocomplete: async (...args) => (llamadas.push(args), [{ id: 'ChIJabc', text: 'Av. Providencia 1208, Providencia, Chile' }]),
  details: async () => ({ address: 'Av. Providencia 1208, Providencia, Chile', latitude: -33.4256, longitude: -70.6126 }),
};
const SESION = 'sesion-1234567890';

describe('API: lugares y sugerencias de direcciones (Contrato API §12.2)', () => {
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
    llamadas.length = 0;
    app = await startApp({ places: falso });
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
  });
  afterEach(async () => {
    await app.close();
  });

  it('pide sesión, valida lo que llega y usa el país de la cuenta si no se indica', async () => {
    assert.equal((await app.api('POST', '/places/autocomplete', { body: { input: 'Providencia', session: SESION } })).status, 401);
    for (const body of [{ input: 'ab', session: SESION }, { input: 'Providencia', session: 'corta' }, { input: 'Providencia', session: SESION, otro: 1 }]) {
      assert.equal((await app.api('POST', '/places/autocomplete', { token: a.token, body })).status, 422, JSON.stringify(body));
    }
    const ok = await app.api('POST', '/places/autocomplete', { token: a.token, body: { input: 'Providencia 12', session: SESION } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json.suggestions, [{ id: 'ChIJabc', text: 'Av. Providencia 1208, Providencia, Chile' }]);
    assert.equal(llamadas[0]![1], 'CL', 'el país de una cuenta chilena');
  });

  it('el detalle del lugar trae la dirección y el punto; un id o una sesión inválidos son 422', async () => {
    const d = await app.api('GET', `/places/ChIJabc?session=${SESION}`, { token: a.token });
    assert.equal(d.status, 200);
    assert.deepEqual(d.json, { address: 'Av. Providencia 1208, Providencia, Chile', latitude: -33.4256, longitude: -70.6126 });
    assert.equal((await app.api('GET', '/places/ChIJabc?session=x', { token: a.token })).status, 422);
    assert.equal((await app.api('GET', `/places/${encodeURIComponent('a b')}?session=${SESION}`, { token: a.token })).status, 422);
  });

  it('si el proveedor no está disponible (sin clave de Google) responde 503 y no rompe nada', async () => {
    await app.close();
    const caido = async () => {
      throw new AppError(503, 'PLACES_UNAVAILABLE', 'no');
    };
    app = await startApp({ places: { autocomplete: caido, details: caido } });
    a = await app.login('+56911111111', 'a@test.cl', 'Ana');
    const r = await app.api('POST', '/places/autocomplete', { token: a.token, body: { input: 'Providencia', session: SESION } });
    assert.equal(r.status, 503);
    assert.equal(r.json.error.code, 'PLACES_UNAVAILABLE');
  });
});
