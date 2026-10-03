import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GARANTIAS } from './opciones.ts';
import { aPresupuesto, codigoGarantia, mensajesDeError, textoGarantia, type QuoteApi } from './mapeo.ts';

const api = (extra: Partial<QuoteApi> = {}): QuoteApi => ({
  id: 'q1', number: null, doc_status: 'DRAFT', commercial_status: 'NONE',
  customer: { name: 'Juan', phone: '+56933333333', email: null },
  professional: { name: 'Ana', phone: '+56911111111', email: 'ana@x.cl', has_logo: false },
  service_description: '', survey: { notes: null, measurements: [] }, items: [], discount: 0, total: 0,
  warranty: { kind: 'NONE', text: null }, validity_days: null, observations: null, sent_at: null, public_url: null, ...extra,
});

test('cada garantía de la pantalla tiene su código de la API y vuelve igual', () => {
  const codigos = GARANTIAS.map(codigoGarantia);
  assert.ok(codigos.every(Boolean));
  assert.equal(new Set(codigos).size, GARANTIAS.length);
  for (const g of GARANTIAS) assert.equal(textoGarantia(codigoGarantia(g)!, null), g);
  assert.equal(textoGarantia('CUSTOM', '2 años'), '2 años');
  assert.equal(codigoGarantia('lo que sea'), undefined);
});

test('el presupuesto de la API se adapta a la pantalla: borrador y pendiente se editan igual; vigencia por defecto', () => {
  assert.equal(aPresupuesto(api({ doc_status: 'DRAFT' })).estado, 'PENDING');
  assert.equal(aPresupuesto(api({ doc_status: 'PENDING' })).estado, 'PENDING');
  const f = aPresupuesto(api({ doc_status: 'FINALIZED', number: 'CP-2026-0001', validity_days: 30, sent_at: '2026-10-03T10:00:00Z' }));
  assert.deepEqual([f.estado, f.numero, f.validezDias, f.enviado], ['FINALIZED', 'CP-2026-0001', 30, true]);
  assert.equal(aPresupuesto(api()).validezDias, 15);
  const m = aPresupuesto(api({ survey: { notes: 'n', measurements: [{ label: 'Largo', value: '3 m' }] }, items: [{ description: 'x', quantity: 2, unit: 'm2', unit_price: 100 }] }));
  assert.deepEqual(m.levantamiento.medidas, [{ etiqueta: 'Largo', valor: '3 m' }]);
  assert.deepEqual(m.items, [{ descripcion: 'x', cantidad: 2, unidad: 'm2', precioUnitario: 100 }]);
});

test('los errores 422 de la API se muestran con el ítem o el campo, sin repetir', () => {
  const msgs = mensajesDeError([
    { field: 'items.1.quantity', message: 'Debe ser mayor que 0' },
    { field: 'items.1.quantity', message: 'Debe ser mayor que 0' },
    { field: 'validity_days', message: 'Define la validez del presupuesto' },
    { field: 'otro', message: 'Algo más' },
  ], 'general');
  assert.deepEqual(msgs, ['Ítem 2: Debe ser mayor que 0', 'Validez: Define la validez del presupuesto', 'Algo más']);
  assert.deepEqual(mensajesDeError([], 'general'), ['general']);
});
