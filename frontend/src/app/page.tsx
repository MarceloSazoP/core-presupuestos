import type { Metadata, Viewport } from "next";
import Image, { type StaticImageData } from "next/image";
import appInicio from "./capturas/app-inicio.png";
import appTerminado from "./capturas/app-terminado.png";
import appVisita from "./capturas/app-visita.png";
import clienteTelefono from "./capturas/cliente-telefono.png";
import equipos from "./capturas/equipos.png";
import { ConsultaForm } from "./consulta-form";
import { HojaDemo } from "./hoja-demo";
import { VinculoQr } from "./vinculo-qr";

export const metadata: Metadata = {
  title: "CORE Presupuestos · Del terreno al presupuesto, sin olvidar nada",
  description:
    "Anota lo que ves en la visita (notas, fotos, medidas y voz), prepara el presupuesto y envíalo al cliente en PDF. Para electricistas, gasfíteres, instaladores y técnicos independientes.",
};

export const viewport: Viewport = { themeColor: "#15191e" }; // arriba va la barra oscura del anuncio

// Las fotos son capturas reales del sistema (la app, el editor web y la vista del cliente) con datos de demostración.
const PANTALLAS: { foto: StaticImageData; alt: string; titulo: string; detalle: string }[] = [
  {
    foto: appVisita,
    alt: "La app en la visita: los botones Foto, Voz, Medida y Nota, lo que sale en el PDF (servicio y dirección) y lo que es solo para ti (notas y medidas)",
    titulo: "Lo que viste, sin olvidar nada",
    detalle: "Foto, voz, medida o nota, a un toque. Lo que sale en el PDF va separado de lo que es solo para ti. Funciona sin señal: se envía solo cuando vuelva.",
  },
  {
    foto: appTerminado,
    alt: "La app con un presupuesto enviado: su estado, el total, hasta cuándo vale y el próximo contacto, con los botones Ver PDF y Llamar",
    titulo: "Listo para enviar",
    detalle: "El total, hasta cuándo vale y cuándo volver a llamar, a la vista. El PDF y el envío por WhatsApp o correo, a un toque.",
  },
  {
    foto: appInicio,
    alt: "Inicio de la app: lo que espera respuesta, lo que falta terminar, lo aceptado del mes, el gráfico de los últimos seis meses y los clientes por contactar",
    titulo: "Tu trabajo de un vistazo",
    detalle: "Cuánto espera respuesta, qué te falta terminar, cuánto te aceptaron este mes y a qué clientes te toca llamar.",
  },
];

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
  {
    titulo: "Haz seguimiento",
    detalle: "Anota cuándo volver a llamar y ese día te llega un aviso. Marca si el cliente aceptó o rechazó; si lo rechazó, rehazlo como una versión nueva.",
    muestra: ["Próximo contacto · en 3 días", "Aceptado", "Versión 2"],
  },
];

// Íconos rellenos de Material Icons (Apache 2.0), en tinta sobre su cuadro gris niebla.
const ICONOS = {
  camara: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
  sinSenal: "M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z",
  regla: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z",
  documento: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  clientes: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
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
    titulo: "Funciona sin señal",
    detalle: "En un subterráneo o en el campo sigues anotando. Lo que captures queda en el teléfono y se envía solo cuando vuelva la señal.",
    icono: ICONOS.sinSenal,
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
    titulo: "Tus clientes, a mano",
    detalle: "Se guardan solos al crear un presupuesto, o tráelos desde los contactos del teléfono. Cada uno con sus presupuestos.",
    icono: ICONOS.clientes,
  },
  {
    titulo: "Que no se enfríe un presupuesto",
    detalle: "Anota cuándo volver a llamar y ese día te llega un aviso. Marca si el cliente aceptó o rechazó.",
    icono: ICONOS.agenda,
  },
];

const PREGUNTAS = [
  {
    pregunta: "¿Es una boleta o una factura?",
    respuesta: "No. Es un presupuesto comercial: sirve para cotizar un trabajo y que el cliente lo acepte. No reemplaza boletas ni facturas y no se informa al SII.",
  },
  {
    pregunta: "¿Funciona sin señal?",
    respuesta: "Sí. En terreno puedes crear el presupuesto y anotar notas, fotos, medidas y voz sin conexión; todo se envía solo cuando vuelve la señal. Para terminarlo y enviárselo al cliente sí necesitas internet.",
  },
  {
    pregunta: "¿Mi cliente tiene que instalar algo?",
    respuesta: "No. Le llega un enlace por WhatsApp o por correo y lo abre en su teléfono o en su computador. Puede ver el presupuesto y descargar el PDF, pero no modificarlo.",
  },
  {
    pregunta: "¿Puedo terminarlo en el computador?",
    respuesta: "Sí. Desde la app obtienes el código del presupuesto, o escaneas el QR de esta página, y lo abres en la web para completarlo con pantalla grande.",
  },
  {
    pregunta: "¿Cuándo puedo descargar la app?",
    respuesta: "Llega pronto a Android y, después, a iPhone. Mientras tanto, tus clientes ya pueden consultar aquí los presupuestos que les envíes.",
  },
];

// Marco de teléfono para una captura de la app (bisel negro y esquinas de pantalla).
function Telefono({ foto, alt }: { foto: StaticImageData; alt: string }) {
  return (
    <div className="rounded-[2.75rem] bg-black p-2.5 ring-1 ring-borde">
      <Image src={foto} alt={alt} placeholder="blur" sizes="(min-width: 1024px) 17rem, (min-width: 640px) 40vw, 80vw" className="h-auto w-full rounded-[2.25rem]" />
    </div>
  );
}

const TITULO_SECCION = "text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-tight tracking-[-0.025em]";

export default function Landing() {
  return (
    <main className="marca overflow-x-clip">
      {/* Barra del anuncio (oscura, como la de Brex): lo que viene y un atajo a cómo funciona. */}
      <p className="bg-[#15191e] px-4 py-2 text-center text-sm font-medium text-white">
        Próximamente en Android y iPhone ·{" "}
        <a href="#que-hace" className="text-ember underline-offset-4 hover:underline">
          Mira cómo funciona
        </a>
      </p>

      <div>
        <nav aria-label="Principal" className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-12">
          <p className="flex items-center gap-2.5 whitespace-nowrap text-lg font-bold tracking-tight">
            <span className="icono-marca size-8">
              <Icono d={ICONOS.boleta} className="size-[1.125rem]" />
            </span>
            CORE Presupuestos
          </p>
          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#que-hace" className="hidden hover:text-acento-texto md:inline">Qué hace</a>
            <a href="#como-funciona" className="hidden hover:text-acento-texto md:inline">Cómo funciona</a>
            <a href="#preguntas" className="hidden hover:text-acento-texto md:inline">Preguntas</a>
            <a href="#consulta" className="boton min-h-10 px-4 text-sm">
              <span className="sm:hidden">Consultar</span>
              <span className="hidden sm:inline">Consultar presupuesto</span>
            </a>
          </div>
        </nav>

        <section className="relative grid gap-12 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-16 lg:px-12 lg:pb-28 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_58%] xl:gap-x-[4%]">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-3xl text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance] lg:text-[clamp(2.5rem,4.4vw,4.5rem)] lg:max-w-[min(100%,32rem)] xl:text-[clamp(2.5rem,3.6vw,4.5rem)] xl:max-w-[34rem] 2xl:max-w-[44rem]">
              Del terreno al presupuesto, sin olvidar nada.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted lg:max-w-[min(100%,30rem)] xl:max-w-[32rem] 2xl:max-w-[38rem] 2xl:text-xl">
              Anota lo que ves en la visita (notas, fotos, medidas y voz) y entrega un presupuesto profesional en minutos.
              Hecho para electricistas, gasfíteres, instaladores y técnicos independientes.
            </p>
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

      {/* Qué es y qué hace, con la app tal como se ve. */}
      <section id="que-hace" className="scroll-mt-6 px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-sm font-semibold text-acento-texto">La app, en terreno</p>
          <h2 className={TITULO_SECCION}>Todo lo de la visita, en tu teléfono.</h2>
          <p className="text-lg leading-relaxed text-muted">
            CORE Presupuestos es una app para quienes trabajan en terreno. Anotas lo que ves mientras estás con el cliente, armas el presupuesto
            con sus ítems y precios, se lo envías en PDF y te recuerda cuándo volver a llamarlo. Sin libretas, sin fotos perdidas en la galería y
            sin planillas.
          </p>
        </div>
        <ul className="mt-12 grid gap-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {PANTALLAS.map((p) => (
            <li key={p.titulo} className="flex flex-col gap-6">
              <div className="mx-auto w-full max-w-[17rem]">
                <Telefono foto={p.foto} alt={p.alt} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{p.titulo}</h3>
                <p className="text-muted">{p.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="como-funciona" className="scroll-mt-6 bg-niebla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <h2 className={`max-w-2xl ${TITULO_SECCION}`}>Cuatro pasos. Ninguna libreta perdida.</h2>
        <ol className="mt-10 flex flex-col gap-10">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="grid gap-4 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,24rem)] md:items-start md:gap-8">
              <p aria-hidden="true" className="text-5xl font-semibold leading-none tabular-nums tracking-[-0.03em]">
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

      {/* El resto del sistema: la web para terminarlo y lo que ve el cliente. */}
      <section className="px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <h2 className={`max-w-2xl ${TITULO_SECCION}`}>En el computador y en el teléfono de tu cliente.</h2>
        {/* La foto de los equipos mide 1036 px: a 35 rem (560 px) sigue nítida incluso en pantallas de doble densidad. */}
        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,35rem)_17rem] lg:items-start lg:gap-20">
          <figure className="flex flex-col gap-5">
            <Image
              src={equipos}
              alt="La app en un teléfono, con el resumen de Inicio, y el mismo presupuesto abierto en la web en un notebook, con el total y Terminar y enviar"
              placeholder="blur"
              quality={90}
              sizes="(min-width: 1024px) 35rem, 100vw"
              className="h-auto w-full rounded-xl"
            />
            <figcaption className="flex max-w-2xl flex-col gap-1.5">
              <span className="text-lg font-semibold text-foreground">En terreno y en tu escritorio</span>
              <span className="text-muted">
                El mismo presupuesto, al día en el teléfono y en el computador. Ábrelo en la web con su código, o escaneando el QR desde la app, y termínalo con pantalla grande: ítems, descuento, IVA y condiciones.
              </span>
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-5">
            <div className="mx-auto w-full max-w-[17rem]">
              <Telefono foto={clienteTelefono} alt="Lo que recibe el cliente en su teléfono: quién lo envía, el número del presupuesto, el detalle, el total y Descargar PDF" />
            </div>
            <figcaption className="flex flex-col gap-1.5">
              <span className="text-lg font-semibold text-foreground">Así lo recibe tu cliente</span>
              <span className="text-muted">Un enlace que abre en su teléfono, sin instalar nada: el detalle, el total y el PDF. Solo puede verlo, no editarlo.</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="bg-niebla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <h2 className={TITULO_SECCION}>Hecho para el oficio.</h2>
          <ul className="grid gap-10 sm:grid-cols-2">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo} className="flex gap-4">
                <span className="icono-suave bg-white">
                  <Icono d={b.icono} />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[1.0625rem] font-semibold">{b.titulo}</h3>
                  <p className="text-muted">{b.detalle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="preguntas" className="scroll-mt-6 px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <h2 className={TITULO_SECCION}>Preguntas frecuentes.</h2>
          {/* <details> nativo: se abre con teclado y lector de pantalla sin código extra. */}
          <div className="flex max-w-3xl flex-col divide-y divide-borde border-y border-borde">
            {PREGUNTAS.map((p) => (
              <details key={p.pregunta} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[1.0625rem] font-semibold [&::-webkit-details-marker]:hidden">
                  {p.pregunta}
                  <span aria-hidden="true" className="text-2xl font-normal leading-none text-muted transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-2xl text-muted">{p.respuesta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-12 lg:pb-20">
        <div className="flotante grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">¿Tu profesional te envió un código?</h2>
            <p className="text-muted">Ingrésalo para ver tu presupuesto, descargar el PDF o recibirlo por correo.</p>
          </div>
          <a href="#consulta" className="boton">
            Consultar mi presupuesto
          </a>
        </div>
      </section>

      <footer className="bg-[#000710] px-4 py-12 text-sm text-[#b9bbc6] sm:px-6 lg:px-12">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="flex max-w-sm flex-col gap-2">
            <p className="font-semibold text-white">CORE Presupuestos</p>
            <p>Presupuestos para profesionales independientes. Presupuesto comercial: no es un documento tributario.</p>
          </div>
          <nav aria-label="Pie de página" className="flex flex-col gap-2 sm:items-end">
            <a href="#que-hace" className="hover:text-white">Qué hace</a>
            <a href="#como-funciona" className="hover:text-white">Cómo funciona</a>
            <a href="#preguntas" className="hover:text-white">Preguntas frecuentes</a>
            <a href="#consulta" className="hover:text-white">Consultar un presupuesto</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
