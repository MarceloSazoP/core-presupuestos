import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tamanoFinal } from './tamano.ts';

test('el lado mayor queda en 2048 px y una foto chica no se agranda', () => {
  assert.deepEqual(tamanoFinal(4032, 3024), { width: 2048 }); // horizontal
  assert.deepEqual(tamanoFinal(3024, 4032), { height: 2048 }); // vertical
  assert.deepEqual(tamanoFinal(3000, 3000), { width: 2048 }); // cuadrada
  assert.equal(tamanoFinal(2048, 1536), null);
  assert.equal(tamanoFinal(800, 600), null);
});
