import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiLocal } from './api-local.ts';

test('la API local se arma con la dirección de Metro y el puerto de la API', () => {
  assert.equal(apiLocal('192.168.5.1:8081'), 'http://192.168.5.1:3013/api/v1');
  assert.equal(apiLocal('[::1]:8081'), 'http://[::1]:3013/api/v1');
  assert.equal(apiLocal('mi-equipo.local'), 'http://mi-equipo.local:3013/api/v1');
  assert.equal(apiLocal(undefined), null); // build de producción: no hay Metro
  assert.equal(apiLocal(''), null);
});
