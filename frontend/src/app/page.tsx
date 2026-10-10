import type { Metadata, Viewport } from "next";
import Image, { type StaticImageData } from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { PAISES_ORDENADOS } from "@/lib/paises";
import appInicio from "./capturas/app-inicio.png";
import appTerminado from "./capturas/app-terminado.png";
import appVisita from "./capturas/app-visita.png";
import clienteTelefono from "./capturas/cliente-telefono.png";
import equipos from "./capturas/equipos.png";
import { ConsultaForm } from "./consulta-form";
import { HojaDemo } from "./hoja-demo";
import { PaisesElegibles } from "./paises-elegibles";
import { Revelar } from "./revelar";
import { VinculoQr } from "./vinculo-qr";

export const metadata: Metadata = {
  title: "CORE Presupuestos · Del terreno al presupuesto, sin olvidar nada",
  description:
    "Anota lo que ves en la visita (notas, fotos, medidas y voz), prepara el presupuesto y envíalo al cliente en PDF. Para electricistas, gasfíteres, plomeros, instaladores y técnicos independientes de los países de habla hispana.",
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
    detalle: "El total, hasta cuándo vale y cuándo volver a llamar, a la vista. Se lo envías por correo o WhatsApp con un toque.",
  },
  {
    foto: appInicio,
    alt: "Inicio de la app: lo que espera respuesta, lo que falta terminar, lo aceptado del mes, el gráfico de los últimos seis meses y los clientes por contactar",
    titulo: "Tu trabajo de un vistazo",
    detalle: "Cuánto espera respuesta, qué te falta terminar, cuánto te aceptaron este mes y a qué clientes te toca llamar.",
  },
];

// Los cuatro pasos, cada uno con una tarjeta que imita lo que se ve en la app en ese momento (filas con ícono y valor, el total, el
// botón que recibe el cliente o el sello de aceptado).
type Muestra = { icono?: keyof typeof ICONOS; texto: string; valor?: string; tipo?: "total" | "boton" | "ok" | "sello" };
const PASOS: { titulo: string; detalle: string; muestra: Muestra[] }[] = [
  {
    titulo: "Captura en la visita",
    detalle: "Fotos, voz, medidas y notas, a un toque. Pensado para terreno: también sin señal.",
    muestra: [
      { icono: "microfono", texto: "Nota de voz", valor: "0:42" },
      { icono: "camara", texto: "Fotos", valor: "3" },
      { icono: "regla", texto: "Largo del pasillo", valor: "6,5 m" },
    ],
  },
  {
    titulo: "Prepáralo donde te acomode",
    detalle: "En el celular o, ya en casa, en el computador con su código. El total se calcula solo.",
    muestra: [
      { texto: "Cable 2,5 mm² · 30 m", valor: "$26.700" },
      { texto: "Revisión de tablero", valor: "$35.000" },
      { texto: "Total", valor: "$111.700", tipo: "total" },
    ],
  },
  {
    titulo: "Envía al cliente",
    detalle: "Le llega por correo o WhatsApp con tus datos y un botón para aceptarlo.",
    muestra: [
      { icono: "correo", texto: "Correo enviado a Juan", tipo: "ok" },
      { texto: "Aceptar el presupuesto", tipo: "boton" },
    ],
  },
  {
    titulo: "Haz seguimiento",
    detalle: "Ese día te llega un aviso para llamar. Si lo acepta, lo ves al instante en la app.",
    muestra: [
      { icono: "agenda", texto: "Próximo contacto", valor: "en 3 días" },
      { texto: "Aceptado", tipo: "sello" },
    ],
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
  ver: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  enviar: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  aceptar: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  microfono: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z",
  correo: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  candado: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  enlace: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
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
    respuesta: "No. Es un presupuesto comercial: sirve para cotizar un trabajo y que el cliente lo acepte. No reemplaza boletas ni facturas y no se informa al servicio de impuestos de tu país (SII, SAT, SUNAT, DIAN…).",
  },
  {
    pregunta: "¿Funciona en mi país?",
    respuesta: `Sí, en los ${PAISES_ORDENADOS.length} países de habla hispana. Eliges tu país en la app y tus presupuestos usan su moneda y calculan su impuesto (IVA, IGV, ITBMS, ITBIS, ISV o IVU) con la tasa que corresponde. Si la ley cambia una tasa, la actualizamos; los presupuestos que ya enviaste no cambian.`,
  },
  {
    pregunta: "¿Funciona sin señal?",
    respuesta: "Sí. En terreno puedes crear el presupuesto y anotar notas, fotos, medidas y voz sin conexión; todo se envía solo cuando vuelve la señal. Para terminarlo y enviárselo al cliente sí necesitas internet.",
  },
  {
    pregunta: "¿Mi cliente tiene que instalar algo?",
    respuesta: "No. Le llega un enlace por WhatsApp o por correo y lo abre en su teléfono o en su computador. Ahí revisa el presupuesto y lo acepta con un toque; al aceptarlo, recibe el PDF por correo. No puede modificarlo.",
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

// El lugar en una cascada (.entrar y .revelar, globals.css): cada uno llega un poco después del anterior.
const turno = (i: number) => ({ "--i": i }) as CSSProperties;

// Una pantalla en miniatura de un paso: filas con ícono y valor, el total, el botón que ve el cliente o el sello de aceptado.
function MiniPantalla({ filas }: { filas: Muestra[] }) {
  return (
    <ul className="flotante mt-auto flex flex-col gap-2.5 p-4 text-sm">
      {filas.map((f) => (
        <li key={f.texto} className={f.tipo === "total" ? "flex items-center justify-between gap-3 border-t border-borde pt-2.5 font-semibold" : "flex items-center justify-between gap-3"}>
          {f.tipo === "boton" ? (
            <span className="rounded-lg bg-[var(--acento)] px-3 py-1.5 font-semibold text-white">{f.texto}</span>
          ) : f.tipo === "sello" ? (
            <span className="rounded-md border-2 border-[var(--ok)] px-2.5 py-0.5 text-xs font-bold tracking-[0.14em] text-[var(--ok)]">{f.texto.toUpperCase()}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              {f.icono ? <Icono d={ICONOS[f.icono]} className="size-4 shrink-0 text-muted" /> : null}
              <span className="truncate">{f.texto}</span>
              {f.tipo === "ok" ? <Icono d={ICONOS.aceptar} className="size-4 shrink-0 text-[var(--ok)]" /> : null}
            </span>
          )}
          {f.valor ? <span className="shrink-0 tabular-nums text-muted">{f.valor}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type Punto = { icono: string; titulo: string; detalle: string };

// Una fila de «el resto del sistema»: la imagen y, al lado, qué es y qué se puede hacer. El texto ocupa todo el ancho que queda (los
// puntos en tarjetas de a dos) para que la pantalla ancha no quede con un hueco; `invertido` alterna el lado de la imagen.
// `angosto`: la imagen es un teléfono (alto y delgado) y su columna se angosta para que el texto use el resto del ancho.
function Lado({ visual, rotulo, titulo, detalle, puntos, invertido = false, angosto = false }: { visual: ReactNode; rotulo: string; titulo: string; detalle: string; puntos: Punto[]; invertido?: boolean; angosto?: boolean }) {
  const columnas = angosto ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]" : invertido ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,35rem)]" : "lg:grid-cols-[minmax(0,35rem)_minmax(0,1fr)]";
  return (
    <div className={`grid gap-8 lg:items-center lg:gap-16 ${columnas}`}>
      <div className={`revelar ${invertido ? "lg:order-last" : ""}`}>{visual}</div>
      <div className="flex flex-col gap-4">
        <p className="revelar text-sm font-semibold text-acento-texto" style={turno(1)}>{rotulo}</p>
        <h3 className="revelar text-[clamp(1.5rem,2.4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em]" style={turno(1)}>{titulo}</h3>
        <p className="revelar max-w-3xl text-lg leading-relaxed text-muted" style={turno(2)}>{detalle}</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {puntos.map((p, n) => (
            <li key={p.titulo} className="revelar flotante flex gap-4 p-5" style={turno(2 + n)}>
              <span className="icono-suave">
                <Icono d={p.icono} />
              </span>
              <div className="flex flex-col gap-1">
                <h4 className="text-[1.0625rem] font-semibold">{p.titulo}</h4>
                <p className="text-muted">{p.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <main className="marca por-secciones overflow-x-clip">
      <Revelar />
      {/* Cada pantalla, una sección (globals.css, .seccion-pantalla): la primera lleva la barra del anuncio, el menú y la portada. */}
      <div className="seccion-pantalla seccion-inicio">
        {/* Barra del anuncio (oscura, como la de Brex): lo que viene y un atajo a cómo funciona. */}
        <p className="bg-[#15191e] px-4 py-2 text-center text-sm font-medium text-white">
          Próximamente en Android y iPhone ·{" "}
          <a href="#que-hace" className="text-ember underline-offset-4 hover:underline">
            Mira cómo funciona
          </a>
        </p>

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
            <a href="#paises" className="hidden hover:text-acento-texto md:inline">Países</a>
            <a href="#preguntas" className="hidden hover:text-acento-texto md:inline">Preguntas</a>
            <a href="#consulta" className="boton min-h-10 px-4 text-sm">
              <span className="sm:hidden">Consultar</span>
              <span className="hidden sm:inline">Consultar presupuesto</span>
            </a>
          </div>
        </nav>

        <section className="relative grid gap-12 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-16 lg:px-12 lg:pb-12 lg:pt-8 xl:grid-cols-[minmax(0,1fr)_58%] xl:gap-x-[4%]">
          <div className="flex flex-col gap-6">
            <p className="pastilla entrar" style={turno(0)}>Para los países de habla hispana</p>
            <h1 className="max-w-3xl text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance] lg:text-[clamp(2.5rem,4.4vw,4.5rem)] lg:max-w-[min(100%,32rem)] xl:text-[clamp(2.5rem,3.6vw,4.5rem)] xl:max-w-[34rem] 2xl:max-w-[44rem]">
              Del terreno al presupuesto, sin olvidar nada.
            </h1>
            <p className="entrar max-w-xl text-lg leading-relaxed text-muted lg:max-w-[min(100%,30rem)] xl:max-w-[32rem] 2xl:max-w-[38rem] 2xl:text-xl" style={turno(1)}>
              Anota lo que ves en la visita (notas, fotos, medidas y voz) y entrega un presupuesto profesional en minutos.
              Hecho para electricistas, gasfíteres, plomeros, instaladores y técnicos independientes.
            </p>
          </div>

          {/* Con pantalla ancha, la ficha flotante va a la izquierda de la hoja y la cubre solo en su margen (1,25 rem): nunca tapa texto de la hoja. */}
          <div className="flex flex-col gap-10 lg:pb-3.5 xl:flex-row xl:items-start xl:gap-[3%]">
            <section
              id="consulta"
              aria-labelledby="consultar"
              style={turno(2)}
              className="entrar flotante scroll-mt-6 p-5 lg:mx-auto lg:w-full lg:max-w-md xl:mx-0 xl:mt-[3%] xl:w-[46%] xl:min-w-[19rem] xl:max-w-[28rem] xl:shrink-0 2xl:p-6"
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
      <section id="que-hace" className="seccion-pantalla scroll-mt-6 px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        {/* En pantallas anchas, el título y el texto lado a lado: así los teléfonos caben en la misma pantalla. */}
        <div className="revelar flex max-w-3xl flex-col gap-4 lg:grid lg:max-w-none lg:grid-cols-2 lg:items-end lg:gap-x-16">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-acento-texto">La app, en terreno</p>
            <h2 className={TITULO_SECCION}>Todo lo de la visita, en tu teléfono.</h2>
          </div>
          <p className="text-lg leading-relaxed text-muted">
            CORE Presupuestos es una app para quienes trabajan en terreno. Anotas lo que ves mientras estás con el cliente, armas el presupuesto
            con sus ítems y precios, se lo envías para que lo acepte con un toque y te recuerda cuándo volver a llamarlo. Sin libretas, sin fotos perdidas en la galería y
            sin planillas.
          </p>
        </div>
        <ul className="mt-12 grid gap-14 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3 lg:gap-10">
          {PANTALLAS.map((p, n) => (
            <li key={p.titulo} className="revelar flex flex-col gap-6" style={turno(n)}>
              <div className="telefono-pantalla mx-auto w-full max-w-[17rem]">
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

      <section id="como-funciona" className="seccion-pantalla scroll-mt-6 bg-niebla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="revelar flex max-w-3xl flex-col gap-4">
          <p className="text-sm font-semibold text-acento-texto">Cómo funciona</p>
          <h2 className={TITULO_SECCION}>Cuatro pasos. Ninguna libreta perdida.</h2>
        </div>
        {/* Una línea de tiempo: en pantallas anchas, los cuatro pasos en fila, unidos por una línea que se dibuja de izquierda a derecha
            al llegar (.dibujar). Cada paso termina en su pantalla en miniatura, alineadas abajo. */}
        <div className="relative mt-12 lg:mt-14">
          <div aria-hidden="true" className="revelar dibujar absolute left-5 top-[1.1875rem] hidden h-0.5 bg-foreground lg:block" style={{ right: "calc((100% - 6rem) / 4 - 1.25rem)" }} />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="revelar flex flex-col gap-5" style={turno(i + 1)}>
                <span aria-hidden="true" className="relative grid size-10 place-items-center rounded-full bg-foreground font-semibold tabular-nums text-[var(--background)] ring-8 ring-niebla">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">{paso.titulo}</h3>
                  <p className="text-muted">{paso.detalle}</p>
                </div>
                <MiniPantalla filas={paso.muestra} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* El resto del sistema: la web para terminarlo y lo que ve el cliente. */}
      {/* Es alta para una sola pantalla: el computador y el teléfono del cliente van cada uno en la suya. */}
      <section className="seccion-pantalla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <h2 className={`revelar max-w-2xl ${TITULO_SECCION}`}>En el computador y en el teléfono de tu cliente.</h2>
        <div className="mt-12 lg:mt-6">
          <Lado
            visual={
              // La foto de los equipos mide 1036 px: a 35 rem (560 px) sigue nítida incluso en pantallas de doble densidad.
              <Image
                src={equipos}
                alt="La app en un teléfono, con el resumen de Inicio, y el mismo presupuesto abierto en la web en un notebook, con el total y Terminar y enviar"
                placeholder="blur"
                quality={90}
                sizes="(min-width: 1024px) 35rem, 100vw"
                className="h-auto w-full rounded-xl"
              />
            }
            rotulo="En el computador"
            titulo="Empiézalo en terreno, termínalo en tu escritorio."
            detalle="El presupuesto queda al día en el teléfono y en la web. Ábrelo con su código, o escaneando el QR desde la app, y termínalo con calma en pantalla grande."
            puntos={[
              { icono: ICONOS.boleta, titulo: "Ítems y total", detalle: "Cantidad, unidad y precio en cada línea. El total se calcula solo." },
              { icono: ICONOS.documento, titulo: "Descuento e impuesto", detalle: "El IVA (o el impuesto de tu país) con su tasa, junto con la garantía y la vigencia." },
              { icono: ICONOS.ver, titulo: "Vista previa del PDF", detalle: "Míralo tal como le llegará a tu cliente, antes de enviarlo." },
              { icono: ICONOS.enviar, titulo: "Terminar y enviar", detalle: "Por correo, con el botón para que tu cliente lo acepte, o por WhatsApp." },
            ]}
          />
        </div>
      </section>
      <section className="seccion-pantalla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div>
          <Lado
            invertido
            angosto
            visual={
              <div className="flex justify-center">
                <div className="telefono-pantalla w-full max-w-[17rem] [--resto:9rem]">
                  <Telefono foto={clienteTelefono} alt="Lo que recibe el cliente en su teléfono: quién lo envía, el número del presupuesto, el detalle, el total y el botón Aceptar" />
                </div>
              </div>
            }
            rotulo="En el teléfono de tu cliente"
            titulo="Así lo recibe tu cliente."
            detalle="Le llega un enlace por correo o WhatsApp que se abre en su teléfono. Ve un presupuesto claro y profesional, con tus datos."
            puntos={[
              { icono: ICONOS.enlace, titulo: "Sin instalar nada", detalle: "Se abre en el navegador del teléfono, sin crear una cuenta." },
              { icono: ICONOS.clientes, titulo: "Fácil de leer", detalle: "Quién lo envía, el detalle de los trabajos y el total." },
              { icono: ICONOS.aceptar, titulo: "Lo acepta con un toque", detalle: "Y le llega el PDF con el timbre «Aceptado». Tú lo ves al instante en la app." },
              { icono: ICONOS.candado, titulo: "Solo lectura", detalle: "Puede verlo, pero no cambiar nada." },
            ]}
          />
        </div>
      </section>

      <section className="seccion-pantalla bg-niebla px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="revelar flex max-w-3xl flex-col gap-4">
          <h2 className={TITULO_SECCION}>Hecho para el oficio.</h2>
          <p className="text-lg leading-relaxed text-muted">
            Pensado para quien trabaja en terreno: lo justo para no olvidar nada y cobrar bien, sin volverse un sistema complicado.
          </p>
        </div>
        {/* Tarjetas de 3 en 3 en pantallas anchas: llenan la pantalla de la sección en vez de dejar una lista corta flotando. */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3">
          {BENEFICIOS.map((b, n) => (
            <li key={b.titulo} className="revelar flotante flex flex-col gap-4 p-6" style={turno(n % 3)}>
              <span className="icono-suave">
                <Icono d={b.icono} />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[1.0625rem] font-semibold">{b.titulo}</h3>
                <p className="text-muted">{b.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="paises" aria-labelledby="titulo-paises" className="seccion-pantalla scroll-mt-6 px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <PaisesElegibles>
          <div className="revelar flex flex-col gap-4">
            <h2 id="titulo-paises" className={TITULO_SECCION}>
              Para los países de habla hispana.
            </h2>
            <p className="text-lg leading-relaxed text-muted">
              Todo en español, con la moneda de tu país y su impuesto con la tasa que corresponde. Elige uno y mira cómo queda.
            </p>
          </div>
        </PaisesElegibles>
      </section>

      {/* La última pantalla: las preguntas frecuentes junto a la consulta del cliente, y el pie abajo. */}
      <div className="seccion-pantalla seccion-final">
        <section id="preguntas" className="scroll-mt-6 bg-niebla px-4 py-16 sm:px-6 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 lg:py-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-20">
            <div className="flex flex-col gap-8">
              <h2 className={`revelar ${TITULO_SECCION}`}>Preguntas frecuentes.</h2>
              <div className="revelar flotante flex flex-col items-start gap-3 p-6" style={turno(1)}>
                <h3 className="text-xl font-semibold tracking-[-0.02em]">¿Tu profesional te envió un código?</h3>
                <p className="text-muted">Ingrésalo para ver tu presupuesto y aceptarlo.</p>
                <a href="#consulta" className="boton">
                  Consultar mi presupuesto
                </a>
              </div>
            </div>
            {/* <details> nativo: se abre con teclado y lector de pantalla sin código extra. */}
            <div className="revelar flex max-w-3xl flex-col divide-y divide-borde border-y border-borde" style={turno(1)}>
              {PREGUNTAS.map((p) => (
                <details key={p.pregunta} className="pregunta group py-4">
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

        <footer className="bg-[#000710] px-4 py-12 text-sm text-[#b9bbc6] sm:px-6 lg:px-12">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="flex max-w-sm flex-col gap-2">
              <p className="font-semibold text-white">CORE Presupuestos</p>
              <p>Presupuestos para profesionales independientes de los países de habla hispana. Presupuesto comercial: no es un documento tributario.</p>
            </div>
            <nav aria-label="Pie de página" className="flex flex-col gap-2 sm:items-end">
              <a href="#que-hace" className="hover:text-white">Qué hace</a>
              <a href="#como-funciona" className="hover:text-white">Cómo funciona</a>
              <a href="#paises" className="hover:text-white">Países</a>
              <a href="#preguntas" className="hover:text-white">Preguntas frecuentes</a>
              <a href="#consulta" className="hover:text-white">Consultar un presupuesto</a>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
