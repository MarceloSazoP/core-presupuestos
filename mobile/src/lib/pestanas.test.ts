import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contar, pestanaDe } from './pestanas.ts';

const q = (doc_status: string, commercial_status: string) => ({ doc_status, commercial_status });

test('cada presupuesto cae en una sola pestaña según su estado', () => {
  assert.equal(pestanaDe(q('DRAFT', 'NONE')), 'pendientes');
  assert.equal(pestanaDe(q('PENDING', 'NONE')), 'pendientes');
  assert.equal(pestanaDe(q('FINALIZED', 'NONE')), 'pendientes', 'cerrado pero sin enviar: falta enviarlo');
  assert.equal(pestanaDe(q('FINALIZED', 'SENT')), 'enviados');
  assert.equal(pestanaDe(q('FINALIZED', 'FOLLOW_UP')), 'seguimiento');
  assert.equal(pestanaDe(q('FINALIZED', 'ACCEPTED')), 'aceptados');
  assert.equal(pestanaDe(q('FINALIZED', 'REJECTED')), 'rechazados');
});

test('los contadores suman todos los presupuestos, ni uno de más ni de menos', () => {
  const lista = [q('DRAFT', 'NONE'), q('PENDING', 'NONE'), q('FINALIZED', 'SENT'), q('FINALIZED', 'FOLLOW_UP'), q('FINALIZED', 'ACCEPTED'), q('FINALIZED', 'ACCEPTED'), q('FINALIZED', 'REJECTED')];
  assert.deepEqual(contar(lista), { pendientes: 2, enviados: 1, seguimiento: 1, aceptados: 2, rechazados: 1 });
  assert.deepEqual(contar([]), { pendientes: 0, enviados: 0, seguimiento: 0, aceptados: 0, rechazados: 0 });
});
