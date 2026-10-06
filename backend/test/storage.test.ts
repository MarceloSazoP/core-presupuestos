import assert from 'node:assert/strict';
import { test } from 'node:test';

// Atiende `Range` con el driver de Supabase, sin red: se simula el objeto del bucket con fetch.
test('send atiende rangos con Supabase Storage', async () => {
  process.env.STORAGE_DRIVER = 'supabase';
  process.env.SUPABASE_URL = 'http://supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'k';
  const { config } = await import('../src/config');
  Object.assign(config, { STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_KEY: 'k' });
  const { send } = await import('../src/lib/storage');
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(Buffer.from('0123456789'))) as typeof fetch;
  try {
    const salida = async (range?: string) => {
      const r: { status?: number; headers: Record<string, string>; body?: Buffer } = { headers: {} };
      const res = {
        set: (k: string | Record<string, string>, v?: string) => (typeof k === 'string' ? (r.headers[k] = v!) : Object.assign(r.headers, k), res),
        status: (n: number) => ((r.status = n), res),
        send: (b: Buffer) => ((r.body = b), res),
        end: () => res,
      };
      await send({ headers: { range } } as never, res as never, 'u/x');
      return r;
    };
    assert.equal((await salida()).body?.toString(), '0123456789');
    const p = await salida('bytes=2-4');
    assert.equal(p.status, 206);
    assert.equal(p.body?.toString(), '234');
    assert.equal(p.headers['Content-Range'], 'bytes 2-4/10');
    assert.equal((await salida('bytes=-3')).body?.toString(), '789');
    assert.equal((await salida('bytes=20-')).status, 416);
  } finally {
    globalThis.fetch = real;
  }
});
