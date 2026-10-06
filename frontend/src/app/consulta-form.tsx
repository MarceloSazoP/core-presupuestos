"use client";

import { useActionState, useState } from "react";
import { formatearCodigo } from "@/lib/codigo";
import { useAvisar, avisar } from "./avisos";
import { consultarAction, type EstadoConsulta } from "./actions";

export function ConsultaForm() {
  const [estado, accion, pendiente] = useActionState<EstadoConsulta, FormData>(consultarAction, {});
  const [codigo, setCodigo] = useState("");
  useAvisar(estado, () => estado.error && avisar("error", "No pudimos abrir el presupuesto", estado.error));

  return (
    <form action={accion} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label id="consultar" htmlFor="codigo" className="seccion text-lg">
          Consultar presupuesto
        </label>
        <p id="codigo-ayuda" className="ayuda">
          El código lo genera la app móvil al crear el presupuesto, por ejemplo 7K4M2Q-X9D2P4HTRB.
        </p>
      </div>
      <input
        id="codigo"
        name="codigo"
        type="text"
        required
        value={codigo}
        onChange={(e) => setCodigo(formatearCodigo(e.target.value))}
        minLength={17}
        maxLength={17}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="7K4M2Q-X9D2P4HTRB"
        className="campo font-mono uppercase tracking-wider"
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
