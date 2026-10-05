import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dinero, montoEscrito, paisDe, PAISES } from './paises.ts';
import { totalesDe } from './totales.ts';

test('el monto lleva el símbolo y el separador de su moneda', () => {
  assert.equal(dinero(1234567), '$1.234.567');
  assert.equal(dinero(1234567, 'PEN'), 'S/ 1,234,567');
  assert.equal(dinero(1234567, 'MXN'), '$1,234,567');
  assert.equal(dinero(1234567, 'USD'), '$1,234,567');
  assert.equal(dinero(1234567, 'CRC'), '₡1 234 567');
  assert.equal(dinero(-5000), '-$5.000');
  assert.equal(dinero(100, 'XXX'), '$100');
  assert.equal(montoEscrito('12500', 'PEN'), 'S/ 12,500');
  assert.equal(montoEscrito(''), '');
});

test('el país desconocido cae en Chile y el impuesto usa la tasa del presupuesto', () => {
  assert.equal(paisDe('ZZ').country, 'CL');
  assert.equal(paisDe(null).country, 'CL');
  assert.equal(PAISES.length, 12);
  assert.deepEqual(totalesDe(100000, 0, true, 16), { iva: 16000, total: 116000 });
  assert.deepEqual(totalesDe(100000, 0, true), { iva: 19000, total: 119000 });
});
