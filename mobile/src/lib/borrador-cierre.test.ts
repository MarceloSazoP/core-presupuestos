import assert from 'node:assert/strict';
import { test } from 'node:test';
import { borradorVigente } from './borrador-cierre.ts';

test('el borrador del cierre solo vuelve si el presupuesto no cambió en el servidor', () => {
  const b = { base: 'v1', filas: [{ description: 'Enchufe' }], pct: 10, conIva: true, dias: '15', garantia: 'D30', obs: '' };
  assert.deepEqual(borradorVigente(JSON.stringify(b), 'v1'), b);
  assert.equal(borradorVigente(JSON.stringify(b), 'v2'), null); // lo cambiaron en la web: manda la web
  assert.equal(borradorVigente('null', 'v1'), null); // ya se guardó
  assert.equal(borradorVigente(null, 'v1'), null);
  assert.equal(borradorVigente('{roto', 'v1'), null);
});
