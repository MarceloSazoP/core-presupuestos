// Única función de totales (Arquitectura §3, regla 4): los clientes nunca los envían.

// Cantidad: hasta 3 decimales. Se valida sobre su representación en texto para no depender de flotantes.
export const hasMax3Decimals = (q: number) => /^\d+(\.\d{1,3})?$/.test(String(q));

// line_total = round(quantity × unit_price), con .5 hacia arriba (igual que `round()` de numeric en PostgreSQL).
// Aritmética entera con BigInt: cantidad en milésimas.
export function lineTotal(quantity: number, unitPrice: number): number {
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(String(quantity));
  if (!m) throw new RangeError(`cantidad inválida: ${quantity}`);
  const milli = BigInt(m[1]! + (m[2] ?? '').padEnd(3, '0'));
  return Number((milli * BigInt(unitPrice) + 500n) / 1000n);
}

// IVA de Chile. Vive solo aquí: los clientes muestran lo que devuelve el servidor (Contrato API §6).
export const VAT_RATE = 19;

// IVA sobre un neto: round(neto × 19 / 100) con .5 hacia arriba, solo si el neto es positivo. BigInt: un neto grande
// por 19 supera los enteros exactos de un número de JS.
export const vatOf = (net: number) => (net > 0 ? Number((BigInt(net) * BigInt(VAT_RATE) + 50n) / 100n) : 0);

// El descuento se resta antes del IVA: IVA = 19 % de (subtotal − descuento); total = subtotal − descuento + IVA.
export const sumTotals = (lineTotals: number[], discount: number, includeVat = false) => {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const net = subtotal - discount;
  const vat = includeVat ? vatOf(net) : 0;
  return { subtotal, vat, total: net + vat };
};
