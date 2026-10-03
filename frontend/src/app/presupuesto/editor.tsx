"use client";

import { useActionState, useState } from "react";
import { clp } from "@/lib/formato";
import { GARANTIAS, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, type EstadoEdicion } from "../actions";
import { EnviarCorreo } from "./enviar-correo";

type Fila = { clave: number; descripcion: string; cantidad: string; precio: string };

type Inicial = {
  descripcion: string;
  items: { descripcion: string; cantidad: number; precioUnitario: number }[];
  descuento: number;
  garantia: string;
  validezDias: number;
  observaciones: string | null;
  levantamiento: { notas: string | null; medidas: { etiqueta: string; valor: string }[] };
  cliente: { nombre: string; correo: string; telefono: string };
};

// Solo para la vista previa: el servidor vuelve a calcular y valida todo.
const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

export function Editor({ inicial }: { inicial: Inicial }) {
  const [estado, accion, pendiente] = useActionState<EstadoEdicion, FormData>(completarPresupuestoAction, {});
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial.items.length > 0
      ? inicial.items.map((it, i) => ({
          clave: i + 1,
          descripcion: it.descripcion,
          cantidad: String(it.cantidad).replace(".", ","),
          precio: String(it.precioUnitario),
        }))
      : [{ clave: 1, descripcion: "", cantidad: "1", precio: "" }],
  );
  const [descuento, setDescuento] = useState(inicial.descuento > 0 ? String(inicial.descuento) : "");

  const cambiar = (clave: number, campo: keyof Omit<Fila, "clave">, valor: string) =>
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  const agregar = () =>
    setFilas((actuales) => [...actuales, { clave: Math.max(...actuales.map((f) => f.clave)) + 1, descripcion: "", cantidad: "1", precio: "" }]);
  const quitar = (clave: number) => setFilas((actuales) => actuales.filter((f) => f.clave !== clave));

  const totales = calcularTotales(
    filas.map((f) => ({ descripcion: f.descripcion, cantidad: aNumero(f.cantidad), precioUnitario: aEntero(f.precio) })),
    aEntero(descuento),
  );

  if (estado.terminado) {
    const { numero, total, correo, whatsappUrl } = estado.terminado;
    return (
      <section aria-labelledby="listo" className="flex flex-col gap-5">
        <div>
          <h2 id="listo" className="text-xl font-semibold">
            Presupuesto {numero} terminado
          </h2>
          <p className="text-muted">Total {total}</p>
        </div>

        <p role="status" aria-live="polite" className={correo.ok ? "text-ok" : "text-error"}>
          Correo: {correo.mensaje}
        </p>

        <div className="flex flex-col gap-3">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="boton">
            Enviar por WhatsApp
          </a>
          {!correo.ok && <EnviarCorreo destino={inicial.cliente.correo} />}
          <a href="/presupuesto/pdf" download className="boton-secundario">
            Descargar PDF
          </a>
          <a href="/presupuesto" className="boton-secundario">
            Ver presupuesto
          </a>
        </div>
      </section>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-6">
      <section aria-labelledby="levantamiento" className="tarjeta flex flex-col gap-2 text-sm">
        <h2 id="levantamiento" className="font-medium">
          Levantamiento (desde el móvil)
        </h2>
        {inicial.levantamiento.notas ? <p>{inicial.levantamiento.notas}</p> : <p className="text-muted">Sin notas.</p>}
        {inicial.levantamiento.medidas.length > 0 && (
          <ul className="list-disc pl-5">
            {inicial.levantamiento.medidas.map((m) => (
              <li key={m.etiqueta}>
                {m.etiqueta}: {m.valor}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted">Es información interna: no aparece en el PDF.</p>
      </section>

      <section className="tarjeta text-sm">
        <p className="font-medium">Cliente</p>
        <p className="text-muted">
          {inicial.cliente.nombre} · {inicial.cliente.correo} · {inicial.cliente.telefono}
        </p>
        <p className="mt-1 text-muted">Al terminar, el PDF se envía a estos datos.</p>
      </section>

      <div className="flex flex-col gap-2">
        <label htmlFor="descripcion" className="font-medium">
          Servicio
        </label>
        <textarea id="descripcion" name="descripcion" rows={2} maxLength={2000} defaultValue={inicial.descripcion} className="campo" />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-medium">Ítems</legend>
        {filas.map((fila, i) => (
          <div key={fila.clave} className="tarjeta flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`d-${fila.clave}`} className="text-sm text-muted">
                Descripción {i + 1}
              </label>
              <input id={`d-${fila.clave}`} name="item_descripcion" maxLength={300} value={fila.descripcion} onChange={(e) => cambiar(fila.clave, "descripcion", e.target.value)} className="campo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={`c-${fila.clave}`} className="text-sm text-muted">
                  Cantidad
                </label>
                <input id={`c-${fila.clave}`} name="item_cantidad" inputMode="decimal" autoComplete="off" value={fila.cantidad} onChange={(e) => cambiar(fila.clave, "cantidad", e.target.value)} className="campo" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`p-${fila.clave}`} className="text-sm text-muted">
                  Precio unitario
                </label>
                <input id={`p-${fila.clave}`} name="item_precio" inputMode="numeric" autoComplete="off" placeholder="$0" value={fila.precio} onChange={(e) => cambiar(fila.clave, "precio", e.target.value)} className="campo" />
              </div>
            </div>
            {filas.length > 1 && (
              <button type="button" onClick={() => quitar(fila.clave)} className="boton-secundario" aria-label={`Quitar ítem ${i + 1}`}>
                Quitar ítem
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={agregar} className="boton-secundario">
          + Agregar ítem
        </button>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="descuento" className="font-medium">
          Descuento (opcional)
        </label>
        <input id="descuento" name="descuento" inputMode="numeric" autoComplete="off" placeholder="$0" value={descuento} onChange={(e) => setDescuento(e.target.value)} className="campo" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="garantia" className="font-medium">
            Garantía
          </label>
          <select id="garantia" name="garantia" defaultValue={inicial.garantia} className="campo">
            {GARANTIAS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="validezDias" className="font-medium">
            Validez
          </label>
          <select id="validezDias" name="validezDias" defaultValue={String(inicial.validezDias)} className="campo">
            {VALIDEZ_DIAS.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="observaciones" className="font-medium">
          Observaciones (opcional)
        </label>
        <textarea id="observaciones" name="observaciones" rows={3} maxLength={5000} defaultValue={inicial.observaciones ?? ""} className="campo" />
      </div>

      <dl className="tarjeta flex flex-col gap-1 tabular-nums" aria-live="polite">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd>{clp(totales.subtotal)}</dd>
        </div>
        {totales.descuento > 0 && (
          <div className="flex justify-between text-muted">
            <dt>Descuento</dt>
            <dd>-{clp(totales.descuento)}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total</dt>
          <dd>{clp(totales.total)}</dd>
        </div>
      </dl>

      {estado.errores && (
        <ul role="alert" className="list-disc pl-5 text-sm text-error">
          {estado.errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {estado.guardado && (
        <p role="status" className="text-sm text-ok">
          {estado.guardado}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button type="submit" name="accion" value="terminar" className="boton" disabled={pendiente}>
          {pendiente ? "Procesando…" : "Terminar y enviar"}
        </button>
        <button type="submit" name="accion" value="guardar" className="boton-secundario" disabled={pendiente}>
          Guardar y seguir después
        </button>
      </div>
    </form>
  );
}
