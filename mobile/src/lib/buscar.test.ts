import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clienteConTelefono, coincide, coincideCliente } from './buscar.ts';

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

test('un cliente se encuentra por nombre o por parte del teléfono, y se reconoce un teléfono ya guardado', () => {
  const c = { name: 'María José Soto', phone: '+56912345678' };
  assert.ok(coincideCliente(c, 'maria soto'));
  assert.ok(coincideCliente(c, '1234'));
  assert.ok(coincideCliente(c, '9 1234 5678'));
  assert.ok(!coincideCliente(c, '12')); // dos dígitos son poco: se busca por nombre
  assert.ok(!coincideCliente(c, ''));
  assert.equal(clienteConTelefono([c], '+56912345678'), c);
  assert.equal(clienteConTelefono([c], '+56911111111'), undefined);
  assert.equal(clienteConTelefono([c], null), undefined);
});
