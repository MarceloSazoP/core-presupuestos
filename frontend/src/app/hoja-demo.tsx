import { cant, clp } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { calcularTotales, totalLinea } from "@/lib/totales";

const ITEMS = [
  { descripcion: "Instalación de enchufes", cantidad: 4, unidad: "un", precioUnitario: 12500 },
  { descripcion: "Cable 2,5 mm²", cantidad: 30, unidad: "m", precioUnitario: 890 },
  { descripcion: "Revisión de tablero", cantidad: 1, unidad: "gl", precioUnitario: 35000 },
];

// Muestra de cómo queda un presupuesto, con la hoja apilada como un talonario en triplicado.
export function HojaDemo() {
  const { total } = calcularTotales(ITEMS, 0);
  return (
    <div aria-hidden="true" className="asentar relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
      <div className="absolute inset-0 translate-x-5 translate-y-5 rotate-[3deg] rounded-md bg-rosa" />
      <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rotate-[1.5deg] rounded-md" style={{ background: "oklch(0.93 0.035 240)" }} />
      <div className="relative -rotate-[1.5deg] rounded-md bg-white p-6 text-tinta ring-1 ring-tinta/15">
        <div className="flex items-start justify-between gap-4 border-b border-tinta/15 pb-4">
          <div>
            <p className="text-lg font-bold leading-tight">Instalaciones Pérez</p>
            <p className="text-sm text-muted">+56 9 1234 5678</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Presupuesto CP-2026-0001</p>
            <p className="text-muted">Para Juan Soto</p>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-tinta/10 py-2 text-sm">
          {ITEMS.map((item) => (
            <li key={item.descripcion} className="flex items-baseline justify-between gap-4 py-2.5">
              <div>
                <p className="font-medium">{item.descripcion}</p>
                <p className="text-xs text-muted">
                  {cant(item.cantidad)} {simboloUnidad(item.unidad)} × {clp(item.precioUnitario)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{clp(totalLinea(item.cantidad, item.precioUnitario))}</p>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t-2 border-tinta pt-3">
          <p className="font-semibold">Total</p>
          <p className="text-2xl font-bold tabular-nums">{clp(total)}</p>
        </div>
        <p className="mt-3 text-xs text-muted">Garantía 6 meses · Validez 15 días</p>
      </div>
    </div>
  );
}
