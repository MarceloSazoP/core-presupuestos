import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clp, miles } from './formato.ts';

test('los montos llevan punto de miles, también los de 4 cifras', () => {
  assert.equal(clp(0), '$0');
  assert.equal(clp(999), '$999');
  assert.equal(clp(1234), '$1.234');
  assert.equal(clp(12192592334), '$12.192.592.334');
  assert.equal(miles(2500.5), '2.501');
});
