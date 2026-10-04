import assert from 'node:assert/strict';
import { test } from 'node:test';
import { totalesDe } from './totales.ts';

test('sin IVA el total es subtotal − descuento y nunca baja de cero', () => {
  assert.deepEqual(totalesDe(10000, 1000, false), { iva: 0, total: 9000 });
  assert.deepEqual(totalesDe(1000, 5000, false), { iva: 0, total: 0 });
});

test('el IVA es 19 % después del descuento, con .5 hacia arriba', () => {
  assert.deepEqual(totalesDe(10000, 1000, true), { iva: 1710, total: 10710 });
  assert.equal(totalesDe(50, 0, true).iva, 10, '9,5 sube');
  assert.equal(totalesDe(2, 0, true).iva, 0, '0,38 baja');
  assert.deepEqual(totalesDe(1000, 5000, true), { iva: 0, total: 0 }, 'sin neto positivo no hay IVA');
});
