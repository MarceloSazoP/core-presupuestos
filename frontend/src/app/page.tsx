import type { Metadata, Viewport } from "next";
import { ConsultaForm } from "./consulta-form";
import { HojaDemo } from "./hoja-demo";
import { VinculoQr } from "./vinculo-qr";

export const metadata: Metadata = {
  title: "CORE Presupuestos · Del terreno al presupuesto, sin olvidar nada",
  description:
    "Anota lo que ves en la visita (notas, fotos, medidas y voz), prepara el presupuesto y envíalo al cliente en PDF. Para electricistas, gasfíteres, instaladores y técnicos independientes.",
};

export const viewport: Viewport = { themeColor: "#fbd530" };

const PASOS = [
  {
    titulo: "Captura en la visita",
    detalle: "Escribe, graba la voz, saca fotos y anota medidas. Pensado para terreno: también sin señal.",
    muestra: ["Nota de voz · 0:42", "3 fotos", "Largo del pasillo · 6,5 m"],
  },
  {
    titulo: "Prepáralo donde te acomode",
    detalle: "Termínalo ahí mismo en el celular o, ya en casa, abre el presupuesto con su código en el computador: ítems con cantidad, unidad (m², gl, hh…) y precio. El total se calcula solo.",
    muestra: ["Cable 2,5 mm² · 30 m · $26.700", "Revisión de tablero · 1 gl · $35.000", "Total · $111.700"],
  },
  {
    titulo: "Envía al cliente",
    detalle: "El PDF sale por correo, con tu logo y tus datos, y el aviso por WhatsApp va en el mismo paso.",
    muestra: ["PDF adjunto", "Correo", "WhatsApp"],
  },
];

const BENEFICIOS = [
  {
    titulo: "Todo lo de la visita en un solo lugar",
    detalle: "Notas, fotos, medidas y voz quedan unidas al presupuesto. Nada se pierde entre la camioneta y la casa.",
  },
  {
    titulo: "Cada precio en su unidad",
    detalle: "m², m³, galón, saco, rollo, hora hombre y más de 40 unidades. El total de cada línea y el general se calculan solos.",
  },
  {
    titulo: "Un PDF que se ve profesional",
    detalle: "Tu logo, tus datos, la garantía y la validez en un documento claro. Es un presupuesto comercial, no un documento tributario.",
  },
  {
    titulo: "Que no se enfríe un presupuesto",
    detalle: "Anota cuándo volver a llamar y marca si el cliente aceptó o rechazó.",
    pronto: true,
  },
];

export default function Landing() {
  return (
    <main className="marca">
      <div className="bg-amarillo text-tinta">
        <nav className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-12">
          <p className="text-lg font-extrabold tracking-tight">CORE Presupuestos</p>
        </nav>

        <section className="relative grid gap-12 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-16 lg:px-12 lg:pb-28 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_48rem] 2xl:grid-cols-[minmax(0,1fr)_60rem] 2xl:gap-24">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-3xl text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.04] tracking-[-0.025em] [text-wrap:balance] lg:text-[clamp(2.5rem,4.4vw,4.5rem)] lg:max-w-[min(100%,32rem)] xl:text-[clamp(2.5rem,3.6vw,4.5rem)] xl:max-w-[34rem] 2xl:max-w-[44rem]">
              Del terreno al presupuesto, sin olvidar nada.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-tinta/85 lg:max-w-[min(100%,30rem)] xl:max-w-[32rem] 2xl:max-w-[38rem] 2xl:text-xl">
              Anota lo que ves en la visita (notas, fotos, medidas y voz) y entrega un presupuesto profesional en minutos.
              Hecho para electricistas, gasfíteres, instaladores y técnicos independientes.
            </p>
            <p className="w-fit rounded-full border border-tinta/25 bg-white/40 px-3.5 py-1 text-sm font-semibold">Próximamente en Android y iPhone</p>
          </div>

          {/* Con pantalla ancha, la ficha flotante va a la izquierda de la hoja y la cubre solo en su margen (1,25 rem): nunca tapa texto de la hoja. */}
          <div className="flex flex-col gap-10 lg:pb-3.5 xl:flex-row xl:items-start xl:gap-0">
            <section
              id="consulta"
              aria-labelledby="consultar"
              className="ficha scroll-mt-6 p-5 lg:mx-auto lg:w-full lg:max-w-md xl:relative xl:z-10 xl:mx-0 xl:mt-12 xl:-mr-5 xl:w-[22rem] xl:max-w-none xl:shrink-0 2xl:w-[26rem] 2xl:p-6"
            >
              <ConsultaForm />
              <p aria-hidden="true" className="my-4 flex items-center gap-3 text-sm font-medium text-muted">
                <span className="h-px flex-1 bg-borde" />o<span className="h-px flex-1 bg-borde" />
              </p>
              <VinculoQr />
            </section>
            <div className="xl:min-w-0 xl:flex-1">
              <HojaDemo />
            </div>
          </div>
        </section>
      </div>

      <section id="como-funciona" className="bg-tinta px-4 py-16 text-white sm:px-6 lg:px-12 lg:py-24">
        <h2 className="max-w-2xl text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-tight tracking-[-0.02em]">
          Tres pasos. Ninguna libreta perdida.
        </h2>
        <ol className="mt-10 divide-y divide-white/15 border-y border-white/15">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="grid gap-4 py-8 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,24rem)] md:items-start md:gap-8">
              <p aria-hidden="true" className="text-5xl font-extrabold leading-none tabular-nums text-amarillo">
                {i + 1}
              </p>
              <div className="flex max-w-xl flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight">{paso.titulo}</h3>
                <p className="text-white/80">{paso.detalle}</p>
              </div>
              <ul className="flex flex-col gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] p-5 text-sm text-white/90">
                {paso.muestra.map((m) => (
                  <li key={m} className="tabular-nums">
                    {m}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-tight tracking-[-0.02em]">Hecho para el oficio.</h2>
          <ul className="flex max-w-3xl flex-col divide-y divide-borde border-y border-borde">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo} className="flex flex-col gap-1.5 py-6">
                <h3 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
                  {b.titulo}
                  {b.pronto && <span className="estado estado-pendiente">Próximamente</span>}
                </h3>
                <p className="text-muted">{b.detalle}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-12 lg:pb-24">
        <div className="grid gap-6 rounded-2xl border-2 border-tinta bg-amarillo/25 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-[-0.01em] sm:text-3xl">¿Tu profesional te envió un código?</h2>
            <p className="text-muted">Ingrésalo para ver tu presupuesto, descargar el PDF o recibirlo por correo.</p>
          </div>
          <a href="#consulta" className="boton-tinta">
            Consultar mi presupuesto
          </a>
        </div>
      </section>

      <footer className="bg-tinta px-4 py-8 text-sm text-white/80 sm:px-6 lg:px-12">
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <p className="font-semibold text-white">CORE Presupuestos</p>
          <p>Presupuesto comercial: no es un documento tributario.</p>
        </div>
      </footer>
    </main>
  );
}
