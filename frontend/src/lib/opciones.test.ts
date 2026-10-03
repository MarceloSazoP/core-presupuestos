import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esUnidad, simboloUnidad, UNIDADES, UNIDAD_POR_DEFECTO } from './opciones.ts';

test('el catálogo de unidades tiene códigos únicos y seguros, y cubre las habituales', () => {
  const codigos = UNIDADES.map((u) => u.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
  assert.ok(codigos.every((c) => /^[a-z0-9]+$/.test(c)));
  for (const esperado of ['un', 'm', 'm2', 'm3', 'l', 'gal', 'kg', 'hr', 'gl']) assert.ok(esUnidad(esperado), esperado);
  assert.ok(esUnidad(UNIDAD_POR_DEFECTO));
  assert.equal(esUnidad('furlong'), false);
  assert.equal(simboloUnidad('m2'), 'm²');
  assert.equal(simboloUnidad('desconocida'), 'desconocida');
});
