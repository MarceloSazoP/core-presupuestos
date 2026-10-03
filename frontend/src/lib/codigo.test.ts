import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashCodigo, verificarCodigo } from './codigo.ts';

test('el hash es argon2id, no revela el código y verifica ignorando mayúsculas y espacios', async () => {
  const hash = await hashCodigo('pre-1');
  assert.match(hash, /^\$argon2id\$/);
  assert.ok(!hash.includes('pre-1'));
  assert.equal(await verificarCodigo(hash, '  PRE-1 '), true);
  assert.equal(await verificarCodigo(hash, 'pre-2'), false);
  assert.equal(await verificarCodigo('no-es-un-hash', 'pre-1'), false);
});
