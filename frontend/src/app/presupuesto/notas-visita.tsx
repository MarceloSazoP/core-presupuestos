"use client";

import { useState, useTransition } from "react";
import { guardarNotasAction } from "../actions";

// Notas de la visita, editables con el lápiz (Contrato API §6). No lleva <form> propio: se usa dentro del formulario del editor.
export function NotasVisita({ notas }: { notas: string | null }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setError(null);
      const r = await guardarNotasAction(texto);
      if (r.error) return setError(r.error);
      setEditando(false);
    });

  if (!editando) {
    return (
      <div className="flex items-start justify-between gap-2">
        {notas ? <p className="whitespace-pre-line">{notas}</p> : <p className="text-muted">Sin notas.</p>}
        <button
          type="button"
          onClick={() => {
            setTexto(notas ?? "");
            setError(null);
            setEditando(true);
          }}
          className="boton-texto !min-h-0 !p-2"
          aria-label="Editar las notas de la visita"
          title="Editar las notas de la visita"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        maxLength={10000}
        aria-label="Notas de la visita"
        className="campo"
        autoFocus
      />
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={enCurso} onClick={guardar} className="boton">
          {enCurso ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" disabled={enCurso} onClick={() => setEditando(false)} className="boton-secundario">
          Cancelar
        </button>
      </div>
    </div>
  );
}
