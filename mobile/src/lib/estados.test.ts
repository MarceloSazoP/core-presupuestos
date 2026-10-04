import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estadosPosibles } from './estados.ts';

const ids = (doc: string, com: string) => estadosPosibles({ doc_status: doc, commercial_status: com }).map((e) => e.id);

test('nunca se ofrece el estado actual, y sí los otros tres', () => {
  assert.deepEqual(ids('FINALIZED', 'SENT'), ['FOLLOW_UP', 'ACCEPTED', 'REJECTED']);
  assert.deepEqual(ids('FINALIZED', 'FOLLOW_UP'), ['SENT', 'ACCEPTED', 'REJECTED']);
  assert.deepEqual(ids('FINALIZED', 'ACCEPTED'), ['SENT', 'FOLLOW_UP', 'REJECTED']);
  assert.deepEqual(ids('FINALIZED', 'REJECTED'), ['SENT', 'FOLLOW_UP', 'ACCEPTED']);
});

test('un pendiente o uno cerrado sin enviar no cambia de estado desde la lista', () => {
  assert.deepEqual(ids('DRAFT', 'NONE'), []);
  assert.deepEqual(ids('PENDING', 'NONE'), []);
  assert.deepEqual(ids('FINALIZED', 'NONE'), []);
});
