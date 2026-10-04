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
    <section aria-labelledby="multimedia" className="flex flex-col gap-3 @3xl:col-span-2">
      <h3 id="multimedia" className="etiqueta uppercase tracking-wide text-muted">
        Fotos y notas de voz <span className="font-normal normal-case">(internas, no salen en el PDF)</span>
      </h3>
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
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/65 text-lg leading-none text-white hover:bg-black/80"
                >
                  ×
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
