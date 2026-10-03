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

describe('Servidor: conexiones inactivas', () => {
  it('una conexión inactiva más de 5 s sigue sirviendo el siguiente POST (lo que hace un iPhone tras sacar una foto)', async () => {
    const http = await import('node:http');
    const app2 = await startApp();
    try {
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
      const pedir = (method: string, path: string) =>
        new Promise<number | string>((resolve) => {
          const url = new URL(app2.base + path);
          const r = http.request({ host: url.hostname, port: url.port, path: url.pathname, method, agent, headers: method === 'POST' ? { 'Content-Type': 'application/json', 'Content-Length': 2 } : {} }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode!));
          });
          r.on('error', (e: NodeJS.ErrnoException) => resolve(`ERROR ${e.code}`));
          r.end(method === 'POST' ? '{}' : undefined);
        });
      assert.equal(await pedir('GET', '/me'), 401);
      await new Promise((r) => setTimeout(r, 6000));
      assert.equal(await pedir('POST', '/auth/logout'), 401, 'antes del arreglo esto terminaba en ECONNRESET');
      agent.destroy();
    } finally {
      await app2.close();
    }
  });
});
