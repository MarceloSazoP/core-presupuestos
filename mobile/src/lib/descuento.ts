// El descuento se elige como porcentaje, pero el servidor guarda el monto (Contrato API §6): se calcula sobre el subtotal, con .5
// hacia arriba, igual que los demás montos.
export const montoDeDescuento = (subtotal: number, porcentaje: number) => Math.floor((subtotal * porcentaje + 50) / 100);

// Al volver a abrir un presupuesto solo se conoce el monto: es un porcentaje si calza exacto con un entero entre 1 y 100; si no
// (un monto fijo de antes), null.
export function porcentajeDe(monto: number, subtotal: number): number | null {
  if (monto <= 0) return 0;
  if (subtotal <= 0) return null;
  const p = Math.round((monto * 100) / subtotal);
  return p >= 1 && p <= 100 && montoDeDescuento(subtotal, p) === monto ? p : null;
}
