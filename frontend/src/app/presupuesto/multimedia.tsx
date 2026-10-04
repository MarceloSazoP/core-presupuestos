"use client";

import { useState, useTransition } from "react";
import { eliminarArchivoAction } from "../actions";

// Fotos y notas de voz de la visita. Son internas: no salen en el PDF ni en la vista pública. Mientras el presupuesto se
// puede editar (`editable`) cada una se puede eliminar, con una confirmación en el mismo lugar.
type Props = { fotos: string[]; audios: { id: string; segundos: number }[]; editable?: boolean };
type Objetivo = { tipo: "foto" | "audio"; id: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function Multimedia({ fotos, audios, editable = false }: Props) {
  const [confirmando, setConfirmando] = useState<Objetivo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const eliminar = ({ tipo, id }: Objetivo) =>
    empezar(async () => {
      setError(null);
      const r = await eliminarArchivoAction(tipo, id);
      if (r.error) setError(r.error);
      setConfirmando(null);
    });
  const es = (tipo: Objetivo["tipo"], id: string) => confirmando?.tipo === tipo && confirmando.id === id;

  if (fotos.length === 0 && audios.length === 0) return null;
  return (
    <section aria-labelledby="multimedia" className="flex flex-col gap-3">
      {/* Va dentro del panel «De la visita», que ya dice que es interno. */}
      <h4 id="multimedia" className="etiqueta">
        Fotos y notas de voz
      </h4>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {fotos.map((id, i) => (
            <li key={id} className="relative">
              <a href={`/presupuesto/archivo/${id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF; no hay nada que optimizar */}
                <img src={`/presupuesto/archivo/${id}?mini=1`} width={480} height={480} alt={`Foto ${i + 1} de la visita`} loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover" />
              </a>
              {editable && !es("foto", id) && (
                <button
                  type="button"
                  aria-label={`Eliminar la foto ${i + 1}`}
                  onClick={() => setConfirmando({ tipo: "foto", id })}
                  className="group absolute right-0 top-0 grid size-11 place-items-center" // área de 44 px; el círculo visible es más chico
                >
                  <span className="grid size-7 place-items-center rounded-full bg-black/65 text-white transition-colors group-hover:bg-black/80">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </span>
                </button>
              )}
              {editable && es("foto", id) && (
                <div role="group" aria-label={`Eliminar la foto ${i + 1}`} className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/75 p-2 text-center text-sm text-white">
                  <p>¿Eliminar?</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={enCurso} onClick={() => eliminar({ tipo: "foto", id })} className="rounded bg-white px-2 py-1 font-semibold text-black">
                      {enCurso ? "…" : "Sí"}
                    </button>
                    <button type="button" disabled={enCurso} onClick={() => setConfirmando(null)} className="rounded border border-white px-2 py-1">
                      No
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {audios.map((a, i) => (
        <div key={a.id} className="flex flex-col gap-1">
          <span className="text-sm text-muted">
            Nota de voz {i + 1} · {mmss(a.segundos)}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <audio controls preload="none" src={`/presupuesto/archivo/${a.id}`} className="min-w-0 flex-1" />
            {editable && !es("audio", a.id) && (
              <button type="button" onClick={() => setConfirmando({ tipo: "audio", id: a.id })} className="boton-texto" aria-label={`Eliminar la nota de voz ${i + 1}`}>
                Eliminar
              </button>
            )}
            {editable && es("audio", a.id) && (
              <span role="group" aria-label={`Eliminar la nota de voz ${i + 1}`} className="flex items-center gap-2 text-sm">
                ¿Eliminar?
                <button type="button" disabled={enCurso} onClick={() => eliminar({ tipo: "audio", id: a.id })} className="boton-secundario">
                  {enCurso ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button type="button" disabled={enCurso} onClick={() => setConfirmando(null)} className="boton-texto">
                  Cancelar
                </button>
              </span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
