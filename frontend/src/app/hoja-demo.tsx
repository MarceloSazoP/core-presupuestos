import type { CSSProperties } from "react";
import { cant, clp } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { calcularTotales, totalLinea } from "@/lib/totales";

const ITEMS = [
  { descripcion: "Instalación de enchufes", cantidad: 4, unidad: "un", precioUnitario: 12500 },
  { descripcion: "Cable 2,5 mm²", cantidad: 30, unidad: "m", precioUnitario: 890 },
  { descripcion: "Revisión de tablero", cantidad: 1, unidad: "gl", precioUnitario: 35000 },
];

// Muestra de cómo queda un presupuesto: una hoja blanca sobre dos copias apiladas, planas y con borde fino (sistema «Brex»).
// Al cargar cuenta cómo se arma, una vez: la hoja se asienta, llegan los ítems uno por uno, después el total y al final se dibuja la
// firma (.entrar y .firmar, globals.css).
const turno = (i: number) => ({ "--i": i }) as CSSProperties;
export function HojaDemo() {
  const { total } = calcularTotales(ITEMS, 0);
  return (
    <div aria-hidden="true" className="asentar relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0 2xl:max-w-[34rem]" style={{ fontSize: "clamp(11px, 3.6cqw, 17px)" }}>
      <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-xl border border-borde bg-niebla" />
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-xl border border-borde bg-white" />
      <div className="relative rounded-xl border border-borde bg-white p-[1.5em] text-foreground">
        {/* Logo inventado, en su propia fila (como en el PDF): un rayo blanco sobre un cuadro en tinta */}
        <svg viewBox="0 0 44 44" className="mb-[0.5em] size-[2em]" role="img" aria-label="">
          <rect width="44" height="44" rx="10" fill="#000" />
          <path d="M25 8 12 25h9l-2 11 13-17h-9l2-11Z" fill="#fff" />
        </svg>
        <div className="flex items-start justify-between gap-[1em] border-b border-borde/70 pb-[1em]">
          <div>
            <p className="text-[1.125em] font-bold leading-tight">Instalaciones R. Sazo</p>
            <p className="text-[0.875em] text-muted">+56 9 1234 5678</p>
          </div>
          <div className="text-right text-[0.875em]">
            <p className="font-semibold">Presupuesto CP-2026-0001</p>
            <p className="text-muted">Para Juan Soto</p>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-borde/50 py-[0.5em] text-[0.875em]">
          {ITEMS.map((item, n) => (
            <li key={item.descripcion} className="entrar flex items-baseline justify-between gap-[1em] py-[0.625em]" style={turno(5 + n)}>
              <div>
                <p className="font-medium">{item.descripcion}</p>
                <p className="text-[0.75em] text-muted">
                  {cant(item.cantidad)} {simboloUnidad(item.unidad)} × {clp(item.precioUnitario)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{clp(totalLinea(item.cantidad, item.precioUnitario))}</p>
            </li>
          ))}
        </ul>

        <div className="entrar flex items-baseline justify-between border-t-2 border-foreground pt-[0.75em]" style={turno(9)}>
          <p className="font-semibold">Total</p>
          <p className="text-[1.5em] font-bold tabular-nums">{clp(total)}</p>
        </div>
        {/* Firma inventada: un trazo a mano sobre la línea, y debajo el bloque de firma del PDF; va al lado de la garantía para no alargar la hoja */}
        <div className="mt-[0.75em] flex items-end justify-between gap-[1em]">
          <p className="text-[0.75em] text-muted">Garantía 6 meses · Validez 15 días</p>
          <div className="w-[9em] shrink-0">
            <svg viewBox="0 0 176 44" className="firmar -mb-[0.25em] h-[2em] w-full" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path pathLength={1} d="M6 30c8-22 14-26 16-20 3 9-10 26-6 27 6 1 14-24 22-22 7 2-4 17 2 18 8 1 10-12 18-12 5 0 0 11 6 11 7 0 12-9 20-10 6-1 8 5 14 3 8-3 12-6 24-4" />
            </svg>
            <div className="border-t border-foreground pt-1 text-[0.6875em] leading-tight">
              <p className="font-semibold">Firma: R. Sazo</p>
              <p className="text-muted">+56 9 1234 5678 · contacto@rsazo.cl</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
