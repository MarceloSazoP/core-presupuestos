import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bloqueo, esTransitorio, espera, reemplazadas } from './reglas.ts';

test('qué errores se reintentan', () => {
  for (const s of [0, 429, 500, 502, 503]) assert.equal(esTransitorio(s), true);
  for (const s of [400, 404, 409, 422]) assert.equal(esTransitorio(s), false);
});

test('la espera crece y tiene tope de un minuto', () => {
  assert.deepEqual([0, 1, 2, 3].map(espera), [2000, 4000, 8000, 16000]);
  assert.equal(espera(10), 60_000);
});

test('un PUT reemplaza al pendiente de la misma ruta; un POST nunca', () => {
  const cola = [
    { seq: 1, quote_id: 'a', method: 'PUT', path: '/quotes/a/survey' },
    { seq: 2, quote_id: 'a', method: 'POST', path: '/quotes/a/photos' },
    { seq: 3, quote_id: 'b', method: 'PUT', path: '/quotes/b/survey' },
  ];
  assert.deepEqual(reemplazadas(cola, { quote_id: 'a', method: 'PUT', path: '/quotes/a/survey' }), [1]);
  assert.deepEqual(reemplazadas(cola, { quote_id: 'a', method: 'POST', path: '/quotes/a/photos' }), []);
});

test('las fotos pendientes no impiden guardar, pero sí terminar', () => {
  const foto = { quote_id: 'a', method: 'POST', path: '/quotes/a/photos', state: 'pending', last_error: null };
  const creacion = { quote_id: 'a', method: 'POST', path: '/quotes', state: 'pending', last_error: null };
  assert.equal(bloqueo([foto], 'a', 'creacion'), null);
  assert.match(bloqueo([foto], 'a', 'todo')!, /enviando 1 cambio/);
  assert.match(bloqueo([creacion], 'a', 'creacion')!, /Todavía/);
  assert.equal(bloqueo([foto], 'otro', 'todo'), null);
});

test('si algo falló para siempre, el mensaje dice el motivo y qué hacer', () => {
  const rota = { quote_id: 'a', method: 'POST', path: '/quotes/a/photos', state: 'failed', last_error: 'El archivo ya no está' };
  assert.match(bloqueo([rota], 'a', 'todo')!, /El archivo ya no está.*reintentar o descartar/);
});
