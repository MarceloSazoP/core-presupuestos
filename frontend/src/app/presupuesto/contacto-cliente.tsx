"use client";

import { useState, useTransition } from "react";
import { corregirClienteAction } from "../actions";

// Teléfono y correo del cliente, siempre corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después, incluso con el presupuesto terminado. No lleva <form> propio: se usa dentro del formulario del editor.
export function ContactoCliente({ telefono, correo }: { telefono: string; correo: string | null }) {
  const [editando, setEditando] = useState(false);
  const [tel, setTel] = useState(telefono);
  const [mail, setMail] = useState(correo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setError(null);
      const r = await corregirClienteAction(tel, mail);
      if (r.error) return setError(r.error);
      setEditando(false);
    });

  if (!editando) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-muted">{telefono}</p>
          <p className="text-muted">{correo ?? "Sin correo"}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTel(telefono);
            setMail(correo ?? "");
            setError(null);
            setEditando(true);
          }}
          className="boton-texto !min-h-0 !p-2"
          aria-label="Corregir teléfono o correo"
          title="Corregir teléfono o correo"
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
    <div className="flex flex-col gap-3" role="group" aria-label="Corregir el teléfono y el correo del cliente">
      <label className="flex flex-col gap-1">
        <span className="etiqueta">Teléfono del cliente</span>
        <input type="tel" inputMode="tel" autoComplete="off" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="9 1234 5678" className="campo" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="etiqueta">Correo del cliente</span>
        <input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="Déjalo vacío si no tiene" className="campo" />
      </label>
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
