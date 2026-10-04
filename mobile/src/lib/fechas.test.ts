import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aFechaLocal, diaCorto, enDias } from './fechas.ts';

test('suma días cruzando mes y año', () => {
  assert.equal(enDias(0, new Date(2026, 9, 3)), '2026-10-03');
  assert.equal(enDias(7, new Date(2026, 9, 28)), '2026-11-04');
  assert.equal(enDias(3, new Date(2026, 11, 30)), '2027-01-02');
  assert.equal(diaCorto('2026-10-05'), '5 oct');
});

test('el día elegido en el calendario se guarda como YYYY-MM-DD en la hora local', () => {
  assert.equal(aFechaLocal(new Date(2026, 9, 5, 23, 59)), '2026-10-05'); // casi medianoche: sigue siendo el 5
  assert.equal(aFechaLocal(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.equal(aFechaLocal(new Date(2026, 11, 31, 12)), '2026-12-31');
});
