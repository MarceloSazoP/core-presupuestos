export type Item = { descripcion: string; cantidad: number; precioUnitario: number };

// Entero exacto: cantidad en milésimas × precio, redondeo .5 hacia arriba (Contrato de BD, quote_items).
export function totalLinea(cantidad: number, precioUnitario: number): number {
  const milesimas = BigInt(Math.round(cantidad * 1000));
  return Number((milesimas * BigInt(precioUnitario) + BigInt(500)) / BigInt(1000));
}

// Vista previa mientras se escribe: el servidor vuelve a calcular y es quien manda (Contrato API §6). El IVA (19 %) se
// calcula sobre subtotal − descuento, con .5 hacia arriba; sin neto positivo no hay IVA.
export const TASA_IVA = 19;

export function calcularTotales(items: Item[], descuento: number, conIva = false) {
  const subtotal = items.reduce((suma, i) => suma + totalLinea(i.cantidad, i.precioUnitario), 0);
  const neto = subtotal - descuento;
  const iva = conIva && neto > 0 ? Number((BigInt(neto) * BigInt(TASA_IVA) + BigInt(50)) / BigInt(100)) : 0;
  return { subtotal, descuento, iva, total: neto + iva };
}
