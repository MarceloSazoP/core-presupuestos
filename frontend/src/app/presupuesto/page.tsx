import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { clp, cant, enmascararCorreo, enmascararTelefono } from "@/lib/formato";
import { esFinalizado, porId } from "@/lib/presupuestos";
import { sesionActual } from "@/lib/sesion";
import { calcularTotales, totalLinea } from "@/lib/totales";
import { salirAction } from "../actions";
import { Editor } from "./editor";
import { EnviarCorreo } from "./enviar-correo";

export const metadata: Metadata = { title: "Presupuesto · CorePresupuesto" };

const Salir = () => (
  <form action={salirAction}>
    <button type="submit" className="boton-secundario w-full">
      Consultar otro presupuesto
    </button>
  </form>
);

export default async function PresupuestoPage() {
  const id = await sesionActual();
  const p = id ? await porId(id) : null;
  if (!p) redirect("/");

  // Pendiente: se completa o se edita. Cerrado: solo se ve.
  if (!esFinalizado(p)) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted">Presupuesto pendiente</p>
          <h1 className="text-2xl font-semibold leading-tight">Completar presupuesto</h1>
        </header>
        <Editor
          inicial={{
            descripcion: p.descripcion,
            items: p.items,
            descuento: p.descuento,
            garantia: p.garantia,
            validezDias: p.validezDias,
            observaciones: p.observaciones,
            levantamiento: p.levantamiento,
            cliente: {
              nombre: p.cliente.nombre,
              correo: enmascararCorreo(p.cliente.correo),
              telefono: enmascararTelefono(p.cliente.telefono),
            },
          }}
        />
        <Salir />
      </main>
    );
  }

  const { subtotal, descuento, total } = calcularTotales(p.items, p.descuento);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">Presupuesto {p.numero} · cerrado</p>
        <h1 className="text-2xl font-semibold leading-tight">{p.descripcion}</h1>
        <p className="text-muted">Para {p.cliente.nombre}</p>
      </header>

      <section aria-labelledby="detalle" className="tarjeta flex flex-col gap-4">
        <h2 id="detalle" className="sr-only">
          Detalle
        </h2>
        <ul className="flex flex-col gap-3">
          {p.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4">
              <div>
                <p>{item.descripcion}</p>
                <p className="text-sm text-muted">
                  {cant(item.cantidad)} × {clp(item.precioUnitario)}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{clp(totalLinea(item.cantidad, item.precioUnitario))}</p>
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
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd>{clp(total)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="condiciones" className="flex flex-col gap-1 text-sm">
        <h2 id="condiciones" className="font-medium">
          Condiciones
        </h2>
        <p>Garantía: {p.garantia}</p>
        <p>Validez: {p.validezDias} días</p>
        {p.observaciones && <p>Observaciones: {p.observaciones}</p>}
      </section>

      <div className="flex flex-col gap-3">
        <a href="/presupuesto/pdf" download className="boton">
          Descargar PDF
        </a>
        <EnviarCorreo destino={enmascararCorreo(p.cliente.correo)} />
        <Salir />
      </div>
    </main>
  );
}
