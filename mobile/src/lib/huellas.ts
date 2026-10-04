import type { Presupuesto } from '@/api/types';

// Qué campos maneja cada bloque editable del detalle. Si la copia del servidor cambia alguno (p. ej. alguien marcó el IVA en la web),
// ese bloque se vuelve a armar con los datos nuevos; si no cambia, no se toca (así no se pierde lo que se está escribiendo).
export const huellaCierre = (q: Presupuesto) =>
  JSON.stringify([q.items.map((i) => [i.kind, i.description, i.quantity, i.unit, i.unit_price]), q.discount, q.include_vat, q.validity_days, q.warranty.kind, q.observations]);

export const huellaLevantamiento = (q: Presupuesto) =>
  JSON.stringify([q.service_description, q.address, q.survey.notes, q.survey.measurements.map((m) => [m.label, m.value])]);
