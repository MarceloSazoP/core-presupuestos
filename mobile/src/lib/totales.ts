// Vista previa de totales mientras se escribe. Manda el servidor (Contrato API §6): al guardar, la app vuelve a leer
// el presupuesto. El IVA es 19 % de subtotal − descuento, con .5 hacia arriba, y solo si hay un neto positivo.
export const TASA_IVA = 19;

export function totalesDe(subtotal: number, descuento: number, conIva: boolean) {
  const neto = subtotal - descuento;
  const iva = conIva && neto > 0 ? Math.floor((neto * TASA_IVA + 50) / 100) : 0;
  return { iva, total: Math.max(0, neto) + iva };
}
