"use client";

import { useActionState } from "react";
import { consultarAction, type EstadoConsulta } from "./actions";

export function ConsultaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoConsulta, FormData>(consultarAction, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <label htmlFor="codigo" className="text-base font-medium">
        Consultar presupuesto
      </label>
      <input
        id="codigo"
        name="codigo"
        type="text"
        required
        maxLength={64}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Escribe el código, por ejemplo pre-1"
        className="campo"
        aria-invalid={Boolean(estado.error)}
        aria-describedby="codigo-estado"
      />
      <button type="submit" className="boton" disabled={pendiente}>
        {pendiente ? "Consultando…" : "Consultar"}
      </button>
      <p id="codigo-estado" role="status" aria-live="polite" className="min-h-6 text-sm text-error">
        {estado.error}
      </p>
    </form>
  );
}
