// Aviso de que un presupuesto cambió fuera de la app (hoy: el cliente lo aceptó desde su correo). Lo emite la notificación push al
// llegar con la app abierta, y lo escuchan la lista y el presupuesto abierto para volver a leer al instante, sin esperar el refresco.
type Oyente = (quoteId: string) => void;
const oyentes = new Set<Oyente>();

export const alCambiar = (f: Oyente) => {
  oyentes.add(f);
  return () => void oyentes.delete(f);
};
export const avisarCambio = (quoteId: string) => oyentes.forEach((f) => f(quoteId));
