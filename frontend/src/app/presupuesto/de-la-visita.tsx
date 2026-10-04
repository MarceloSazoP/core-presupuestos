import type { ReactNode } from "react";

// Lo que el profesional anotó en terreno: notas, medidas, fotos y voz. Es interno (no sale en el PDF ni en la vista del
// cliente), y por eso se ve como la copia amarilla del talonario, separada de la hoja que sí recibe el cliente.
export function DeLaVisita({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="de-la-visita" className="nota flex flex-col gap-4 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 id="de-la-visita" className="seccion">
          De la visita
        </h3>
        <p className="nota-sello">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Solo para ti · no sale en el PDF
        </p>
      </div>
      {children}
    </section>
  );
}

// Medidas tomadas en la visita, cada una como un dato suelto («Largo del pasillo: 6,5 m»).
export function Medidas({ medidas }: { medidas: { etiqueta: string; valor: string }[] }) {
  if (medidas.length === 0) return null;
  return (
    <ul aria-label="Medidas" className="flex flex-wrap gap-2">
      {medidas.map((m) => (
        <li key={`${m.etiqueta}:${m.valor}`} className="nota-dato">
          {m.etiqueta}: <span className="font-semibold tabular-nums">{m.valor}</span>
        </li>
      ))}
    </ul>
  );
}
