// Vista previa de totales mientras se escribe. Manda el servidor (Contrato API §6): al guardar, la app vuelve a leer
// el presupuesto. El impuesto es la tasa del presupuesto (`vat_rate`, la de su país) sobre subtotal − descuento, con .5 hacia
// arriba, y solo si hay un neto positivo.
export const TASA_IVA = 19; // Chile: la de los presupuestos anteriores a los varios países

export function totalesDe(subtotal: number, descuento: number, conIva: boolean, tasa = TASA_IVA) {
  const neto = subtotal - descuento;
  const iva = conIva && neto > 0 ? Math.floor((neto * tasa + 50) / 100) : 0;
  return { iva, total: Math.max(0, neto) + iva };
}
