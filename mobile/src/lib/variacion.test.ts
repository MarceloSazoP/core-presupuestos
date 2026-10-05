import assert from 'node:assert/strict';
import { test } from 'node:test';
import { porcentaje, puntos, variacion } from './variacion.ts';

test('el cambio frente al mes anterior se calcula, se redondea y no divide por cero', () => {
  assert.equal(porcentaje(1120, 1000), 12);
  assert.equal(porcentaje(900, 1000), -10);
  assert.equal(porcentaje(500, 0), null); // sin mes anterior no hay con qué comparar
  assert.equal(puntos(0.75, 0.6), 15);
  assert.equal(puntos(null, 0.6), null);
  assert.equal(variacion(12, '%')?.texto, '▲ 12 % vs mes anterior');
  assert.equal(variacion(-4, '%')?.sube, false);
  assert.equal(variacion(1, 'puntos')?.lectura, '1 punto más que el mes anterior');
  assert.equal(variacion(0, '%')?.sube, null);
  assert.equal(variacion(null, '%'), null);
});
