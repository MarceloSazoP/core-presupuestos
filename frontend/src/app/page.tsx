import type { Metadata, Viewport } from "next";
import { ConsultaForm } from "./consulta-form";
import { HojaDemo } from "./hoja-demo";
import { VinculoQr } from "./vinculo-qr";

export const metadata: Metadata = {
  title: "CORE Presupuestos · Del terreno al presupuesto, sin olvidar nada",
  description:
    "Anota lo que ves en la visita (notas, fotos, medidas y voz), prepara el presupuesto y envíalo al cliente en PDF. Para electricistas, gasfíteres, instaladores y técnicos independientes.",
};

export const viewport: Viewport = { themeColor: "#e0dde2" };

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

// Íconos rellenos de Material Icons (Apache 2.0), en magenta sobre su cuadro suave.
const ICONOS = {
  camara: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
  regla: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z",
  documento: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  agenda: "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
  boleta: "M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z",
};

function Icono({ d, className = "size-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

const BENEFICIOS = [
  {
    titulo: "Todo lo de la visita en un solo lugar",
    detalle: "Notas, fotos, medidas y voz quedan unidas al presupuesto. Nada se pierde entre la camioneta y la casa.",
    icono: ICONOS.camara,
  },
  {
    titulo: "Cada precio en su unidad",
    detalle: "m², m³, galón, saco, rollo, hora hombre y más de 40 unidades. El total de cada línea y el general se calculan solos.",
    icono: ICONOS.regla,
  },
  {
    titulo: "Un PDF que se ve profesional",
    detalle: "Tu logo, tus datos, la garantía y la validez en un documento claro. Es un presupuesto comercial, no un documento tributario.",
    icono: ICONOS.documento,
  },
  {
    titulo: "Que no se enfríe un presupuesto",
    detalle: "Anota cuándo volver a llamar y marca si el cliente aceptó o rechazó.",
    icono: ICONOS.agenda,
    pronto: true,
  },
];

export default function Landing() {
  return (
    <main className="marca">
      <div>
        <nav className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-12">
          <p className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <span className="icono-marca size-8">
              <Icono d={ICONOS.boleta} className="size-[1.125rem]" />
            </span>
            CORE Presupuestos
          </p>
        </nav>

        <section className="relative grid gap-12 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-16 lg:px-12 lg:pb-28 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_58%] xl:gap-x-[4%]">
          <div className="flex flex-col gap-6">
            <h1 className="titular max-w-3xl pb-[0.08em] text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.04] tracking-[-0.025em] [text-wrap:balance] lg:text-[clamp(2.5rem,4.4vw,4.5rem)] lg:max-w-[min(100%,32rem)] xl:text-[clamp(2.5rem,3.6vw,4.5rem)] xl:max-w-[34rem] 2xl:max-w-[44rem]">
              Del terreno al presupuesto, sin olvidar nada.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-foreground lg:max-w-[min(100%,30rem)] xl:max-w-[32rem] 2xl:max-w-[38rem] 2xl:text-xl">
              Anota lo que ves en la visita (notas, fotos, medidas y voz) y entrega un presupuesto profesional en minutos.
              Hecho para electricistas, gasfíteres, instaladores y técnicos independientes.
            </p>
            <p className="pastilla">Próximamente en Android y iPhone</p>
          </div>

          {/* Con pantalla ancha, la ficha flotante va a la izquierda de la hoja y la cubre solo en su margen (1,25 rem): nunca tapa texto de la hoja. */}
          <div className="flex flex-col gap-10 lg:pb-3.5 xl:flex-row xl:items-start xl:gap-[3%]">
            <section
              id="consulta"
              aria-labelledby="consultar"
              className="flotante scroll-mt-6 p-5 lg:mx-auto lg:w-full lg:max-w-md xl:mx-0 xl:mt-[3%] xl:w-[46%] xl:min-w-[19rem] xl:max-w-[28rem] xl:shrink-0 2xl:p-6"
            >
              <ConsultaForm />
              <p aria-hidden="true" className="my-4 flex items-center gap-3 text-sm font-medium text-muted">
                <span className="h-px flex-1 bg-borde" />o<span className="h-px flex-1 bg-borde" />
              </p>
              <VinculoQr />
            </section>
            <div className="xl:min-w-0 xl:flex-1 [container-type:inline-size]">
              <HojaDemo />
            </div>
          </div>
        </section>
      </div>

      {/* Las secciones se separan por espacio, no por franjas de color ni líneas. */}
      <section id="como-funciona" className="px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <h2 className="max-w-2xl text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-tight tracking-[-0.02em]">
          Tres pasos. Ninguna libreta perdida.
        </h2>
        <ol className="mt-10 flex flex-col gap-10">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="grid gap-4 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,24rem)] md:items-start md:gap-8">
              <p aria-hidden="true" className="text-5xl font-extrabold leading-none tabular-nums text-magenta">
                {i + 1}
              </p>
              <div className="flex max-w-xl flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight">{paso.titulo}</h3>
                <p className="text-muted">{paso.detalle}</p>
              </div>
              <ul className="flotante flex flex-col gap-1.5 p-5 text-sm">
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

      <section className="px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-tight tracking-[-0.02em]">Hecho para el oficio.</h2>
          <ul className="flex max-w-3xl flex-col gap-10">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo} className="flex gap-4">
                <span className="icono-suave">
                  <Icono d={b.icono} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="flex flex-wrap items-center gap-3 text-[1.0625rem] font-semibold">
                    {b.titulo}
                    {b.pronto && <span className="estado estado-marca">Próximamente</span>}
                  </h3>
                  <p className="text-muted">{b.detalle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-12 lg:pb-20">
        <div className="flotante grid gap-6 rounded-[34px] p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-[-0.01em] sm:text-3xl">¿Tu profesional te envió un código?</h2>
            <p className="text-muted">Ingrésalo para ver tu presupuesto, descargar el PDF o recibirlo por correo.</p>
          </div>
          <a href="#consulta" className="boton">
            Consultar mi presupuesto
          </a>
        </div>
      </section>

      <footer className="px-4 py-8 text-sm text-muted sm:px-6 lg:px-12">
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <p className="font-semibold text-foreground">CORE Presupuestos</p>
          <p>Presupuesto comercial: no es un documento tributario.</p>
        </div>
      </footer>
    </main>
  );
}
