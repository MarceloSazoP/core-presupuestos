// Reglas de la cola de envío (Arquitectura §5, "Reglas de la cola"), sin dependencias de la app para poder probarlas.

// Red caída, 429 o 5xx: se conserva y se reintenta. Cualquier otro 4xx: la operación no va a funcionar sola.
export const esTransitorio = (status: number) => status === 0 || status === 429 || status >= 500;

export const espera = (intentos: number) => Math.min(60_000, 2_000 * 2 ** intentos);

// Un PUT o PATCH nuevo sobre la misma ruta del mismo presupuesto reemplaza al pendiente: gana la última escritura.
export const reemplazadas = (cola: { seq: number; quote_id: string; method: string; path: string }[], nueva: { quote_id: string; method: string; path: string }) =>
  nueva.method === 'PUT' || nueva.method === 'PATCH'
    ? cola.filter((o) => o.quote_id === nueva.quote_id && o.method === nueva.method && o.path === nueva.path).map((o) => o.seq)
    : [];
