import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coincide } from './buscar.ts';

test('la búsqueda encuentra por cliente, número, código o trabajo, sin tildes ni mayúsculas', () => {
  const q = { customer: { name: 'José Pérez' }, number: 'CP-2026-0007', code_id: '7K4M2Q', service_description: 'Instalación de enchufes' };
  assert.ok(coincide(q, 'jose'));
  assert.ok(coincide(q, 'PEREZ'));
  assert.ok(coincide(q, '0007'));
  assert.ok(coincide(q, '7k4m'));
  assert.ok(coincide(q, 'jose enchufe')); // cada palabra en alguna parte
  assert.ok(!coincide(q, 'jose pintura'));
  assert.ok(!coincide({ ...q, number: null }, 'cp-2026')); // un pendiente aún no tiene número
});
