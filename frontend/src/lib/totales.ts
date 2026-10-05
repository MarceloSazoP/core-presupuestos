// Una tarea (actividad sin cantidad ni unidad) vale su precio, o 0 si va incluida.
export type Item = { tipo?: 'item' | 'tarea'; descripcion: string; cantidad: number; precioUnitario: number };

// Entero exacto: cantidad en milésimas × precio, redondeo .5 hacia arriba (Contrato de BD, quote_items).
export function totalLinea(cantidad: number, precioUnitario: number): number {
  const milesimas = BigInt(Math.round(cantidad * 1000));
  return Number((milesimas * BigInt(precioUnitario) + BigInt(500)) / BigInt(1000));
}

// Vista previa mientras se escribe: el servidor vuelve a calcular y es quien manda (Contrato API §6). El impuesto (la tasa del
// presupuesto, la de su país) se calcula sobre subtotal − descuento, con .5 hacia arriba; sin neto positivo no hay impuesto.
export const TASA_IVA = 19; // Chile: la de los presupuestos anteriores a los varios países

export function calcularTotales(items: Item[], descuento: number, conIva = false, tasa = TASA_IVA) {
  const subtotal = items.reduce((suma, i) => suma + totalLinea(i.tipo === 'tarea' ? 1 : i.cantidad, i.precioUnitario), 0);
  const neto = subtotal - descuento;
  const iva = conIva && neto > 0 ? Number((BigInt(neto) * BigInt(tasa) + BigInt(50)) / BigInt(100)) : 0;
  return { subtotal, descuento, iva, total: neto + iva };
}
