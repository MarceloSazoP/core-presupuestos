export type Item = { descripcion: string; cantidad: number; precioUnitario: number };

// Entero exacto: cantidad en milésimas × precio, redondeo .5 hacia arriba (Contrato de BD, quote_items).
export function totalLinea(cantidad: number, precioUnitario: number): number {
  const milesimas = BigInt(Math.round(cantidad * 1000));
  return Number((milesimas * BigInt(precioUnitario) + BigInt(500)) / BigInt(1000));
}

export function calcularTotales(items: Item[], descuento: number) {
  const subtotal = items.reduce((suma, i) => suma + totalLinea(i.cantidad, i.precioUnitario), 0);
  return { subtotal, descuento, total: subtotal - descuento };
}
