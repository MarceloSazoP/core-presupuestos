export const LADO_MAYOR = 2048; // Contrato de BD §8: el móvil reduce a ~2048 px para respetar el límite de 10 MB

// Lado mayor al tamaño final, sin agrandar nunca. Pura para poder probarla sin módulos nativos.
export function tamanoFinal(ancho: number, alto: number): { width: number } | { height: number } | null {
  if (Math.max(ancho, alto) <= LADO_MAYOR) return null;
  return ancho >= alto ? { width: LADO_MAYOR } : { height: LADO_MAYOR };
}
