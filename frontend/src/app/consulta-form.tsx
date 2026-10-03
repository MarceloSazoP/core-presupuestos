"use client";

import { useActionState } from "react";
import { consultarAction, type EstadoConsulta } from "./actions";

export function ConsultaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoConsulta, FormData>(consultarAction, {});

  return (
    <form action={accion} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label id="consultar" htmlFor="codigo" className="seccion text-lg">
          Consultar presupuesto
        </label>
        <p id="codigo-ayuda" className="ayuda">
          El código lo genera la app móvil al crear el presupuesto.
        </p>
      </div>
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
        placeholder="Por ejemplo: pre-1"
        className="campo"
        aria-invalid={Boolean(estado.error)}
        aria-describedby={estado.error ? "codigo-error codigo-ayuda" : "codigo-ayuda"}
      />
      <button type="submit" className="boton" disabled={pendiente}>
        {pendiente && <span className="spinner" aria-hidden="true" />}
        {pendiente ? "Consultando…" : "Consultar"}
      </button>
      <p id="codigo-error" role="alert" className="min-h-5 text-sm text-error">
        {estado.error}
      </p>
    </form>
  );
}
