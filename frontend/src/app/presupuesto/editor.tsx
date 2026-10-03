"use client";

import { useActionState, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { clp } from "@/lib/formato";
import { GARANTIAS, UNIDAD_POR_DEFECTO, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, salirAction, type EstadoEdicion } from "../actions";
import { EnviarCorreo } from "./enviar-correo";
import { GrillaItems, type Fila } from "./grilla-items";

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
const filaVacia = (clave: number): Fila => ({ clave, descripcion: "", cantidad: "1", unidad: UNIDAD_POR_DEFECTO, precio: "" });

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
      : [filaVacia(1)],
  );
  const [descuento, setDescuento] = useState(inicial.descuento > 0 ? String(inicial.descuento) : "");
  const [servicio, setServicio] = useState(inicial.descripcion);
  const [garantia, setGarantia] = useState(inicial.garantia);
  const [validez, setValidez] = useState(String(inicial.validezDias));
  const [observaciones, setObservaciones] = useState(inicial.observaciones ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [intentoTerminar, setIntentoTerminar] = useState(false);

  // <form action> reinicia el formulario al terminar y los <select> vuelven a su valor inicial en pantalla (y se
  // reenviaría el viejo). Enviando con onSubmit y una transición no hay reinicio. method="post" evita que, si el envío
  // ocurre antes de cargar el JavaScript, los datos viajen en la URL.
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfirmando(false);
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    enTransicion(() => accion(datos));
  };
  const salir = () => enTransicion(() => salirAction());

  const agregar = () => setFilas((actuales) => [...actuales, filaVacia(Math.max(...actuales.map((f) => f.clave)) + 1)]);

  // Enter nunca envía el formulario (terminar es irreversible); dentro de la grilla lo maneja ella misma.
  const alPulsarTecla = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") return setConfirmando(false);
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
  };

  const sinItems = filas.every((f) => !f.descripcion.trim() || !f.precio.trim());
  const totales = calcularTotales(
    filas.map((f) => ({ descripcion: f.descripcion, cantidad: aNumero(f.cantidad), precioUnitario: aEntero(f.precio) })),
    aEntero(descuento),
  );
  const descuentoExcesivo = totales.total < 0;

  const intentarTerminar = () => {
    setIntentoTerminar(true);
    if (!sinItems && !descuentoExcesivo) setConfirmando(true);
  };

  if (estado.terminado) {
    const { numero, total, correo, whatsappUrl } = estado.terminado;
    return (
      <section aria-labelledby="listo" className="flex w-full max-w-2xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="estado estado-cerrado self-start">Cerrado</span>
          <h2 id="listo" className="text-2xl font-semibold">
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
    <form
      method="post"
      onSubmit={enviar}
      onKeyDown={alPulsarTecla}
      className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[18rem_minmax(0,1fr)_22rem]"
    >
      {/* Columna 1: contexto que viene del móvil (solo lectura) */}
      <aside className="flex flex-col gap-4 lg:row-span-2 lg:sticky lg:top-6 xl:row-span-1">
        <section aria-labelledby="levantamiento" className="tarjeta flex flex-col gap-2 text-sm">
          <h2 id="levantamiento" className="seccion">
            Levantamiento
          </h2>
          <p className="ayuda">Viene de la app móvil. Es interno: no aparece en el PDF.</p>
          {inicial.levantamiento.notas ? <p>{inicial.levantamiento.notas}</p> : <p className="text-muted">Sin notas.</p>}
          {inicial.levantamiento.medidas.length > 0 && (
            <dl className="flex flex-col gap-1 border-t border-borde pt-2">
              {inicial.levantamiento.medidas.map((m) => (
                <div key={m.etiqueta} className="flex justify-between gap-3">
                  <dt className="text-muted">{m.etiqueta}</dt>
                  <dd className="font-medium tabular-nums">{m.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section aria-labelledby="cliente" className="tarjeta flex flex-col gap-1 text-sm">
          <h2 id="cliente" className="seccion">
            Cliente
          </h2>
          <p>{inicial.cliente.nombre}</p>
          <p className="text-muted">{inicial.cliente.correo}</p>
          <p className="text-muted">{inicial.cliente.telefono}</p>
        </section>
      </aside>

      {/* Columna 2: lo que se completa */}
      <div className="@container flex min-w-0 flex-col gap-8">
        <section className="flex flex-col gap-2">
          <label htmlFor="descripcion" className="seccion">
            Servicio
          </label>
          <p id="servicio-ayuda" className="ayuda">
            Qué trabajo se va a hacer. Aparece en el PDF.
          </p>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            maxLength={2000}
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            aria-describedby="servicio-ayuda"
            className="campo"
          />
        </section>

        <section aria-labelledby="titulo-items" className="flex flex-col gap-3">
          <h2 id="titulo-items" className="seccion">
            Ítems
          </h2>
          <GrillaItems filas={filas} onChange={setFilas} onAgregar={agregar} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={agregar} className="boton-secundario">
              + Agregar ítem
            </button>
            <p className="ayuda">Enter confirma y pasa a la celda siguiente; tras el último precio crea otra fila. Escribe sobre una celda para editarla.</p>
          </div>
        </section>

        <section aria-labelledby="titulo-condiciones" className="flex flex-col gap-4">
          <h2 id="titulo-condiciones" className="seccion">
            Condiciones
          </h2>
          <div className="grid gap-4 @xl:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="garantia" className="etiqueta">
                Garantía
              </label>
              <select id="garantia" name="garantia" value={garantia} onChange={(e) => setGarantia(e.target.value)} className="campo">
                {GARANTIAS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="validezDias" className="etiqueta">
                Validez del presupuesto
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
          <div className="flex flex-col gap-1">
            <label htmlFor="observaciones" className="etiqueta">
              Observaciones (opcional)
            </label>
            <p id="obs-ayuda" className="ayuda">
              Condiciones o aclaraciones para el cliente. Aparecen en el PDF.
            </p>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              maxLength={5000}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              aria-describedby="obs-ayuda"
              className="campo"
            />
          </div>
        </section>
      </div>

      {/* Columna 3: resumen y acciones */}
      <aside className="flex flex-col gap-4 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-6">
        <section aria-labelledby="titulo-resumen" className="tarjeta flex flex-col gap-3">
          <h2 id="titulo-resumen" className="seccion">
            Resumen
          </h2>
          <dl className="flex flex-col gap-2 tabular-nums">
            <div className="flex justify-between gap-3 text-muted">
              <dt>Subtotal</dt>
              <dd>{clp(totales.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="descuento" className="etiqueta">
                  Descuento
                </label>
              </dt>
              <dd>
                <input
                  id="descuento"
                  name="descuento"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="$0"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  aria-invalid={descuentoExcesivo}
                  className="campo w-32 text-right"
                />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-borde pt-3">
              <dt className="font-medium">Total</dt>
              <dd className={`text-2xl font-semibold ${descuentoExcesivo ? "text-error" : ""}`} aria-live="polite">
                {clp(totales.total)}
              </dd>
            </div>
          </dl>
          {descuentoExcesivo && <p className="text-sm text-error">El descuento no puede superar el subtotal.</p>}
        </section>

        {estado.errores && (
          <ul role="alert" className="list-disc pl-5 text-sm text-error">
            {estado.errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {intentoTerminar && sinItems && (
          <p role="alert" className="text-sm text-error">
            Agrega al menos un ítem con descripción y precio.
          </p>
        )}
        {estado.guardado && (
          <p role="status" className="text-sm text-ok">
            {estado.guardado}
          </p>
        )}

        {confirmando ? (
          <div role="group" aria-labelledby="confirmar" className="tarjeta flex flex-col gap-3 border-aviso">
            <p id="confirmar" className="font-medium">
              ¿Cerrar y enviar este presupuesto?
            </p>
            <p className="ayuda">
              Se enviará el PDF a {inicial.cliente.correo} y ya no podrás editarlo.
            </p>
            <button type="submit" name="accion" value="terminar" className="boton" disabled={pendiente}>
              Sí, terminar y enviar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="boton-secundario">
              Volver a editar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={intentarTerminar} className="boton" disabled={pendiente}>
              {pendiente && <span className="spinner" aria-hidden="true" />}
              {pendiente ? "Procesando…" : "Terminar y enviar"}
            </button>
            <button type="submit" name="accion" value="guardar" className="boton-secundario" disabled={pendiente}>
              Guardar y seguir después
            </button>
            <button type="button" onClick={salir} className="boton-texto">
              Consultar otro presupuesto
            </button>
          </div>
        )}
      </aside>
    </form>
  );
}
