"use client";

import { useState, useTransition } from "react";
import { bandera, PAISES_ORDENADOS, separarTelefono } from "@/lib/paises";
import { formatearTelefono, plantillaTelefono } from "@/lib/telefono";
import { corregirClienteAction } from "../actions";

// Teléfono y correo del cliente, siempre corregibles (Contrato API §6): el cliente suele equivocarse al dárselos y los confirma
// después, incluso con el presupuesto terminado. No lleva <form> propio: se usa dentro del formulario del editor.
export function ContactoCliente({ nombre, telefono, correo, prefijo }: { nombre?: string; telefono: string; correo: string | null; prefijo?: string }) {
  const [editando, setEditando] = useState(false);
  const [nom, setNom] = useState(nombre ?? "");
  const [cod, setCod] = useState(() => separarTelefono(telefono, prefijo ?? "+56").codigo); // el país del número (su prefijo)
  const [tel, setTel] = useState(() => separarTelefono(telefono, prefijo ?? "+56").nacional);
  const [mail, setMail] = useState(correo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setError(null);
      const r = await corregirClienteAction(tel, mail, nombre === undefined ? undefined : nom, cod);
      if (r.error) return setError(r.error);
      setEditando(false);
    });

  if (!editando) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          {nombre !== undefined && <p className="text-lg font-semibold text-foreground">{nombre}</p>}
          <p className="text-muted">{telefono}</p>
          <p className="text-muted">{correo ?? "Sin correo"}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNom(nombre ?? "");
            const sep = separarTelefono(telefono, prefijo ?? "+56");
            setTel(sep.nacional);
            setCod(sep.codigo);
            setMail(correo ?? "");
            setError(null);
            setEditando(true);
          }}
          className="boton-icono -mr-2 -mt-2 shrink-0"
          aria-label="Corregir los datos del cliente"
          title="Corregir los datos del cliente"
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
    <div className="flex flex-col gap-3" role="group" aria-label="Corregir los datos del cliente">
      {nombre !== undefined && (
        <label className="flex flex-col gap-1">
          <span className="etiqueta">Nombre del cliente</span>
          <input type="text" autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} className="campo" />
        </label>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="tel-cliente" className="etiqueta">Teléfono del cliente</label>
        <div className="flex gap-2">
          {/* El código de país: Chile primero y luego todos por nombre. */}
          <select
            aria-label="Código de país"
            value={cod}
            onChange={(e) => {
              setCod(e.target.value);
              setTel(formatearTelefono(tel, e.target.value)); // lo ya escrito toma el formato del nuevo país
            }}
            className="campo w-auto shrink-0"
          >
            {PAISES_ORDENADOS.map((p) => (
              <option key={p.country} value={p.calling_code}>
                {bandera(p.country)} {p.name} {p.calling_code}
              </option>
            ))}
          </select>
          <input id="tel-cliente" type="tel" inputMode="tel" autoComplete="off" value={formatearTelefono(tel, cod)} onChange={(e) => setTel(formatearTelefono(e.target.value, cod))} maxLength={24} placeholder={plantillaTelefono(cod)} className="campo min-w-0 flex-1" />
        </div>
      </div>
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
