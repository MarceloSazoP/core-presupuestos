"use client";

import { Icono } from "./iconos";
import { avisar, useAvisar } from "../avisos";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { dinero, miles } from "@/lib/formato";
import { paisDe } from "@/lib/paises";
import { GARANTIAS, UNIDAD_POR_DEFECTO, VALIDEZ_DIAS } from "@/lib/opciones";
import { calcularTotales } from "@/lib/totales";
import { completarPresupuestoAction, type EstadoEdicion } from "../actions";
import { EnlaceWhatsApp } from "./enlace-whatsapp";
import { ContactoCliente } from "./contacto-cliente";
import { EnviarCorreo } from "./enviar-correo";
import { NotasVisita } from "./notas-visita";
import { CamposItems, GrillaItems, type Fila } from "./grilla-items";
import { ListaItemsMovil, useEsAngosto } from "./lista-items-movil";
import { DeLaVisita, Medidas } from "./de-la-visita";
import { Multimedia } from "./multimedia";

type Inicial = {
  descripcion: string;
  version: number;
  numeroAnterior: string | null;
  direccion: string | null;
  items: { tipo: "item" | "tarea"; descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
  descuento: number;
  conIva: boolean;
  moneda: string;
  impuesto: { nombre: string; tasa: number };
  pais: string;
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
  useAvisar(estado, () => estado.errores && avisar("error", "Revisa el presupuesto", estado.errores?.join(" · ")));
  useAvisar(estado, () => estado.guardado && avisar("exito", "Guardado", estado.guardado));
  useAvisar(estado, () => {
    const t = estado.terminado;
    if (!t) return;
    avisar("exito", `Presupuesto ${t.numero} terminado`, `Total ${t.total}`);
    if (!t.correo.ok) avisar("error", "El correo no se pudo enviar", t.correo.mensaje);
  });
  const { moneda, impuesto } = inicial; // los montos de este presupuesto, con su moneda y su impuesto
  const clp = (n: number) => dinero(n, moneda);
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
  const router = useRouter();
  const esAngosto = useEsAngosto(); // en el teléfono los ítems se editan como tarjetas (la grilla esconde el precio)
  const [hayNovedad, setHayNovedad] = useState(false);
  // En vivo: cuando alguien cambia el presupuesto desde otro lugar (la app), se recarga solo; si aquí hay cambios sin guardar no se
  // pisa nada y se avisa. Los avisos de nuestro propio guardado se ignoran.
  const estadoActual = JSON.stringify([filas, descuento, servicio, conIva, direccion, garantia, validez, observaciones]);
  const vivo = useRef({ actual: estadoActual, base: estadoActual, ignorarHasta: 0 });
  useEffect(() => {
    vivo.current.actual = estadoActual;
  }, [estadoActual]);
  useEffect(() => {
    if (pendiente) return;
    vivo.current.base = vivo.current.actual;
    vivo.current.ignorarHasta = Date.now() + 2500;
  }, [pendiente]);
  useEffect(() => {
    const es = new EventSource("/presupuesto/eventos");
    es.addEventListener("changed", () => {
      const v = vivo.current;
      if (Date.now() < v.ignorarHasta) return;
      if (v.actual !== v.base) setHayNovedad(true);
      else router.refresh();
    });
    return () => es.close();
  }, [router]);
  const formulario = useRef<HTMLFormElement>(null);
  const ventana = useRef<Window | null>(null);
  const [sinVentana, setSinVentana] = useState(false); // el navegador bloqueó la pestaña nueva: se ofrece un enlace
  // La vista previa se abre en otra pestaña que se crea al hacer clic (si no, el navegador la bloquea) y se completa cuando el guardado termina.
  useEffect(() => {
    const w = ventana.current;
    if (!w) return;
    ventana.current = null;
    if (estado.vistaPrevia) w.location.href = `/presupuesto/vista-previa?t=${estado.vistaPrevia}`;
    else w.close(); // el guardado falló (faltan datos): los errores se ven aquí
  }, [estado]);
  const previsualizar = () => {
    const f = formulario.current;
    if (!f) return;
    const w = window.open("", "_blank");
    w?.document.write('<p style="font-family:sans-serif;padding:2rem">Generando la vista previa…</p>');
    ventana.current = w;
    setSinVentana(!w);
    vivo.current.ignorarHasta = Date.now() + 30_000;
    const datos = new FormData(f);
    datos.set("accion", "previsualizar");
    enTransicion(() => accion(datos));
  };
  // El total de la barra fija solo se muestra cuando el resumen (con el mismo total) no está a la vista: así no aparece dos veces.
  const resumen = useRef<HTMLElement>(null);
  const [resumenVisible, setResumenVisible] = useState(false);
  useEffect(() => {
    const el = resumen.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setResumenVisible(e!.isIntersecting), { rootMargin: "0px 0px -72px 0px" }); // lo tapado por la barra no cuenta
    io.observe(el);
    return () => io.disconnect();
  }, []);
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
    vivo.current.ignorarHasta = Date.now() + 30_000; // hasta que termine el guardado, sus avisos son nuestros
    setConfirmando(false);
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    enTransicion(() => accion(datos));
    // El servidor ya ignoró las filas en blanco (Enter deja una al final): también se quitan de la grilla, dejando una si no queda ninguna.
    setFilas((actuales) => {
      const llenas = actuales.filter((f) => f.descripcion.trim() || f.precio.trim());
      return llenas.length > 0 ? llenas : actuales.slice(0, 1);
    });
  };

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
    impuesto.tasa,
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

  // Pantallas anchas: [título · «De la visita» · hoja del presupuesto] a la izquierda y [resumen con el total y las acciones] fijo a la
  // derecha. Más angostas: una columna en ese mismo orden y una barra fija abajo con el total y la acción principal.
  return (
    <form ref={formulario} method="post" onSubmit={enviar} onKeyDown={alPulsarTecla} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        {hayNovedad && (
          <p role="status" className="aparecer flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aviso p-3 text-sm">
            Hay cambios nuevos hechos desde otro lugar.
            <button
              type="button"
              onClick={() => {
                setHayNovedad(false);
                router.refresh();
              }}
              className="boton-secundario"
            >
              Actualizar (se pierde lo que no guardaste)
            </button>
          </p>
        )}

        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.015em]">Presupuesto de {inicial.cliente.nombre}</h2>
            <span className="estado estado-pendiente">Borrador{inicial.version > 1 ? ` · Versión ${inicial.version}` : ""}</span>
          </div>
          {inicial.numeroAnterior && <p className="text-sm text-muted">Reemplaza al presupuesto {inicial.numeroAnterior}</p>}
          <p className="max-w-prose text-muted">Lo que completes en la hoja sale en el PDF del cliente. Lo que anotaste en la visita es solo para ti.</p>
        </header>

        <DeLaVisita>
          <NotasVisita notas={inicial.levantamiento.notas} />
          <Medidas medidas={inicial.levantamiento.medidas} />
          <Multimedia fotos={inicial.levantamiento.fotos} audios={inicial.levantamiento.audios} editable />
        </DeLaVisita>

        {/* La hoja: lo que recibe el cliente, en el orden del PDF. */}
        <section aria-label="Hoja del presupuesto" className="tarjeta @container flex flex-col gap-10 p-5 sm:p-8">
          <section aria-labelledby="cliente" className="flex flex-col gap-1">
            <h3 id="cliente" className="seccion flex items-center gap-2">
              <Icono n="usuario" />
              Cliente
            </h3>
            <ContactoCliente nombre={inicial.cliente.nombre} telefono={inicial.cliente.telefono} correo={inicial.cliente.correo} prefijo={paisDe(inicial.pais).calling_code} />
          </section>

          {/* Servicio y dirección son un solo grupo: más cerca entre sí que del resto. */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <label htmlFor="descripcion" className="etiqueta">
                Servicio
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                rows={2}
                maxLength={2000}
                autoFocus={!servicio.trim()}
                placeholder="Qué trabajo se va a hacer"
                value={servicio}
                onChange={(e) => setServicio(e.target.value)}
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="direccion" className="etiqueta">
                Dirección del trabajo <span className="ayuda">(opcional)</span>
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
            </div>
          </div>

          <section aria-labelledby="titulo-items" className="flex flex-col gap-3">
            <h3 id="titulo-items" className="seccion flex items-center gap-2">
              <Icono n="lista" />
              Ítems y tareas
            </h3>
            {esAngosto ? <ListaItemsMovil moneda={moneda} filas={filas} onChange={setFilas} /> : <GrillaItems moneda={moneda} filas={filas} onChange={setFilas} onAgregar={() => agregar("item")} />}
            <CamposItems filas={filas} />
            <div className="-ml-4 flex flex-wrap items-center gap-x-2 gap-y-2">
              <button type="button" onClick={() => agregar("item")} className="boton-suave">
                <Icono n="mas" tamano={16} />
                Agregar ítem
              </button>
              <button type="button" onClick={() => agregar("tarea")} className="boton-suave" title="Una actividad sin cantidad ni unidad, por ejemplo botar escombros">
                <Icono n="mas" tamano={16} />
                Agregar tarea
              </button>
              {!esAngosto && <p className="ayuda">Enter pasa a la celda siguiente y, al final, crea otra fila.</p>}
            </div>
          </section>

          <section aria-labelledby="titulo-condiciones" className="flex flex-col gap-4">
            <h3 id="titulo-condiciones" className="seccion flex items-center gap-2">
              <Icono n="condiciones" />
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
                Observaciones <span className="ayuda">(opcional)</span>
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={3}
                maxLength={5000}
                placeholder="Aclaraciones para el cliente"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="campo"
              />
            </div>
          </section>
        </section>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
        <section ref={resumen} aria-labelledby="titulo-resumen" className="tarjeta flex flex-col gap-4 p-5 sm:p-6">
          <h3 id="titulo-resumen" className="seccion flex items-center gap-2">
            <Icono n="resumen" />
            Resumen
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
                  value={miles(descuento, moneda)}
                  onChange={(e) => setDescuento(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  aria-invalid={descuentoExcesivo}
                  className="campo w-32 text-right"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label htmlFor="iva" className="etiqueta">
                  Agregar {impuesto.nombre} ({impuesto.tasa}%)
                </label>
              </dt>
              <dd>
                {/* El casillero nativo no crece con relleno: la etiqueta que lo envuelve da el área de 44 px. */}
                <label className="-mr-2.5 grid size-11 cursor-pointer place-items-center">
                  <input id="iva" name="iva" value="1" type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} className="size-6 cursor-pointer accent-[var(--acento-texto)]" />
                </label>
              </dd>
            </div>
            {conIva && (
              <div className="flex justify-between gap-3 text-muted">
                <dt>{impuesto.nombre} ({impuesto.tasa}%)</dt>
                <dd>{clp(totales.iva)}</dd>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-foreground pt-3">
              <dt className="text-lg font-semibold">Total</dt>
              <dd className={`text-[2rem] font-bold leading-none tracking-[-0.02em] ${descuentoExcesivo ? "text-error" : ""}`} aria-live="polite">
                {clp(totales.total)}
              </dd>
            </div>
          </dl>
          {descuentoExcesivo && <p className="text-sm text-error">El descuento no puede superar el subtotal.</p>}

          {estado.errores && (
            <ul role="alert" className="aparecer list-disc pl-5 text-sm text-error">
              {estado.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {intentoTerminar && sinItems && (
            <p role="alert" className="aparecer text-sm text-error">
              Agrega al menos un ítem con descripción y precio.
            </p>
          )}
          {sinVentana && estado.vistaPrevia && (
            <p role="status" className="aparecer text-sm">
              El navegador bloqueó la pestaña nueva.{" "}
              <a href={`/presupuesto/vista-previa?t=${estado.vistaPrevia}`} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
                Abrir la vista previa
              </a>
            </p>
          )}
          {estado.guardado && (
            <p role="status" className="aparecer text-sm text-ok">
              {estado.guardado}
            </p>
          )}

          {/* En pantallas anchas las acciones viven aquí, junto al total; en las demás, en la barra fija de abajo. */}
          <div className="hidden flex-col gap-3 border-t border-borde pt-4 xl:flex">
            <button type="button" onClick={intentarTerminar} className="boton w-full" disabled={pendiente}>
              {pendiente && <span className="spinner" aria-hidden="true" />}
              {pendiente ? "Procesando…" : (<><Icono n="enviar" />Terminar y enviar</>)}
            </button>
            <button type="submit" name="accion" value="guardar" className="boton-secundario w-full" disabled={pendiente}>
              <Icono n="guardar" />Guardar y seguir después
            </button>
            <button type="button" onClick={previsualizar} className="boton-texto w-full" disabled={pendiente}>
              <Icono n="ojo" />Previsualizar presupuesto
            </button>
            <p className="ayuda text-center">Al terminar se numera, se genera el PDF y se envía al cliente.</p>
          </div>
        </section>

        <dialog ref={modal} aria-labelledby="confirmar" onClose={() => setConfirmando(false)} className="modal m-auto w-[min(92vw,26rem)] rounded-xl border border-borde bg-card p-5 text-foreground">
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
      </aside>

      {/* Lo que no cabe en la barra fija: en el teléfono, guardar y previsualizar; en tablet, solo previsualizar. */}
      <div className="flex flex-col gap-3 sm:items-start lg:hidden">
        <button type="submit" name="accion" value="guardar" className="boton-secundario sm:hidden" disabled={pendiente}>
          <Icono n="guardar" />Guardar y seguir después
        </button>
        <button type="button" onClick={previsualizar} className="boton-secundario" disabled={pendiente}>
          <Icono n="ojo" />Previsualizar presupuesto
        </button>
      </div>

      {/* Barra fija (hasta pantallas medianas): el total y las acciones siempre a la vista. Va de borde a borde de la página. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-borde bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:hidden">
        <p aria-hidden={resumenVisible} className={`flex flex-col leading-tight tabular-nums transition-opacity duration-150 motion-reduce:transition-none ${resumenVisible ? "opacity-0" : ""}`}>
          <span className="text-sm text-muted">Total</span>
          <span className={`text-2xl font-bold ${descuentoExcesivo ? "text-error" : ""}`}>{clp(totales.total)}</span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={previsualizar} className="boton-texto hidden whitespace-nowrap lg:inline-flex" disabled={pendiente}>
            <Icono n="ojo" />Previsualizar presupuesto
          </button>
          <button type="submit" name="accion" value="guardar" className="boton-secundario hidden whitespace-nowrap sm:inline-flex" disabled={pendiente}>
            <Icono n="guardar" />Guardar y seguir después
          </button>
          <button type="button" onClick={intentarTerminar} className="boton whitespace-nowrap" disabled={pendiente}>
            {pendiente && <span className="spinner" aria-hidden="true" />}
            {pendiente ? "Procesando…" : (<><Icono n="enviar" />Terminar y enviar</>)}
          </button>
        </div>
      </div>
    </form>
  );
}
