// Cuánto cambió un número frente al mes anterior, para las tarjetas del inicio. Todos los indicadores mejoran al subir.
export type Variacion = { texto: string; lectura: string; sube: boolean | null }; // sube: null = sin cambio

// Cambio porcentual. Sin mes anterior con valor no hay con qué comparar (dividir por 0): null.
export const porcentaje = (actual: number, anterior: number): number | null => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null);

// Cambio en puntos de una tasa entre 0 y 1 (por ejemplo 0,6 → 0,75 son +15 puntos). Si falta alguna, null.
export const puntos = (actual: number | null, anterior: number | null): number | null => (actual === null || anterior === null ? null : Math.round((actual - anterior) * 100));

export function variacion(cambio: number | null, unidad: '%' | 'puntos'): Variacion | null {
  if (cambio === null) return null;
  const abs = Math.abs(cambio);
  const u = unidad === '%' ? '%' : abs === 1 ? 'punto' : 'puntos';
  const num = unidad === '%' ? `${abs} %` : `${abs} ${u}`;
  if (cambio === 0) return { texto: '= igual que el mes anterior', lectura: 'Igual que el mes anterior', sube: null };
  const sube = cambio > 0;
  return { texto: `${sube ? '▲' : '▼'} ${num} vs mes anterior`, lectura: `${num} ${sube ? 'más' : 'menos'} que el mes anterior`, sube };
}
