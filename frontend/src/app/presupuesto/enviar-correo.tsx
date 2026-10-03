"use client";

import { useActionState } from "react";
import { enviarCorreoAction, type EstadoCorreo } from "../actions";

export function EnviarCorreo({ destino }: { destino: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCorreo>(enviarCorreoAction, {});

  return (
    <form action={accion} className="flex flex-col gap-2">
      <button type="submit" className="boton-secundario" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Enviar a correo"}
      </button>
      <p className="text-sm text-muted">Se enviará con el PDF adjunto a {destino}.</p>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${estado.ok ? "text-ok" : "text-error"}`}>
        {estado.mensaje}
      </p>
    </form>
  );
}
