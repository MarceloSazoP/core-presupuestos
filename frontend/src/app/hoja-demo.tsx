import { cant, clp } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { calcularTotales, totalLinea } from "@/lib/totales";

const ITEMS = [
  { descripcion: "Instalación de enchufes", cantidad: 4, unidad: "un", precioUnitario: 12500 },
  { descripcion: "Cable 2,5 mm²", cantidad: 30, unidad: "m", precioUnitario: 890 },
  { descripcion: "Revisión de tablero", cantidad: 1, unidad: "gl", precioUnitario: 35000 },
];

// Muestra de cómo queda un presupuesto: una hoja blanca que flota sobre dos copias, con la sombra de tres capas.
export function HojaDemo() {
  const { total } = calcularTotales(ITEMS, 0);
  return (
    <div aria-hidden="true" className="asentar relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0 2xl:max-w-[34rem]" style={{ fontSize: "clamp(11px, 3.6cqw, 17px)" }}>
      <div className="absolute inset-0 translate-x-5 translate-y-5 rotate-[3deg] rounded-[18px] bg-white/50" style={{ boxShadow: "var(--sombra-flotante)" }} />
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rotate-[1.5deg] rounded-[18px] bg-white/75" style={{ boxShadow: "var(--sombra-flotante)" }} />
      <div className="relative -rotate-[1.5deg] rounded-[18px] bg-white p-[1.5em] text-foreground" style={{ boxShadow: "var(--sombra-flotante)" }}>
        {/* Logo inventado, en su propia fila (como en el PDF): un rayo blanco sobre un cuadro con el degradado de la marca */}
        <svg viewBox="0 0 44 44" className="mb-[0.5em] size-[2em]" role="img" aria-label="">
          <defs>
            <linearGradient id="hoja-demo-logo" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#995bb9" />
              <stop offset="0.55" stopColor="#5b638c" />
              <stop offset="1" stopColor="#3a4766" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#hoja-demo-logo)" />
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
          {ITEMS.map((item) => (
            <li key={item.descripcion} className="flex items-baseline justify-between gap-[1em] py-[0.625em]">
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

        <div className="flex items-baseline justify-between border-t-2 border-marino pt-[0.75em]">
          <p className="font-semibold">Total</p>
          <p className="text-[1.5em] font-bold tabular-nums">{clp(total)}</p>
        </div>
        {/* Firma inventada: un trazo a mano sobre la línea, y debajo el bloque de firma del PDF; va al lado de la garantía para no alargar la hoja */}
        <div className="mt-[0.75em] flex items-end justify-between gap-[1em]">
          <p className="text-[0.75em] text-muted">Garantía 6 meses · Validez 15 días</p>
          <div className="w-[9em] shrink-0">
            <svg viewBox="0 0 176 44" className="-mb-[0.25em] h-[2em] w-full" fill="none" stroke="var(--marino)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 30c8-22 14-26 16-20 3 9-10 26-6 27 6 1 14-24 22-22 7 2-4 17 2 18 8 1 10-12 18-12 5 0 0 11 6 11 7 0 12-9 20-10 6-1 8 5 14 3 8-3 12-6 24-4" />
            </svg>
            <div className="border-t border-marino pt-1 text-[0.6875em] leading-tight">
              <p className="font-semibold">Firma: R. Sazo</p>
              <p className="text-muted">+56 9 1234 5678 · contacto@rsazo.cl</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
