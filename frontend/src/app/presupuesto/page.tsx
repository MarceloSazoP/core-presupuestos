import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { clp, cant } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";
import { cargarPresupuesto, esFinalizado } from "@/lib/presupuesto";
import { totalLinea } from "@/lib/totales";
import { enlaceWhatsApp, mensajePresupuesto } from "@/lib/whatsapp";
import { Editor } from "./editor";
import { Encabezado } from "./encabezado";
import { EnlaceWhatsApp } from "./enlace-whatsapp";
import { ContactoCliente } from "./contacto-cliente";
import { EnviarCorreo } from "./enviar-correo";
import { DeLaVisita, Medidas } from "./de-la-visita";
import { Multimedia } from "./multimedia";

export const metadata: Metadata = { title: "Presupuesto · CORE Presupuestos" };

const LOGO = "/presupuesto/logo";

// Cambia cuando cambian los datos: con ella como `key`, el editor se vuelve a armar cuando llegan cambios hechos en otro lugar.
const huella = (o: unknown) => {
  let h = 5381;
  for (const c of JSON.stringify(o)) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return String(h);
};

export default async function PresupuestoPage() {
  const cargado = await cargarPresupuesto();
  if (!cargado) redirect("/");
  const { presupuesto: p } = cargado;
  const logoSrc = p.profesional.tieneLogo ? LOGO : null;

  // Pendiente: se completa o se edita. Cerrado: solo se ve.
  if (!esFinalizado(p)) {
    const datosEditor = {
      descripcion: p.descripcion,
      version: p.version,
      numeroAnterior: p.numeroAnterior,
      direccion: p.direccion,
      items: p.items,
      descuento: p.descuento,
      conIva: p.conIva,
      garantia: p.garantia,
      validezDias: p.validezDias,
      observaciones: p.observaciones,
      levantamiento: p.levantamiento,
              cliente: { nombre: p.cliente.nombre, correo: p.cliente.correo, telefono: p.cliente.telefono },
    };

    return (
      <main className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
        <h1 className="sr-only">Completar presupuesto</h1>
        <Editor key={huella(datosEditor)} inicial={datosEditor} />
      </main>
    );
  }

  // Presupuesto cerrado: se muestran los montos que fijó el servidor, no un cálculo nuevo.
  const { subtotal, descuento, iva, total } = p;
  const whatsappUrl = enlaceWhatsApp(
    p.cliente.telefono,
    mensajePresupuesto({ nombre: p.cliente.nombre, numero: p.numero, total: clp(total), descripcion: p.descripcion, enlace: p.publicUrl ?? "" }),
  );

  return (
    <main className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <Encabezado profesional={p.profesional} logoSrc={logoSrc} />
      <header className="flex flex-col items-start gap-1">
        <span className="estado estado-cerrado">Cerrado{p.version > 1 ? ` · Versión ${p.version}` : ""}</span>
        {p.numeroAnterior && <p className="text-sm text-muted">Reemplaza al presupuesto {p.numeroAnterior}</p>}
        {/* El número es la identidad del documento: va como título y el servicio como subtítulo. */}
        <h1 className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{p.numero}</h1>
        <p className="text-lg">{p.descripcion}</p>
        <p className="text-muted">Para {p.cliente.nombre}</p>
      </header>

      {(p.levantamiento.notas || p.levantamiento.medidas.length > 0 || p.levantamiento.fotos.length > 0 || p.levantamiento.audios.length > 0) && (
        <DeLaVisita>
          {p.levantamiento.notas && <p className="whitespace-pre-line">{p.levantamiento.notas}</p>}
          <Medidas medidas={p.levantamiento.medidas} />
          <Multimedia fotos={p.levantamiento.fotos} audios={p.levantamiento.audios} />
        </DeLaVisita>
      )}

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
                <p className="min-w-0">
                  {item.tipo === "tarea" && <span className="mr-2 rounded border border-borde px-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Tarea</span>}
                  {item.descripcion}
                </p>
                {item.tipo === "tarea" ? (
                  <>
                    <p className="solo-ancho" />
                    <p className="solo-ancho" />
                    <p className="solo-ancho" />
                    <p className="text-right font-medium tabular-nums">{item.precioUnitario > 0 ? clp(item.precioUnitario) : "Incluido"}</p>
                  </>
                ) : (
                  <>
                    <p className="solo-estrecho text-sm text-muted">
                      {cant(item.cantidad)} {simboloUnidad(item.unidad)} × {clp(item.precioUnitario)}
                    </p>
                    <p className="solo-ancho text-right tabular-nums">{cant(item.cantidad)}</p>
                    <p className="solo-ancho">{simboloUnidad(item.unidad)}</p>
                    <p className="solo-ancho text-right tabular-nums">{clp(item.precioUnitario)}</p>
                    <p className="text-right font-medium tabular-nums">{clp(totalLinea(item.cantidad, item.precioUnitario))}</p>
                  </>
                )}
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
            {p.conIva && (
              <div className="flex justify-between text-muted">
                <dt>IVA (19%)</dt>
                <dd>{clp(iva)}</dd>
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

          <section aria-labelledby="cliente-cerrado" className="tarjeta flex flex-col gap-2 text-sm">
            <h2 id="cliente-cerrado" className="seccion">
              Contacto del cliente
            </h2>
            <ContactoCliente telefono={p.cliente.telefono} correo={p.cliente.correo} />
          </section>

          <div className="flex flex-col gap-3">
            <a href="/presupuesto/pdf" download className="boton">
              Descargar PDF
            </a>
            <EnlaceWhatsApp href={whatsappUrl} className="boton-secundario" />
            <EnviarCorreo destino={p.cliente.correo} />
          </div>
        </aside>
      </div>
    </main>
  );
}
