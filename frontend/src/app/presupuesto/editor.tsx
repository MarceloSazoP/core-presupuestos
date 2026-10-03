"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { clp } from "@/lib/formato";
import { GARANTIAS, GRUPOS_UNIDAD, textoUnidad, UNIDAD_POR_DEFECTO, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, salirAction, type EstadoEdicion } from "../actions";
import { EnviarCorreo } from "./enviar-correo";

type Fila = { clave: number; descripcion: string; cantidad: string; unidad: string; precio: string };

type Inicial = {
  descripcion: string;
  items: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
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

// En pantallas anchas: [contexto] [formulario] [resumen y acciones]. En el teléfono: una columna en ese mismo orden.
export function Editor({ inicial }: { inicial: Inicial }) {
  const [estado, accion, pendiente] = useActionState<EstadoEdicion, FormData>(completarPresupuestoAction, {});
  const [, enTransicion] = useTransition();
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial.items.length > 0
      ? inicial.items.map((it, i) => ({
          clave: i + 1,
          descripcion: it.descripcion,
          cantidad: String(it.cantidad).replace(".", ","),
          unidad: it.unidad,
          precio: String(it.precioUnitario),
        }))
      : [{ clave: 1, descripcion: "", cantidad: "1", unidad: UNIDAD_POR_DEFECTO, precio: "" }],
  );
  const [descuento, setDescuento] = useState(inicial.descuento > 0 ? String(inicial.descuento) : "");
  const [servicio, setServicio] = useState(inicial.descripcion);
  const [garantia, setGarantia] = useState(inicial.garantia);
  const [validez, setValidez] = useState(String(inicial.validezDias));
  const [observaciones, setObservaciones] = useState(inicial.observaciones ?? "");

  // <form action> reinicia el formulario al terminar y los <select> vuelven a su valor inicial en pantalla (y se
  // reenviaría el viejo). Enviando con onSubmit y una transición no hay reinicio. method="post" evita que, si el envío
  // ocurre antes de cargar el JavaScript, los datos viajen en la URL.
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    enTransicion(() => accion(datos));
  };
  const salir = () => enTransicion(() => salirAction());

  const cambiar = (clave: number, campo: keyof Omit<Fila, "clave">, valor: string) =>
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  const agregar = () =>
    setFilas((actuales) => [...actuales, { clave: Math.max(...actuales.map((f) => f.clave)) + 1, descripcion: "", cantidad: "1", unidad: UNIDAD_POR_DEFECTO, precio: "" }]);
  const quitar = (clave: number) => setFilas((actuales) => actuales.filter((f) => f.clave !== clave));

  const totales = calcularTotales(
    filas.map((f) => ({ descripcion: f.descripcion, cantidad: aNumero(f.cantidad), precioUnitario: aEntero(f.precio) })),
    aEntero(descuento),
  );

  if (estado.terminado) {
    const { numero, total, correo, whatsappUrl } = estado.terminado;
    return (
      <section aria-labelledby="listo" className="flex w-full flex-col gap-5">
        <div>
          <h2 id="listo" className="text-xl font-semibold">
            Presupuesto {numero} terminado
          </h2>
          <p className="text-muted">Total {total}</p>
        </div>

        <p role="status" aria-live="polite" className={correo.ok ? "text-ok" : "text-error"}>
          Correo: {correo.mensaje}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
    <form method="post" onSubmit={enviar} className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      {/* Columna 1: contexto que viene del móvil (solo lectura) */}
      <aside className="flex flex-col gap-4 lg:row-span-2 lg:sticky lg:top-6 xl:row-span-1">
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
          <p className="text-muted">{inicial.cliente.nombre}</p>
          <p className="text-muted">{inicial.cliente.correo}</p>
          <p className="text-muted">{inicial.cliente.telefono}</p>
          <p className="mt-2 text-muted">Al terminar, el PDF se envía a estos datos.</p>
        </section>
      </aside>

      {/* Columna 2: lo que se completa */}
      <div className="@container flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="descripcion" className="font-medium">
            Servicio
          </label>
          <textarea id="descripcion" name="descripcion" rows={2} maxLength={2000} value={servicio} onChange={(e) => setServicio(e.target.value)} className="campo" />
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-medium">Ítems</legend>
          {filas.map((fila, i) => (
            <div key={fila.clave} className="tarjeta grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_6rem_11rem_8.5rem_auto] @2xl:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor={`d-${fila.clave}`} className="text-sm text-muted">
                  Descripción {i + 1}
                </label>
                <input id={`d-${fila.clave}`} name="item_descripcion" maxLength={300} value={fila.descripcion} onChange={(e) => cambiar(fila.clave, "descripcion", e.target.value)} className="campo" />
              </div>
              <div className="grid grid-cols-[1fr_1.6fr] gap-3 @2xl:contents">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`c-${fila.clave}`} className="text-sm text-muted">
                    Cantidad
                  </label>
                  <input id={`c-${fila.clave}`} name="item_cantidad" inputMode="decimal" autoComplete="off" value={fila.cantidad} onChange={(e) => cambiar(fila.clave, "cantidad", e.target.value)} className="campo" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`u-${fila.clave}`} className="text-sm text-muted">
                    Unidad
                  </label>
                  <select id={`u-${fila.clave}`} name="item_unidad" value={fila.unidad} onChange={(e) => cambiar(fila.clave, "unidad", e.target.value)} className="campo">
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
                </div>
                <div className="col-span-2 flex flex-col gap-1 @2xl:col-span-1">
                  <label htmlFor={`p-${fila.clave}`} className="text-sm text-muted">
                    Precio unitario
                  </label>
                  <input id={`p-${fila.clave}`} name="item_precio" inputMode="numeric" autoComplete="off" placeholder="$0" value={fila.precio} onChange={(e) => cambiar(fila.clave, "precio", e.target.value)} className="campo" />
                </div>
              </div>
              {filas.length > 1 && (
                <button type="button" onClick={() => quitar(fila.clave)} className="boton-secundario" aria-label={`Quitar ítem ${i + 1}`}>
                  Quitar
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={agregar} className="boton-secundario">
            + Agregar ítem
          </button>
        </fieldset>

        <div className="grid gap-4 @xl:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="descuento" className="font-medium">
              Descuento (opcional)
            </label>
            <input id="descuento" name="descuento" inputMode="numeric" autoComplete="off" placeholder="$0" value={descuento} onChange={(e) => setDescuento(e.target.value)} className="campo" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="garantia" className="font-medium">
              Garantía
            </label>
            <select id="garantia" name="garantia" value={garantia} onChange={(e) => setGarantia(e.target.value)} className="campo">
              {GARANTIAS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="validezDias" className="font-medium">
              Validez
            </label>
            <select id="validezDias" name="validezDias" value={validez} onChange={(e) => setValidez(e.target.value)} className="campo">
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
          <textarea id="observaciones" name="observaciones" rows={3} maxLength={5000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="campo" />
        </div>
      </div>

      {/* Columna 3: resumen y acciones */}
      <aside className="flex flex-col gap-4 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-6">
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
          <button type="button" onClick={salir} className="boton-secundario">
            Consultar otro presupuesto
          </button>
        </div>
      </aside>
    </form>
  );
}
