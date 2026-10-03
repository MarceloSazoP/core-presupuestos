import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { clp, cant, enmascararCorreo } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { cargarPresupuesto, esFinalizado } from "@/lib/presupuesto";
import { calcularTotales, totalLinea } from "@/lib/totales";
import { enlaceWhatsApp, mensajePresupuesto } from "@/lib/whatsapp";
import { salirAction } from "../actions";
import { Editor } from "./editor";
import { Encabezado } from "./encabezado";
import { EnlaceWhatsApp } from "./enlace-whatsapp";
import { EnviarCorreo } from "./enviar-correo";

export const metadata: Metadata = { title: "Presupuesto · CorePresupuesto" };

const LOGO = "/presupuesto/logo";

export default async function PresupuestoPage() {
  const cargado = await cargarPresupuesto();
  if (!cargado) redirect("/");
  const { presupuesto: p } = cargado;
  const logoSrc = p.profesional.tieneLogo ? LOGO : null;

  // Pendiente: se completa o se edita. Cerrado: solo se ve.
  if (!esFinalizado(p)) {
    return (
      <main className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:w-4/5 lg:px-0">
        <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
        <h1 className="sr-only">Completar presupuesto</h1>
        <Editor
          inicial={{
            descripcion: p.descripcion,
            items: p.items,
            descuento: p.descuento,
            garantia: p.garantia,
            validezDias: p.validezDias,
            observaciones: p.observaciones,
            levantamiento: p.levantamiento,
            cliente: { nombre: p.cliente.nombre, correo: p.cliente.correo && enmascararCorreo(p.cliente.correo), telefono: p.cliente.telefono },
          }}
        />
      </main>
    );
  }

  const { subtotal, descuento, total } = calcularTotales(p.items, p.descuento);
  const whatsappUrl = enlaceWhatsApp(
    p.cliente.telefono,
    mensajePresupuesto({ nombre: p.cliente.nombre, numero: p.numero, total: clp(total), descripcion: p.descripcion, enlace: p.publicUrl ?? "" }),
  );

  return (
    <main className="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:w-4/5 lg:px-0">
      <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
      <header className="flex flex-col items-start gap-2">
        <span className="estado estado-cerrado">Cerrado · {p.numero}</span>
        <h1 className="text-2xl font-semibold leading-tight">{p.descripcion}</h1>
        <p className="text-muted">Para {p.cliente.nombre}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-labelledby="detalle" className="tarjeta items flex flex-col gap-2">
          <h2 id="detalle" className="seccion">
            Detalle
          </h2>
          <div className="cab-lectura" aria-hidden="true">
            <span>Descripción</span>
            <span className="text-right">Cant.</span>
            <span>Unidad</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Total</span>
          </div>
          <ul>
            {p.items.map((item, i) => (
              <li key={i} className="fila-lectura">
                <p className="min-w-0">{item.descripcion}</p>
                <p className="solo-estrecho text-sm text-muted">
                  {cant(item.cantidad)} {simboloUnidad(item.unidad)} × {clp(item.precioUnitario)}
                </p>
                <p className="solo-ancho text-right tabular-nums">{cant(item.cantidad)}</p>
                <p className="solo-ancho">{simboloUnidad(item.unidad)}</p>
                <p className="solo-ancho text-right tabular-nums">{clp(item.precioUnitario)}</p>
                <p className="text-right font-medium tabular-nums">{clp(totalLinea(item.cantidad, item.precioUnitario))}</p>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-borde pt-3 tabular-nums">
            <div className="flex justify-between text-muted">
              <dt>Subtotal</dt>
              <dd>{clp(subtotal)}</dd>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-muted">
                <dt>Descuento</dt>
                <dd>-{clp(descuento)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <dt className="font-medium">Total</dt>
              <dd className="text-2xl font-semibold">{clp(total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section aria-labelledby="condiciones" className="tarjeta flex flex-col gap-2 text-sm">
            <h2 id="condiciones" className="seccion">
              Condiciones
            </h2>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Garantía</dt>
                <dd className="font-medium">{p.garantia}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Validez</dt>
                <dd className="font-medium">{p.validezDias} días</dd>
              </div>
            </dl>
            {p.observaciones && <p className="border-t border-borde pt-2">{p.observaciones}</p>}
          </section>

          <div className="flex flex-col gap-3">
            <a href="/presupuesto/pdf" download className="boton">
              Descargar PDF
            </a>
            <EnlaceWhatsApp href={whatsappUrl} className="boton-secundario" />
            <EnviarCorreo destino={p.cliente.correo && enmascararCorreo(p.cliente.correo)} />
            <form action={salirAction}>
              <button type="submit" className="boton-texto w-full">
                Consultar otro presupuesto
              </button>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}
