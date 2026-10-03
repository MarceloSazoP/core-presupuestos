"use client";

import { useActionState } from "react";
import { enviarCorreoAction, type EstadoCorreo } from "../actions";

export function EnviarCorreo({ destino }: { destino: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCorreo>(enviarCorreoAction, {});

  return (
    <form action={accion} className="flex flex-col gap-1.5">
      <button type="submit" className="boton-secundario" disabled={pendiente}>
        {pendiente && <span className="spinner" aria-hidden="true" />}
        {pendiente ? "Enviando…" : "Enviar a correo"}
      </button>
      <p className="ayuda">Se envía con el PDF adjunto a {destino}.</p>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${estado.ok ? "text-ok" : "text-error"}`}>
        {estado.mensaje}
      </p>
    </form>
  );
}
