// Pestañas de la lista de presupuestos: cada uno vive en exactamente una, según su estado, para que la lista no crezca sin fin.
// «Pendientes» son los borradores por terminar; «Cerrados», los ya terminados (con su número y PDF) que falta enviar. Enviado, seguimiento,
// aceptado y rechazado tienen cada uno su pestaña, y los dos últimos quedan archivados. Cada una trae su glosa: qué contiene y si se pueden eliminar.
export type Pestana = 'pendientes' | 'cerrados' | 'enviados' | 'seguimiento' | 'aceptados' | 'rechazados';

// `glosa`: qué hay en la pestaña. `eliminar`: cómo se elimina uno (solo los pendientes se pueden eliminar, Contrato API §6).
const NO_ELIMINAR = 'Los presupuestos terminados no se pueden eliminar.';
export const PESTANAS: readonly { id: Pestana; texto: string; vacio: string; glosa: string; eliminar: string }[] = [
  { id: 'pendientes', texto: 'Pendientes', vacio: 'No tienes presupuestos por terminar.', glosa: 'Borradores que aún no terminas: falta completar los ítems o las condiciones. Al terminarlos pasan a Cerrados.', eliminar: 'Para eliminar uno, mantén apretada su tarjeta hasta que se llene la barra roja.' },
  { id: 'cerrados', texto: 'Cerrados', vacio: 'No tienes presupuestos terminados sin enviar.', glosa: 'Presupuestos ya terminados, con su número y su PDF, que todavía no envías. Ábrelos para enviarlos al cliente.', eliminar: NO_ELIMINAR },
  { id: 'enviados', texto: 'Enviados', vacio: 'Aquí aparecen los presupuestos que ya enviaste y esperan respuesta.', glosa: 'Presupuestos que ya enviaste y esperan la respuesta de tu cliente. Pasa cada uno a Seguimiento, Aceptado o Rechazado según corresponda.', eliminar: NO_ELIMINAR },
  { id: 'seguimiento', texto: 'Seguimiento', vacio: 'Aquí quedan los presupuestos a los que les estás haciendo seguimiento.', glosa: 'Presupuestos a los que les haces seguimiento: te avisamos cuándo volver a llamar al cliente.', eliminar: NO_ELIMINAR },
  { id: 'aceptados', texto: 'Aceptados', vacio: 'Aquí quedan los presupuestos que tu cliente aceptó.', glosa: 'Presupuestos que tu cliente aceptó. Quedan archivados aquí.', eliminar: NO_ELIMINAR },
  { id: 'rechazados', texto: 'Rechazados', vacio: 'Aquí quedan los presupuestos que tu cliente rechazó.', glosa: 'Presupuestos que tu cliente rechazó. Desde uno puedes crear una nueva versión corregida.', eliminar: NO_ELIMINAR },
];

type Estados = { doc_status: string; commercial_status: string };

export function pestanaDe(q: Estados): Pestana {
  if (q.doc_status !== 'FINALIZED') return 'pendientes';
  if (q.commercial_status === 'ACCEPTED') return 'aceptados';
  if (q.commercial_status === 'REJECTED') return 'rechazados';
  if (q.commercial_status === 'FOLLOW_UP') return 'seguimiento';
  return q.commercial_status === 'NONE' ? 'cerrados' : 'enviados'; // terminado y sin enviar: falta enviarlo
}

export function contar(lista: Estados[]): Record<Pestana, number> {
  const n: Record<Pestana, number> = { pendientes: 0, cerrados: 0, enviados: 0, seguimiento: 0, aceptados: 0, rechazados: 0 };
  for (const q of lista) n[pestanaDe(q)]++;
  return n;
}
