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

export const sumTotals = (lineTotals: number[], discount: number) => {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  return { subtotal, total: subtotal - discount };
};
