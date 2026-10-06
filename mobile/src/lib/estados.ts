// Estados comerciales a los que se puede pasar un presupuesto desde la lista (Contrato API §8: cambio manual y libre entre
// estos cuatro; nunca vuelve a «sin enviar»). Nunca se ofrece el estado en que ya está.
export type EstadoElegible = 'SENT' | 'FOLLOW_UP' | 'ACCEPTED' | 'REJECTED';

// `tono`: el color con que se muestra el estado (etiqueta de la fila y botón al deslizar), del tema de la app.
export type Tono = 'ok' | 'seguimiento' | 'info' | 'error';
export const ESTADOS: readonly { id: EstadoElegible; texto: string; tono: Tono }[] = [
  { id: 'SENT', texto: 'Enviado', tono: 'ok' },
  { id: 'FOLLOW_UP', texto: 'Seguimiento', tono: 'seguimiento' },
  { id: 'ACCEPTED', texto: 'Aceptado', tono: 'info' },
  { id: 'REJECTED', texto: 'Rechazado', tono: 'error' },
];

// Solo un presupuesto terminado y ya enviado cambia de estado (uno cerrado sin enviar se envía desde su pantalla, y uno
// pendiente aún no tiene estado comercial).
export const estadosPosibles = (q: { doc_status: string; commercial_status: string }) =>
  q.doc_status === 'FINALIZED' && q.commercial_status !== 'NONE' ? ESTADOS.filter((e) => e.id !== q.commercial_status) : [];
