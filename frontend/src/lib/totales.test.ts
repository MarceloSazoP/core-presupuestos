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
  assert.deepEqual(calcularTotales(items, 1000), { subtotal: 20000, descuento: 1000, iva: 0, total: 19000 });
});

test('el IVA es 19 % de subtotal − descuento, con .5 hacia arriba, y solo si se pide', () => {
  const uno = (precio: number) => [{ descripcion: 'a', cantidad: 1, precioUnitario: precio }];
  assert.deepEqual(calcularTotales(uno(10000), 1000, true), { subtotal: 10000, descuento: 1000, iva: 1710, total: 10710 });
  assert.equal(calcularTotales(uno(50), 0, true).iva, 10, '9,5 sube');
  assert.equal(calcularTotales(uno(2), 0, true).iva, 0, '0,38 baja');
  assert.equal(calcularTotales(uno(1000), 5000, true).iva, 0, 'con descuento mayor que el subtotal no hay IVA');
  assert.equal(calcularTotales(uno(10000), 0, false).total, 10000);
});
