import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dinero, montoEscrito, soloDigitos } from './formato.ts';

test('los montos llevan punto de miles, también los de 4 cifras', () => {
  assert.equal(dinero(0), '$0');
  assert.equal(dinero(999), '$999');
  assert.equal(dinero(1234), '$1.234');
  assert.equal(dinero(12192592334), '$12.192.592.334');
  assert.equal(dinero(2500.5), '$2.501');
});

test('la caja de monto guarda dígitos y muestra «$» con puntos de miles', () => {
  assert.equal(montoEscrito(soloDigitos('12500')), '$12.500');
  assert.equal(montoEscrito(soloDigitos('$12.500')), '$12.500', 'lo ya formateado vuelve a leerse igual');
  assert.equal(montoEscrito(soloDigitos('$')), '', 'borrar todo deja la caja vacía');
  assert.equal(montoEscrito(''), '');
  assert.equal(soloDigitos('1a2,3'), '123');
});
