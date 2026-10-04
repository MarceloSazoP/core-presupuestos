import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esPreferencia } from './preferencias.ts';

test('solo se aceptan las tres preferencias guardadas; cualquier otra cosa vuelve a «automático»', () => {
  for (const ok of ['sistema', 'claro', 'oscuro']) assert.equal(esPreferencia(ok), true);
  for (const mal of [null, undefined, '', 'dark', 'light', 'Oscuro', 1]) assert.equal(esPreferencia(mal), false);
});
