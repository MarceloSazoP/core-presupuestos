import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';
import { assertTestDb, resetDb, startApp } from './helpers';

let app: Awaited<ReturnType<typeof startApp>>;
let a: { token: string };
let quoteId: string;

// Abre el flujo de avisos y entrega una función que espera el siguiente `changed` (o null si no llega a tiempo).
async function escuchar(id: string, token: string) {
  const ctl = new AbortController();
  const res = await fetch(`${app.base}/quotes/${id}/events`, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
  if (!res.ok || !res.body) return { status: res.status, siguiente: async () => null, cerrar: () => ctl.abort() };
  const lector = res.body.getReader();
  let buf = '';
  let lectura: ReturnType<typeof lector.read> | null = null; // una sola lectura pendiente: si se descartara, se perderían fragmentos
  const siguiente = async (ms = 2500): Promise<string | null> => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const m = /event: changed\ndata: (.*)\n\n/.exec(buf);
      if (m) {
        buf = buf.slice(m.index + m[0].length);
        return m[1]!;
      }
      lectura ??= lector.read();
      const r = await Promise.race([lectura, new Promise<null>((ok) => setTimeout(() => ok(null), 200))]);
      if (!r) continue;
      lectura = null;
      if (r.value) buf += new TextDecoder().decode(r.value);
      if (r.done) return null;
    }
    return null;
  };
  return { status: res.status, siguiente, cerrar: () => ctl.abort() };
}

describe('API: avisos de cambio en vivo (Contrato API §6, BD §20)', () => {
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
    quoteId = (await app.api('POST', '/quotes', { token: a.token, body: { customer: { name: 'Juan', phone: '+56933333333' } } })).json.id;
  });
  afterEach(async () => {
    await app.close();
  });

  it('avisa al que mira ese presupuesto cuando cambian ítems, notas, fotos o datos del cliente, y a nadie más', async () => {
    const b = await app.login('+56922222222', 'b@test.cl', 'Beto');
    const otro = (await app.api('POST', '/quotes', { token: b.token, body: { customer: { name: 'Pedro', phone: '+56944444444' } } })).json.id;
    const mio = await escuchar(quoteId, a.token);
    const ajeno = await escuchar(otro, b.token);
    assert.equal(mio.status, 200);
    await mio.siguiente(300); // la creación del presupuesto pudo dejar un aviso pendiente

    const cambios: [string, () => Promise<unknown>][] = [
      ['items', () => app.api('PUT', `/quotes/${quoteId}/items`, { token: a.token, body: { items: [{ description: 'Puerta', quantity: 1, unit_price: 1000 }] } })],
      ['notas', () => app.api('PUT', `/quotes/${quoteId}/survey`, { token: a.token, body: { notes: 'hola' } })],
      ['cliente', () => app.api('PATCH', `/quotes/${quoteId}/customer`, { token: a.token, body: { phone: '+56955555555' } })],
      ['foto', () => app.upload('POST', `/quotes/${quoteId}/photos`, { token: a.token, file: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') })],
    ];
    for (const [nombre, hacer] of cambios) {
      await hacer();
      assert.deepEqual(JSON.parse((await mio.siguiente()) ?? 'null'), { quote_id: quoteId }, `aviso por ${nombre}`);
      await mio.siguiente(300); // avisos repetidos del mismo cambio
    }
    assert.equal(await ajeno.siguiente(300), null, 'el otro presupuesto no recibe nada de lo mío');
    mio.cerrar();
    ajeno.cerrar();
  });

  it('también sirve con la sesión del código, y exige sesión y presupuesto propio', async () => {
    const b = await app.login('+56922222222', 'b@test.cl', 'Beto');
    assert.equal((await escuchar(quoteId, b.token)).status, 404, 'presupuesto ajeno');
    assert.equal((await fetch(`${app.base}/quotes/${quoteId}/events`)).status, 401, 'sin sesión');
    const codigo = (await app.api('POST', `/quotes/${quoteId}/access-code`, { token: a.token })).json.code;
    const s = (await app.api('POST', '/access/code/exchange', { body: { code: codigo } })).json.token;
    const web = await escuchar(quoteId, s);
    assert.equal(web.status, 200);
    await web.siguiente(300);
    await app.api('PUT', `/quotes/${quoteId}/survey`, { token: a.token, body: { notes: 'desde la app' } });
    assert.ok(await web.siguiente(), 'la web recibe el cambio hecho desde la app');
    web.cerrar();
  });
});
