import assert from 'node:assert/strict';
import { test } from 'node:test';
import { montoDeDescuento, porcentajeDe } from './descuento.ts';

test('el descuento en porcentaje se calcula sobre el subtotal y se reconoce al volver a abrir', () => {
  assert.equal(montoDeDescuento(50000, 20), 10000);
  assert.equal(montoDeDescuento(333, 50), 167); // .5 hacia arriba
  assert.equal(porcentajeDe(10000, 50000), 20);
  assert.equal(porcentajeDe(0, 50000), 0);
  assert.equal(porcentajeDe(12345, 50000), null); // monto fijo de antes: no es un porcentaje exacto
  assert.equal(porcentajeDe(500, 0), null);
});
