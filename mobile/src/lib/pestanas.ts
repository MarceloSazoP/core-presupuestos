// Pestañas de la lista de presupuestos: cada uno vive en exactamente una, según su estado, para que la lista no crezca sin fin.
// «Pendientes» es lo que requiere una acción tuya: terminar un borrador o enviar uno ya cerrado. Enviado, seguimiento, aceptado
// y rechazado tienen cada uno su pestaña, y los dos últimos quedan archivados.
export type Pestana = 'pendientes' | 'enviados' | 'seguimiento' | 'aceptados' | 'rechazados';

export const PESTANAS: readonly { id: Pestana; texto: string; vacio: string }[] = [
  { id: 'pendientes', texto: 'Pendientes', vacio: 'No tienes presupuestos por terminar o enviar.' },
  { id: 'enviados', texto: 'Enviados', vacio: 'Aquí aparecen los presupuestos que ya enviaste y esperan respuesta.' },
  { id: 'seguimiento', texto: 'Seguimiento', vacio: 'Aquí quedan los presupuestos a los que les estás haciendo seguimiento.' },
  { id: 'aceptados', texto: 'Aceptados', vacio: 'Aquí quedan los presupuestos que tu cliente aceptó.' },
  { id: 'rechazados', texto: 'Rechazados', vacio: 'Aquí quedan los presupuestos que tu cliente rechazó.' },
];

type Estados = { doc_status: string; commercial_status: string };

export function pestanaDe(q: Estados): Pestana {
  if (q.doc_status !== 'FINALIZED') return 'pendientes';
  if (q.commercial_status === 'ACCEPTED') return 'aceptados';
  if (q.commercial_status === 'REJECTED') return 'rechazados';
  if (q.commercial_status === 'FOLLOW_UP') return 'seguimiento';
  return q.commercial_status === 'NONE' ? 'pendientes' : 'enviados'; // cerrado sin enviar: falta enviarlo
}

export function contar(lista: Estados[]): Record<Pestana, number> {
  const n: Record<Pestana, number> = { pendientes: 0, enviados: 0, seguimiento: 0, aceptados: 0, rechazados: 0 };
  for (const q of lista) n[pestanaDe(q)]++;
  return n;
}

// Al arrastrar un presupuesto a una pestaña, el estado comercial al que pasa. «Pendientes» no es un estado comercial (es lo que
// falta terminar o enviar), así que no recibe presupuestos.
export const ESTADO_DE_PESTANA: Partial<Record<Pestana, 'SENT' | 'FOLLOW_UP' | 'ACCEPTED' | 'REJECTED'>> = {
  enviados: 'SENT',
  seguimiento: 'FOLLOW_UP',
  aceptados: 'ACCEPTED',
  rechazados: 'REJECTED',
};
