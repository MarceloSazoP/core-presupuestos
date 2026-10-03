import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularTotales, totalLinea } from './totales.ts';

test('totalLinea redondea .5 hacia arriba sin errores de coma flotante', () => {
  assert.equal(totalLinea(1.5, 5000), 7500);
  assert.equal(totalLinea(0.5, 1), 1);
  assert.equal(totalLinea(0.145, 100), 15);
  assert.equal(totalLinea(1_000_000, 999_999_999), 999_999_999_000_000);
});

test('calcularTotales suma líneas y resta el descuento', () => {
  const items = [
    { descripcion: 'a', cantidad: 1, precioUnitario: 5000 },
    { descripcion: 'b', cantidad: 2, precioUnitario: 7500 },
  ];
  assert.deepEqual(calcularTotales(items, 1000), { subtotal: 20000, descuento: 1000, total: 19000 });
});
