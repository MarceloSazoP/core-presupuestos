"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { clp, miles } from "@/lib/formato";
import { GARANTIAS, UNIDAD_POR_DEFECTO, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, salirAction, type EstadoEdicion } from "../actions";
import { EnlaceWhatsApp } from "./enlace-whatsapp";
import { ContactoCliente } from "./contacto-cliente";
import { EnviarCorreo } from "./enviar-correo";
import { NotasVisita } from "./notas-visita";
import { GrillaItems, type Fila } from "./grilla-items";
import { Multimedia } from "./multimedia";

type Inicial = {
  descripcion: string;
  version: number;
  numeroAnterior: string | null;
  direccion: string | null;
  items: { tipo: "item" | "tarea"; descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
  descuento: number;
  conIva: boolean;
  garantia: string;
  validezDias: number;
  observaciones: string | null;
  levantamiento: { notas: string | null; medidas: { etiqueta: string; valor: string }[]; fotos: string[]; audios: { id: string; segundos: number }[] };
  cliente: { nombre: string; correo: string | null; telefono: string };
};

// Solo para la vista previa: el servidor vuelve a calcular y valida todo.
const aNumero = (s: string) => Number(s.trim().replace(",", ".")) || 0;
const aEntero = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
const MAX_ITEMS = 100; // igual que el servidor
const filaVacia = (clave: number, tipo: Fila["tipo"] = "item"): Fila => ({ clave, tipo, descripcion: "", cantidad: "1", unidad: UNIDAD_POR_DEFECTO, precio: "" });

// En pantallas anchas: [contexto] [formulario] [resumen y acciones]. En el teléfono: una columna en ese mismo orden.
export function Editor({ inicial }: { inicial: Inicial }) {
  const [estado, accion, pendiente] = useActionState<EstadoEdicion, FormData>(completarPresupuestoAction, {});
  const [, enTransicion] = useTransition();
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial.items.length > 0
      ? inicial.items.map((it, i) => ({
          clave: i + 1,
          tipo: it.tipo,
          descripcion: it.descripcion,
          cantidad: String(it.cantidad).replace(".", ","),
          unidad: it.unidad,
          precio: it.tipo === "tarea" && it.precioUnitario === 0 ? "" : String(it.precioUnitario), // una tarea incluida se muestra sin valor
        }))
      : [filaVacia(1)],
  );
  const [descuento, setDescuento] = useState(inicial.descuento > 0 ? String(inicial.descuento) : "");
  const [servicio, setServicio] = useState(inicial.descripcion);
  const [conIva, setConIva] = useState(inicial.conIva);
  const [direccion, setDireccion] = useState(inicial.direccion ?? "");
  const [garantia, setGarantia] = useState(inicial.garantia);
  const [validez, setValidez] = useState(String(inicial.validezDias));
  const [observaciones, setObservaciones] = useState(inicial.observaciones ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [intentoTerminar, setIntentoTerminar] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = modal.current;
    if (!d) return;
    if (confirmando && !d.open) d.showModal();
    if (!confirmando && d.open) d.close();
  }, [confirmando]);

  // <form action> reinicia el formulario al terminar y los <select> vuelven a su valor inicial en pantalla (y se
  // reenviaría el viejo). Enviando con onSubmit y una transición no hay reinicio. method="post" evita que, si el envío
  // ocurre antes de cargar el JavaScript, los datos viajen en la URL.
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfirmando(false);
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    enTransicion(() => accion(datos));
    // El servidor ya ignoró las filas en blanco (Enter deja una al final): también se quitan de la grilla, dejando una si no queda ninguna.
    setFilas((actuales) => {
      const llenas = actuales.filter((f) => f.descripcion.trim() || f.precio.trim());
      return llenas.length > 0 ? llenas : actuales.slice(0, 1);
    });
  };
  const salir = () => enTransicion(() => salirAction());

  const agregar = (tipo: Fila["tipo"] = "item") =>
    setFilas((actuales) => (actuales.length >= MAX_ITEMS ? actuales : [...actuales, filaVacia(Math.max(...actuales.map((f) => f.clave)) + 1, tipo)]));

  // Enter nunca envía el formulario (terminar es irreversible): en un campo suelto pasa al siguiente. La grilla maneja el suyo.
  const alPulsarTecla = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") return setConfirmando(false);
    if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement) || e.target.closest(".ag-root-wrapper")) return;
    e.preventDefault();
    const campos = [...e.currentTarget.elements].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.matches("[type=hidden], :disabled, .ag-root-wrapper *"),
    );
    campos[campos.indexOf(e.target) + 1]?.focus();
  };

  // Una tarea no necesita precio (puede ir incluida); un ítem sí.
  const sinItems = filas.every((f) => !f.descripcion.trim() || (f.tipo === "item" && !f.precio.trim()));
  const totales = calcularTotales(
    filas.map((f) => ({ tipo: f.tipo, descripcion: f.descripcion, cantidad: aNumero(f.cantidad), precioUnitario: aEntero(f.precio) })),
    aEntero(descuento),
    conIva,
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
          <EnlaceWhatsApp href={whatsappUrl} className="boton" />
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
    <form method="post" onSubmit={enviar} onKeyDown={alPulsarTecla} className="@container flex flex-col gap-8 rounded-xl border border-borde bg-card p-5 shadow-sm sm:p-8 lg:p-10">
      {/* Como el PDF: cliente y visita arriba, servicio, ítems, condiciones a la izquierda y totales a la derecha */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-foreground pb-3">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Presupuesto</h2>
        <span className="estado estado-pendiente">Borrador{inicial.version > 1 ? ` · Versión ${inicial.version}` : ""}</span>
        {inicial.numeroAnterior && <p className="basis-full text-sm font-normal normal-case text-muted">Reemplaza al presupuesto {inicial.numeroAnterior}</p>}
      </div>

      <div className="grid gap-6 @3xl:grid-cols-2">
        <section aria-labelledby="cliente" className="flex flex-col gap-1">
          <h3 id="cliente" className="etiqueta uppercase tracking-wide text-muted">
            Cliente
          </h3>
          <p className="text-lg font-semibold">{inicial.cliente.nombre}</p>
          <ContactoCliente telefono={inicial.cliente.telefono} correo={inicial.cliente.correo} />
        </section>

        <section aria-labelledby="levantamiento" className="flex flex-col gap-1">
          <h3 id="levantamiento" className="etiqueta uppercase tracking-wide text-muted">
            Notas de la visita <span className="font-normal normal-case">(internas, no salen en el PDF)</span>
          </h3>
          <NotasVisita notas={inicial.levantamiento.notas} />
          {inicial.levantamiento.medidas.length > 0 && (
            <p className="text-sm text-muted">{inicial.levantamiento.medidas.map((m) => `${m.etiqueta}: ${m.valor}`).join(" · ")}</p>
          )}
        </section>

        <Multimedia fotos={inicial.levantamiento.fotos} audios={inicial.levantamiento.audios} editable />
      </div>

      <section className="flex flex-col gap-1">
        <label htmlFor="descripcion" className="etiqueta uppercase tracking-wide text-muted">
          Servicio
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          maxLength={2000}
          autoFocus={!servicio.trim()}
          placeholder="Qué trabajo se va a hacer (aparece en el PDF)"
          value={servicio}
          onChange={(e) => setServicio(e.target.value)}
          className="campo"
        />
      </section>

      <section className="flex flex-col gap-1">
        <label htmlFor="direccion" className="etiqueta uppercase tracking-wide text-muted">
          Dirección del trabajo <span className="font-normal normal-case">(opcional, aparece en el PDF)</span>
        </label>
        <input
          id="direccion"
          name="direccion"
          type="text"
          maxLength={300}
          autoComplete="off"
          placeholder="Calle, número y comuna"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="campo"
        />
      </section>

      <section aria-labelledby="titulo-items" className="flex flex-col gap-3">
        <h3 id="titulo-items" className="etiqueta uppercase tracking-wide text-muted">
          Ítems y tareas
        </h3>
        <GrillaItems filas={filas} onChange={setFilas} onAgregar={() => agregar("item")} enfocarAlCargar={Boolean(servicio.trim())} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={() => agregar("item")} className="boton-secundario">
            + Agregar ítem
          </button>
          <button type="button" onClick={() => agregar("tarea")} className="boton-secundario" title="Una actividad sin cantidad ni unidad, por ejemplo botar escombros">
            + Agregar tarea
          </button>
          <p className="ayuda">Enter confirma y pasa a la celda siguiente; tras el último precio crea otra fila.</p>
        </div>
      </section>

      <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_22rem] @3xl:items-start">
        <section aria-labelledby="titulo-condiciones" className="flex flex-col gap-4">
          <h3 id="titulo-condiciones" className="etiqueta uppercase tracking-wide text-muted">
            Condiciones
          </h3>
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
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              maxLength={5000}
              placeholder="Aclaraciones para el cliente (aparecen en el PDF)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="campo"
            />
          </div>
        </section>

        <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
          <h3 id="titulo-resumen" className="sr-only">
            Totales
          </h3>
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
                  value={miles(descuento)}
                  onChange={(e) => setDescuento(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  aria-invalid={descuentoExcesivo}
                  className="campo w-32 text-right"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="iva" className="etiqueta">
                  Agregar IVA (19%)
                </label>
              </dt>
              <dd>
                <input id="iva" name="iva" value="1" type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} className="size-5 accent-[var(--acento-texto)]" />
              </dd>
            </div>
            {conIva && (
              <div className="flex justify-between gap-3 text-muted">
                <dt>IVA (19%)</dt>
                <dd>{clp(totales.iva)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t-2 border-foreground pt-3">
              <dt className="font-bold uppercase">Total</dt>
              <dd className={`text-3xl font-bold ${descuentoExcesivo ? "text-error" : ""}`} aria-live="polite">
                {clp(totales.total)}
              </dd>
            </div>
          </dl>
          {descuentoExcesivo && <p className="text-sm text-error">El descuento no puede superar el subtotal.</p>}
        </section>
      </div>

      <div className="flex flex-col gap-4 border-t border-borde pt-6">
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

        <dialog ref={modal} aria-labelledby="confirmar" onClose={() => setConfirmando(false)} className="m-auto w-[min(92vw,26rem)] rounded-xl border-2 border-tinta bg-background p-5 text-foreground backdrop:bg-black/50">
          <div className="flex flex-col gap-3">
            <h2 id="confirmar" className="text-lg font-semibold">
              ¿Cerrar y enviar este presupuesto?
            </h2>
            <p className="ayuda">
              {inicial.cliente.correo ? `Se enviará el PDF a ${inicial.cliente.correo}` : "El cliente no tiene correo: se cerrará sin enviarlo"} y ya no podrás editarlo.
            </p>
            <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmando(false)} className="boton-secundario">
                Volver a editar
              </button>
              <button type="submit" name="accion" value="terminar" className="boton" disabled={pendiente}>
                Sí, terminar y enviar
              </button>
            </div>
          </div>
        </dialog>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={salir} className="boton-texto">
            Consultar otro presupuesto
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" name="accion" value="guardar" className="boton-secundario" disabled={pendiente}>
              Guardar y seguir después
            </button>
            <button type="button" onClick={intentarTerminar} className="boton" disabled={pendiente}>
              {pendiente && <span className="spinner" aria-hidden="true" />}
              {pendiente ? "Procesando…" : "Terminar y enviar"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
