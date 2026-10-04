export const LADO_MAYOR = 2048; // Contrato de BD §8: el móvil reduce a ~2048 px para respetar el límite de 10 MB

export const LADO_LOGO = 512; // un logo no necesita más; el servidor admite hasta 2 MB (Contrato API §4)

// Lado mayor al tamaño final (por defecto el de las fotos), sin agrandar nunca. Pura para poder probarla sin módulos nativos.
export function tamanoFinal(ancho: number, alto: number, lado = LADO_MAYOR): { width: number } | { height: number } | null {
  if (Math.max(ancho, alto) <= lado) return null;
  return ancho >= alto ? { width: lado } : { height: lado };
}
