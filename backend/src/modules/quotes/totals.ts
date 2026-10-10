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

// Tasa por defecto (Chile, 19 %): la de los presupuestos anteriores a los varios países. Desde entonces cada presupuesto trae la suya
// (`quotes.vat_rate`, copiada de su país). Los clientes muestran lo que devuelve el servidor (Contrato API §6).
export const TASA_POR_DEFECTO = 19;

// Impuesto sobre un neto: round(neto × tasa / 100) con .5 hacia arriba, solo si el neto es positivo. La tasa puede traer dos
// decimales (Puerto Rico, 11,5 %): se lleva a centésimas. BigInt: un neto grande por la tasa supera los enteros exactos de JS.
export const vatOf = (net: number, rate = TASA_POR_DEFECTO) => (net > 0 ? Number((BigInt(net) * BigInt(Math.round(rate * 100)) + 5000n) / 10000n) : 0);

// El descuento se resta antes del impuesto: impuesto = tasa % de (subtotal − descuento); total = subtotal − descuento + impuesto.
export const sumTotals = (lineTotals: number[], discount: number, includeVat = false, rate = TASA_POR_DEFECTO) => {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const net = subtotal - discount;
  const vat = includeVat ? vatOf(net, rate) : 0;
  return { subtotal, vat, total: net + vat };
};
