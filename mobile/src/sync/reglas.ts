// Reglas de la cola de envío (Arquitectura §5, "Reglas de la cola"), sin dependencias de la app para poder probarlas.

// Red caída, 429 o 5xx: se conserva y se reintenta. Cualquier otro 4xx: la operación no va a funcionar sola.
export const esTransitorio = (status: number) => status === 0 || status === 429 || status >= 500;

export const espera = (intentos: number) => Math.min(60_000, 2_000 * 2 ** intentos);

// Un PUT o PATCH nuevo sobre la misma ruta del mismo presupuesto reemplaza al pendiente: gana la última escritura.
export const reemplazadas = (cola: { seq: number; quote_id: string; method: string; path: string }[], nueva: { quote_id: string; method: string; path: string }) =>
  nueva.method === 'PUT' || nueva.method === 'PATCH'
    ? cola.filter((o) => o.quote_id === nueva.quote_id && o.method === nueva.method && o.path === nueva.path).map((o) => o.seq)
    : [];

// ¿Puede avanzar una acción en línea (guardar ítems, terminar, enviar, seguimiento)? Devuelve el motivo si no.
// - 'creacion': basta con que el servidor ya conozca el presupuesto. Las fotos y la voz pendientes no impiden guardar
//   ítems ni enviar: viajan por otras rutas y siguen en la cola.
// - 'todo': al terminar, todo lo del levantamiento debe estar en el servidor, porque un presupuesto terminado ya no
//   acepta fotos nuevas (se perderían).
type OpCola = { quote_id: string; method: string; path: string; state: string; last_error: string | null };
export function bloqueo(cola: OpCola[], quoteId: string, alcance: 'creacion' | 'todo'): string | null {
  const mias = cola.filter((o) => o.quote_id === quoteId && (alcance === 'todo' || (o.method === 'POST' && o.path === '/quotes')));
  if (mias.length === 0) return null;
  const fallida = mias.find((o) => o.state === 'failed');
  if (fallida) return `No se pudo enviar parte de este presupuesto: ${fallida.last_error ?? 'error desconocido'}. Toca el aviso de arriba para reintentar o descartar esos cambios.`;
  return `Todavía se ${mias.length === 1 ? 'está enviando 1 cambio' : `están enviando ${mias.length} cambios`} de este presupuesto (fotos, voz o notas). Espera a que termine; necesitas internet.`;
}
