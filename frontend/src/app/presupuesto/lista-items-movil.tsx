"use client";

import { useSyncExternalStore } from "react";
import { clp, milesConDecimal } from "@/lib/formato";
import { GRUPOS_UNIDAD, textoUnidad } from "@/lib/opciones";
import { totalLinea } from "@/lib/totales";
import { limpiarCantidad, limpiarPrecio, type Fila } from "./grilla-items";

const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

const ANGOSTO = "(max-width: 819px)"; // la grilla necesita ~710 px de ancho útil
// Teléfono y tablet vertical: la grilla no cabe (esconde el precio y el total), así que los ítems se editan como tarjetas. En el servidor se asume ancho.
export function useEsAngosto() {
  return useSyncExternalStore(
    (avisar) => {
      const m = matchMedia(ANGOSTO);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => matchMedia(ANGOSTO).matches,
    () => false,
  );
}

// Mismos datos y mismas reglas que la grilla (`Fila`): solo cambia cómo se presentan.
export function ListaItemsMovil({ filas, onChange }: { filas: Fila[]; onChange: (filas: Fila[]) => void }) {
  const cambiar = (clave: number, campos: Partial<Fila>) => onChange(filas.map((f) => (f.clave === clave ? { ...f, ...campos } : f)));
  return (
    <ul className="flex flex-col gap-3">
      {filas.map((f, n) => {
        const tarea = f.tipo === "tarea";
        const total = tarea ? (aEntero(f.precio) > 0 ? clp(aEntero(f.precio)) : "Incluido") : clp(totalLinea(aNumero(f.cantidad), aEntero(f.precio)));
        return (
          <li key={f.clave} className="flex flex-col gap-3 rounded-xl border border-borde bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="seccion">
                {tarea ? "Tarea" : "Ítem"} {n + 1}
              </p>
              {filas.length > 1 && (
                <button type="button" onClick={() => onChange(filas.filter((x) => x.clave !== f.clave))} aria-label={`Quitar la línea ${n + 1}`} className="boton-icono -mr-1 -mt-1 hover:!text-error">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="etiqueta">{tarea ? "Qué se hace" : "Descripción"}</span>
              <input
                type="text"
                maxLength={300}
                autoComplete="off"
                value={f.descripcion}
                onChange={(e) => cambiar(f.clave, { descripcion: e.target.value })}
                placeholder={tarea ? "Por ejemplo: botar escombros" : "Qué vas a hacer o vender"}
                className="campo"
              />
            </label>

            {tarea ? (
              <label className="flex flex-col gap-1">
                <span className="etiqueta">Valor (opcional)</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={f.precio ? clp(aEntero(f.precio)) : ""}
                  onChange={(e) => cambiar(f.clave, { precio: limpiarPrecio(e.target.value) })}
                  placeholder="$0"
                  className="campo text-right"
                />
                <span className="ayuda">Si lo dejas vacío, la tarea va incluida en el presupuesto.</span>
              </label>
            ) : (
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <label className="flex flex-col gap-1">
                  <span className="etiqueta">Cantidad</span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={milesConDecimal(f.cantidad)}
                    onChange={(e) => cambiar(f.clave, { cantidad: limpiarCantidad(e.target.value) })}
                    aria-invalid={aNumero(f.cantidad) <= 0}
                    className="campo text-right"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="etiqueta">Unidad</span>
                  <select value={f.unidad} onChange={(e) => cambiar(f.clave, { unidad: e.target.value })} className="campo">
                    {GRUPOS_UNIDAD.map((g) => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.unidades.map((u) => (
                          <option key={u.codigo} value={u.codigo}>
                            {textoUnidad(u)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="etiqueta">Precio unitario</span>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={f.precio ? clp(aEntero(f.precio)) : ""}
                    onChange={(e) => cambiar(f.clave, { precio: limpiarPrecio(e.target.value) })}
                    placeholder="$0"
                    className="campo text-right"
                  />
                </label>
              </div>
            )}

            <p className="flex items-baseline justify-between border-t border-borde pt-2 tabular-nums">
              <span className="text-sm text-muted">Total de la línea</span>
              <span className="text-lg font-semibold">{total}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
