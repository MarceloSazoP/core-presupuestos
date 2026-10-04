// Pestañas de la lista de presupuestos: cada uno vive en exactamente una, según su estado, para que la lista no crezca sin fin.
// «Pendientes» es lo que requiere una acción tuya: terminar un borrador o enviar uno ya cerrado. «Enviados» incluye los que
// están en seguimiento. Aceptado y rechazado quedan archivados en su propia pestaña.
export type Pestana = 'pendientes' | 'enviados' | 'aceptados' | 'rechazados';

export const PESTANAS: readonly { id: Pestana; texto: string; vacio: string }[] = [
  { id: 'pendientes', texto: 'Pendientes', vacio: 'No tienes presupuestos por terminar o enviar.' },
  { id: 'enviados', texto: 'Enviados', vacio: 'Aquí aparecen los presupuestos que ya enviaste y esperan respuesta.' },
  { id: 'aceptados', texto: 'Aceptados', vacio: 'Aquí quedan los presupuestos que tu cliente aceptó.' },
  { id: 'rechazados', texto: 'Rechazados', vacio: 'Aquí quedan los presupuestos que tu cliente rechazó.' },
];

type Estados = { doc_status: string; commercial_status: string };

export function pestanaDe(q: Estados): Pestana {
  if (q.doc_status !== 'FINALIZED') return 'pendientes';
  if (q.commercial_status === 'ACCEPTED') return 'aceptados';
  if (q.commercial_status === 'REJECTED') return 'rechazados';
  return q.commercial_status === 'NONE' ? 'pendientes' : 'enviados'; // cerrado sin enviar: falta enviarlo
}

export function contar(lista: Estados[]): Record<Pestana, number> {
  const n: Record<Pestana, number> = { pendientes: 0, enviados: 0, aceptados: 0, rechazados: 0 };
  for (const q of lista) n[pestanaDe(q)]++;
  return n;
}
