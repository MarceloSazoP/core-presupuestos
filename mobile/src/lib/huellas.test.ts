import assert from 'node:assert/strict';
import { test } from 'node:test';
import { huellaCierre, huellaLevantamiento } from './huellas.ts';

const base = {
  items: [{ id: 'a', kind: 'ITEM', description: 'Enchufe', quantity: 2, unit: 'un', unit_price: 1000 }], discount: 0, include_vat: false, validity_days: 15, warranty: { kind: 'NONE' }, observations: null,
  service_description: 'Casa', address: null, survey: { notes: null, measurements: [] },
} as never;

test('marcar el IVA en la web cambia la huella del cierre y no la del levantamiento; los ids de los ítems no cuentan', () => {
  const web = { ...(base as object), include_vat: true } as never;
  assert.notEqual(huellaCierre(web), huellaCierre(base));
  assert.equal(huellaLevantamiento(web), huellaLevantamiento(base));
  const otrosIds = { ...(base as object), items: [{ id: 'z', kind: 'ITEM', description: 'Enchufe', quantity: 2, unit: 'un', unit_price: 1000 }] } as never;
  assert.equal(huellaCierre(otrosIds), huellaCierre(base));
  const notas = { ...(base as object), survey: { notes: 'x', measurements: [] } } as never;
  assert.notEqual(huellaLevantamiento(notas), huellaLevantamiento(base));
});
