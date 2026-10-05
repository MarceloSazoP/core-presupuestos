import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerUltimoAcceso } from './ultimo-acceso-datos.ts';

const ok = { prefijo: '+56', telefono: '9 5482 2089', correo: 'ana@mail.cl', nombre: 'Ana' };

test('los datos recordados solo se aceptan completos y con la forma esperada', () => {
  assert.deepEqual(leerUltimoAcceso(JSON.stringify(ok)), ok);
  for (const malo of [null, '', 'no es json', '{}', JSON.stringify({ ...ok, correo: 'sin-arroba' }), JSON.stringify({ ...ok, telefono: '  ' }), JSON.stringify({ ...ok, prefijo: '56' }), JSON.stringify({ ...ok, nombre: 3 })]) {
    assert.equal(leerUltimoAcceso(malo), null, String(malo));
  }
});
