// Pestañas de la lista de presupuestos: cada uno vive en exactamente una, según su estado, para que la lista no crezca sin fin.
// «Pendientes» son los borradores por terminar; «Cerrados», los ya terminados (con su número y PDF) que falta enviar. Enviado, seguimiento,
// aceptado y rechazado tienen cada uno su pestaña, y los dos últimos quedan archivados.
export type Pestana = 'pendientes' | 'cerrados' | 'enviados' | 'seguimiento' | 'aceptados' | 'rechazados';

// `resumen`: la línea sobre la lista («4 por terminar»). `vacio`: qué hay en la pestaña, cuando no tiene ninguno. `ayuda`: cómo se elimina
// uno (solo los pendientes se pueden eliminar, Contrato API §6).
export const PESTANAS: readonly { id: Pestana; texto: string; resumen: (n: number) => string; vacio: string; ayuda?: string }[] = [
  { id: 'pendientes', texto: 'Pendientes', resumen: (n) => `${n} por terminar`, vacio: 'No tienes presupuestos por terminar. Al terminar uno, pasa a Cerrados.', ayuda: 'Mantén apretado uno para eliminarlo.' },
  { id: 'cerrados', texto: 'Cerrados', resumen: (n) => `${n} sin enviar`, vacio: 'Aquí quedan los presupuestos terminados, con su número y su PDF, que todavía no envías.' },
  { id: 'enviados', texto: 'Enviados', resumen: (n) => `${n} esperando respuesta`, vacio: 'Aquí aparecen los presupuestos que ya enviaste y esperan la respuesta de tu cliente.' },
  { id: 'seguimiento', texto: 'Seguimiento', resumen: (n) => `${n} en seguimiento`, vacio: 'Aquí quedan los presupuestos a los que les haces seguimiento: te avisamos cuándo volver a llamar.' },
  { id: 'aceptados', texto: 'Aceptados', resumen: (n) => (n === 1 ? '1 aceptado' : `${n} aceptados`), vacio: 'Aquí quedan los presupuestos que tu cliente aceptó.' },
  { id: 'rechazados', texto: 'Rechazados', resumen: (n) => (n === 1 ? '1 rechazado' : `${n} rechazados`), vacio: 'Aquí quedan los presupuestos que tu cliente rechazó. Desde uno puedes crear una versión corregida.' },
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
