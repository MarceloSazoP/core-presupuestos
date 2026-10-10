"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { dinero, PAISES_ORDENADOS, tasaLegible } from "@/lib/paises";

// Portada, «Para los países de habla hispana»: se elige un país y la ficha muestra lo que la app usa en él (el impuesto con su tasa,
// la moneda, cómo se escriben los montos y el prefijo del teléfono). Es la misma tabla que usan la app y el servidor: si cambia una
// tasa, la portada la muestra sola. `children`: el título y la bajada de la sección.
const turno = (i: number) => ({ "--i": i }) as CSSProperties;
const bandera = (country: string) => `/banderas/${country.toLowerCase()}.png`; // flag-icons (MIT), PNG de 96 × 72

export function PaisesElegibles({ children }: { children: ReactNode }) {
  const [codigo, setCodigo] = useState("CL");
  const p = PAISES_ORDENADOS.find((x) => x.country === codigo) ?? PAISES_ORDENADOS[0]!;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-center lg:gap-16">
      <div className="flex flex-col gap-8">
        {children}
        {/* La ficha del país elegido: cambia con un fundido corto (.aparecer) cada vez que se elige otro. */}
        <div className="revelar flotante p-6" style={turno(1)} aria-live="polite">
          <div key={p.country} className="aparecer flex flex-col gap-4">
            <p className="flex items-center gap-3 text-xl font-semibold">
              <Image src={bandera(p.country)} alt="" width={40} height={30} unoptimized className="shrink-0 rounded-[3px] ring-1 ring-borde" />
              {p.name}
            </p>
            <p>
              <span className="text-6xl font-semibold tabular-nums tracking-[-0.03em]">{tasaLegible(p.vat_rate)} %</span>{" "}
              <span className="text-lg text-muted">{p.vat_label}</span>
            </p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5">
              <dt className="text-muted">Moneda</dt>
              <dd>
                {p.currency} ({p.symbol})
              </dd>
              <dt className="text-muted">Montos</dt>
              <dd className="tabular-nums">{dinero(1234567, p.currency)}</dd>
              <dt className="text-muted">Teléfonos</dt>
              <dd className="tabular-nums">{p.calling_code}</dd>
            </dl>
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Elige un país">
        {PAISES_ORDENADOS.map((x, n) => (
          <li key={x.country} className="revelar" style={turno(n % 3)}>
            <button type="button" aria-pressed={x.country === codigo} onClick={() => setCodigo(x.country)} className="pais">
              <Image src={bandera(x.country)} alt="" width={28} height={21} unoptimized className="shrink-0 rounded-[3px] ring-1 ring-borde" />
              <span className="min-w-0 flex-1 text-left leading-tight">{x.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted">{tasaLegible(x.vat_rate)} %</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
