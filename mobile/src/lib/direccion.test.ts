import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatearDireccion, puntoDe, redondear, sesionNueva } from './direccion.ts';

test('la dirección del pin se arma como «calle número, comuna» y el punto va completo o no va', () => {
  assert.equal(formatearDireccion({ street: 'Av. Providencia', streetNumber: '1208', district: 'Providencia', city: 'Santiago' }), 'Av. Providencia 1208, Providencia');
  assert.equal(formatearDireccion({ street: 'Los Aromos', city: 'Peñalolén' }), 'Los Aromos, Peñalolén');
  assert.equal(formatearDireccion({ name: 'Mall Plaza Vespucio', district: 'La Florida' }), 'Mall Plaza Vespucio, La Florida');
  assert.equal(formatearDireccion({}), null);
  assert.equal(formatearDireccion(undefined), null);
  assert.deepEqual(puntoDe(-33.4, -70.6), { latitude: -33.4, longitude: -70.6 });
  assert.equal(puntoDe(-33.4, null), null);
  assert.equal(redondear(-33.42561234567), -33.425612);
  assert.match(sesionNueva('123e4567-e89b-12d3-a456-426614174000'), /^[A-Za-z0-9_-]{8,64}$/);
});
