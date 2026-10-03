"use client";

import { useActionState } from "react";
import { enviarCorreoAction, type EstadoCorreo } from "../actions";

// `destino` es el correo del cliente enmascarado; sin correo guardado se pide uno.
export function EnviarCorreo({ destino }: { destino: string | null }) {
  const [estado, accion, pendiente] = useActionState<EstadoCorreo, FormData>(enviarCorreoAction, {});

  return (
    <form action={accion} className="flex flex-col gap-1.5">
      {!destino && (
        <>
          <label htmlFor="para" className="etiqueta">
            Correo del cliente
          </label>
          <input id="para" name="para" type="email" required autoComplete="off" maxLength={254} placeholder="cliente@correo.cl" className="campo" />
        </>
      )}
      <button type="submit" className="boton-secundario" disabled={pendiente}>
        {pendiente && <span className="spinner" aria-hidden="true" />}
        {pendiente ? "Enviando…" : "Enviar a correo"}
      </button>
      <p className="ayuda">{destino ? `Se envía con el PDF adjunto a ${destino}.` : "Se envía con el PDF adjunto."}</p>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${estado.ok ? "text-ok" : "text-error"}`}>
        {estado.mensaje}
      </p>
    </form>
  );
}
