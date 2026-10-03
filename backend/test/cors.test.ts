import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, startApp } from './helpers';

describe('CORS: lista cerrada de orígenes', () => {
  let app: Awaited<ReturnType<typeof startApp>>;
  before(async () => {
    await assertTestDb();
    await migrate(pool);
    app = await startApp({ corsOrigins: ['http://localhost:8081'] });
  });
  afterEach(() => undefined);
  after(async () => {
    await app.close();
    await pool.end();
  });

  const pedir = (origin: string, method = 'GET') => fetch(`${app.base}/me`, { method, headers: { Origin: origin, ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } : {}) } });

  it('un origen de la lista recibe las cabeceras y su preflight se responde sin autenticar', async () => {
    const pre = await pedir('http://localhost:8081', 'OPTIONS');
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.match(pre.headers.get('access-control-allow-headers')!, /Authorization/);
    const r = await pedir('http://localhost:8081');
    assert.equal(r.status, 401, 'la ruta sigue exigiendo sesión');
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  });

  it('cualquier otro origen no recibe cabeceras CORS ni respuesta al preflight', async () => {
    for (const origen of ['https://evil.example', 'http://localhost:8082', 'null']) {
      const pre = await pedir(origen, 'OPTIONS');
      assert.equal(pre.headers.get('access-control-allow-origin'), null, origen);
      assert.notEqual(pre.status, 204, origen);
      assert.equal((await pedir(origen)).headers.get('access-control-allow-origin'), null, origen);
    }
  });
});
