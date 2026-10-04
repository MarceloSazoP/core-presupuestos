// Formato del código del presupuesto, `AAAAAA-BBBBBBBBBB` (Contrato BD §6): 16 caracteres Crockford base32.
// Da formato mientras se escribe o se pega: mayúsculas, sin espacios ni guiones sobrantes, el guion después de los
// 6 primeros, y las confusiones típicas corregidas (I y L por 1, O por 0; la U no existe en el alfabeto). La API
// tolera lo mismo, así que esto es solo para que la persona vea lo que escribe.
export function formatearCodigo(texto: string): string {
  const limpio = texto
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, "")
    .slice(0, 16);
  return limpio.length > 6 ? `${limpio.slice(0, 6)}-${limpio.slice(6)}` : limpio;
}
