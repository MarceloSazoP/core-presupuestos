import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { cant, clp } from "@/lib/formato";
import { simboloUnidad } from "@/lib/opciones";

export const metadata: Metadata = { title: "Presupuesto · CORE Presupuestos", robots: { index: false, follow: false } };

// Vista pública del cliente (Contrato API §10): solo lectura, sin cuenta. Se abre sobre todo en el teléfono, desde el
// enlace que llega por WhatsApp o correo.
type Publico = {
  number: string;
  version?: number;
  previous_number?: string | null;
  finalized_at: string;
  valid_until: string;
  professional: { name: string; phone: string; email: string; has_logo: boolean };
  customer: { name: string };
  service_description: string;
  service_address: string | null;
  items: { kind?: "ITEM" | "TASK"; description: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  include_vat: boolean;
  vat: number;
  vat_rate: number;
  total: number;
  warranty: { text: string };
  validity_days: number;
  observations: string | null;
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago", dateStyle: "long" });
const dia = (ymd: string) => fecha(`${ymd}T12:00:00Z`);

export default async function VistaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let q: Publico;
  try {
    q = await api<Publico>(`/public/quotes/${encodeURIComponent(token)}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 429)) notFound();
    throw e;
  }
  const base = `/q/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <article className="flex flex-col gap-6 rounded-xl border border-borde bg-card p-5 shadow-sm sm:p-8">
        <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            {/* El logo va en su propia fila, encima del nombre: un logo horizontal se ve entero y sin deformarse. */}
            {q.professional.has_logo && (
              // eslint-disable-next-line @next/next/no-img-element -- imagen del profesional servida por el BFF; su proporción es la del logo
              <img src={`${base}/logo`} alt={`Logo de ${q.professional.name}`} className="h-16 w-auto max-w-full self-start object-contain object-left" />
            )}
            <div className="flex min-w-0 flex-col">
              <p className="text-xl font-semibold leading-tight">{q.professional.name}</p>
              <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                <a href={`tel:${q.professional.phone}`} className="underline-offset-4 hover:underline">
                  {q.professional.phone}
                </a>
                <a href={`mailto:${q.professional.email}`} className="break-all underline-offset-4 hover:underline">
                  {q.professional.email}
                </a>
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <h1 className="text-lg font-bold uppercase tracking-wide">
              Presupuesto {q.number}
              {(q.version ?? 1) > 1 && <span> · Versión {q.version}</span>}
            </h1>
            {q.previous_number && <p className="text-sm text-muted">Reemplaza al presupuesto {q.previous_number}</p>}
            <p className="text-sm text-muted">{fecha(q.finalized_at)}</p>
          </div>
        </header>

        <section className="flex flex-col gap-1" aria-label="Cliente y servicio">
          <p>
            <span className="text-muted">Para: </span>
            <span className="font-semibold">{q.customer.name}</span>
          </p>
          {q.service_address && (
            <p>
              <span className="text-muted">Dirección: </span>
              <span className="[overflow-wrap:anywhere]">{q.service_address}</span>
            </p>
          )}
          <p className="mt-2 text-lg font-medium leading-snug [overflow-wrap:anywhere]">{q.service_description}</p>
        </section>

        <section aria-labelledby="detalle">
          <h2 id="detalle" className="etiqueta mb-2 uppercase tracking-wide text-muted">
            Detalle
          </h2>
          <ul className="divide-y divide-borde border-y border-borde">
            {q.items.map((i, n) => (
              <li key={n} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere]">
                    {i.kind === "TASK" && <span className="mr-2 rounded border border-borde px-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Tarea</span>}
                    {i.description}
                  </p>
                  {i.kind !== "TASK" && (
                    <p className="text-sm text-muted tabular-nums">
                      {cant(i.quantity)} {simboloUnidad(i.unit)} × {clp(i.unit_price)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-medium tabular-nums">{i.kind === "TASK" && i.line_total === 0 ? "Incluido" : clp(i.line_total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 flex flex-col gap-1 tabular-nums sm:ml-auto sm:w-72">
            <div className="flex justify-between text-muted">
              <dt>Subtotal</dt>
              <dd>{clp(q.subtotal)}</dd>
            </div>
            {q.discount > 0 && (
              <div className="flex justify-between text-muted">
                <dt>Descuento</dt>
                <dd>-{clp(q.discount)}</dd>
              </div>
            )}
            {q.include_vat && (
              <div className="flex justify-between text-muted">
                <dt>IVA ({q.vat_rate}%)</dt>
                <dd>{clp(q.vat)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t-2 border-foreground pt-2">
              <dt className="font-bold uppercase">Total</dt>
              <dd className="text-3xl font-bold">{clp(q.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-1 text-sm" aria-label="Condiciones">
          <p>
            <span className="text-muted">Garantía: </span>
            {q.warranty.text}
          </p>
          <p>
            <span className="text-muted">Validez: </span>
            {q.validity_days} días (hasta el {dia(q.valid_until)})
          </p>
          {q.observations && <p className="mt-2 border-t border-borde pt-2 [overflow-wrap:anywhere]">{q.observations}</p>}
        </section>
      </article>

      <a href={`${base}/pdf`} download className="boton">
        Descargar PDF
      </a>
      <p className="text-center text-sm text-muted">Presupuesto comercial. No es un documento tributario.</p>
    </main>
  );
}
