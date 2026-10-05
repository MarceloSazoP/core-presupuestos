import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agregarAviso, deNotificacion, marcarLeidos, MAX_AVISOS, sinLeer, type Aviso } from './avisos-datos.ts';

const aviso = (id: string, fecha: string, leido = false): Aviso => ({ id, titulo: 't', cuerpo: 'c', quoteId: null, fecha, leido });

test('los avisos van del más reciente al más antiguo, sin repetirse y con un tope', () => {
  let l: Aviso[] = [];
  l = agregarAviso(l, aviso('a', '2026-10-01T10:00:00Z'));
  l = agregarAviso(l, aviso('b', '2026-10-03T10:00:00Z'));
  l = agregarAviso(l, aviso('a', '2026-10-09T10:00:00Z')); // el mismo aviso otra vez: no se duplica ni se reordena
  assert.deepEqual(l.map((x) => x.id), ['b', 'a']);
  for (let i = 0; i < MAX_AVISOS + 10; i++) l = agregarAviso(l, aviso(`x${i}`, new Date(Date.UTC(2026, 9, 4) + i * 1000).toISOString()));
  assert.equal(l.length, MAX_AVISOS);
});

test('se cuentan los no leídos y se marcan de a uno o todos', () => {
  const l = [aviso('a', '2026-10-01T00:00:00Z'), aviso('b', '2026-10-02T00:00:00Z'), aviso('c', '2026-10-03T00:00:00Z', true)];
  assert.equal(sinLeer(l), 2);
  assert.equal(sinLeer(marcarLeidos(l, 'a')), 1);
  assert.equal(sinLeer(marcarLeidos(l)), 0);
});

test('una notificación del sistema se vuelve un aviso, con la fecha en segundos o en milisegundos', () => {
  const base = { request: { identifier: 'contacto-q1', content: { title: 'Contactar a Juan', body: 'Hoy toca llamarlo', data: { quoteId: 'q1' } } } };
  const s = deNotificacion({ ...base, date: 1_791_000_000 }); // segundos
  const m = deNotificacion({ ...base, date: 1_791_000_000_000 }); // milisegundos
  assert.equal(s.fecha, m.fecha);
  assert.equal(s.quoteId, 'q1');
  assert.equal(deNotificacion({ date: 1, request: { identifier: 'x', content: { title: null, body: null, data: {} } } }).titulo, 'Aviso');
});
