import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palabrasDe, recortarPalabras } from './palabras.ts';

test('el tope de palabras corta lo que sobra y no toca lo que cabe', () => {
  const texto = Array.from({ length: 80 }, (_, i) => `p${i}`).join(' ');
  assert.equal(palabrasDe(recortarPalabras(texto, 69)).length, 69);
  assert.equal(recortarPalabras('hola mundo ', 69), 'hola mundo '); // cabe: se respeta el espacio final
  assert.equal(recortarPalabras('uno dos\ntres cuatro', 3), 'uno dos tres');
  assert.equal(palabrasDe('   ').length, 0);
});
