import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codigoDeVinculo } from './vinculo.ts';

test('solo el QR de CorePresupuesto da un código de vínculo', () => {
  const cod = 'rzt2yqkOlqpQGWDzTbGkdychZDxPRYnVvjoE6s1tFfI';
  assert.equal(codigoDeVinculo(`corepresupuesto://web/${cod}`), cod);
  assert.equal(codigoDeVinculo(` corepresupuesto://web/${cod}\n`), cod);
  for (const malo of ['', cod, `https://corepresupuesto.cl/web/${cod}`, `corepresupuesto://otro/${cod}`, `corepresupuesto://web/${cod}?x=1`, 'corepresupuesto://web/corto', `https://evil.cl/?u=corepresupuesto://web/${cod}`]) {
    assert.equal(codigoDeVinculo(malo), null, malo);
  }
});
