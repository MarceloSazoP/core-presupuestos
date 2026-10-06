// Formato corporativo de los correos que envía el sistema (código de ingreso, QR de recuperación, presupuesto al cliente): una sola
// carcasa sobria con tablas y estilos en línea (lo único que respetan todos los clientes de correo), sin imágenes externas. Cada
// correo trae además su versión de texto plano. Todo lo que viene de una persona se escapa aquí.
export const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const AZUL = '#0E3578'; // azul de la marca: encabezado y títulos
const NARANJA = '#F9890D'; // naranja de la marca: un filete de acento
const TEXTO = '#1F2937';
const SUAVE = '#4B5563'; // 7,5:1 sobre blanco
const LINEA = '#D9DDE3';
const FONDO = '#F2F3F5';
const FUENTE = "Arial,Helvetica,sans-serif";

type Carcasa = {
  preheader: string; // la línea que muestra la bandeja de entrada junto al asunto
  titulo: string;
  cuerpo: string; // HTML ya armado (párrafos, tablas, botones…)
  base?: number; // tamaño de letra del cuerpo en px; 17 por defecto (los correos para quien puede estar leyendo con dificultad suben a 19)
  pie?: string; // texto del pie, además del aviso fijo
};

export function correoCorporativo({ preheader, titulo, cuerpo, base = 17, pie }: Carcasa): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:${FONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapar(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINEA};border-radius:6px;">
    <tr><td style="height:4px;background:${AZUL};border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 32px 18px;font-family:${FUENTE};">
      <div style="font-size:20px;font-weight:bold;letter-spacing:0.3px;color:${AZUL};">CORE Presupuestos</div>
      <div style="width:44px;height:3px;background:${NARANJA};margin-top:10px;font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>
    <tr><td style="padding:6px 32px 8px;font-family:${FUENTE};font-size:${base}px;line-height:1.55;color:${TEXTO};">
      <h1 style="margin:0 0 16px;font-size:${base + 5}px;line-height:1.3;color:${AZUL};font-weight:bold;">${escapar(titulo)}</h1>
      ${cuerpo}
    </td></tr>
    <tr><td style="padding:20px 32px 28px;font-family:${FUENTE};">
      <div style="border-top:1px solid ${LINEA};padding-top:16px;font-size:13px;line-height:1.5;color:${SUAVE};">
        ${pie ? `<div style="margin-bottom:6px;">${pie}</div>` : ''}
        Este es un mensaje automático de CORE Presupuestos; por favor no respondas a este correo. Los presupuestos son documentos comerciales y no constituyen un documento tributario.
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export const parrafo = (html: string, o: { suave?: boolean; px?: number } = {}) =>
  `<p style="margin:0 0 16px;${o.px ? `font-size:${o.px}px;` : ''}${o.suave ? `color:${SUAVE};` : ''}">${html}</p>`;

// Un valor que hay que leer o copiar (el código de ingreso, el código del QR): en un recuadro, con letra monoespaciada.
export const destacado = (valor: string, o: { grande?: boolean; etiqueta?: string } = {}) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td align="center" style="background:#F7F8FA;border:1px solid ${LINEA};border-radius:6px;padding:${o.grande ? '18px 12px' : '12px'};">
    ${o.etiqueta ? `<div style="font-size:13px;color:${SUAVE};margin-bottom:6px;">${escapar(o.etiqueta)}</div>` : ''}
    <div style="font-family:'Courier New',monospace;font-size:${o.grande ? 34 : 16}px;font-weight:bold;letter-spacing:${o.grande ? 8 : 0.5}px;color:${AZUL};word-break:break-all;">${escapar(valor)}</div>
  </td></tr></table>`;

// Una tabla de datos (etiqueta · valor), con filetes finos.
export function datos(filas: [string, string][]) {
  const f = filas
    .map(([k, v], i) => `<tr><td style="padding:10px 0;${i ? `border-top:1px solid ${LINEA};` : ''}color:${SUAVE};font-size:15px;width:38%;vertical-align:top;">${escapar(k)}</td><td style="padding:10px 0;${i ? `border-top:1px solid ${LINEA};` : ''}color:${TEXTO};font-weight:bold;vertical-align:top;">${escapar(v)}</td></tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:2px solid ${AZUL};border-bottom:1px solid ${LINEA};">${f}</table>`;
}

// Botón «a prueba de clientes de correo»: un enlace dentro de una celda con fondo.
export const boton = (texto: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:${AZUL};border-radius:4px;"><a href="${escapar(url)}" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapar(texto)}</a></td></tr></table>`;

export const pasos = (lista: string[]) =>
  `<ol style="margin:0 0 18px;padding-left:24px;">${lista.map((p) => `<li style="margin:0 0 8px;">${p}</li>`).join('')}</ol>`;

export const aviso = (html: string) =>
  `<p style="margin:0 0 16px;padding:12px 14px;background:#FFF8EC;border:1px solid #F3D9A8;border-radius:4px;font-size:15px;color:#5B3A00;">${html}</p>`;

export { SUAVE as COLOR_SUAVE, AZUL as COLOR_AZUL, LINEA as COLOR_LINEA };
