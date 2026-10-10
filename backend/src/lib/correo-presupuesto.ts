import { unitSymbol } from '../modules/quotes/units';
import { formatoMonto, tasaLegible } from './paises';
import { qty } from './pdf';
import { boton, botonesSecundarios, COLOR_AZUL, COLOR_LINEA, COLOR_SUAVE, correoCorporativo, datos, escapar, parrafo, sello } from './plantilla-correo';
import type { Snapshot } from './snapshot';

// El presupuesto al cliente: el mensaje de quien lo emite (o uno por defecto), el presupuesto COMPLETO en el cuerpo del correo
// (ítems, totales y condiciones: no se cuenta con que abra el enlace) y lo que el cliente puede hacer: aceptarlo (abre su vista y
// confirma ahí, Contrato API §10; es el único enlace al presupuesto) o llamar o escribir al profesional. No hay botón de rechazar. El PDF no va: es el documento
// oficial y el cliente lo recibe al aceptar. El pie lleva los datos de contacto del profesional.
const fecha = (iso: string) => iso.split('-').reverse().join('-'); // YYYY-MM-DD → DD-MM-YYYY
export const urlAceptar = (url: string) => `${url}?aceptar=1`;
const whatsapp = (telefono: string) => `https://wa.me/${telefono.replace(/\D/g, '')}`;
const dinero = (s: Snapshot) => (n: number) => formatoMonto(n, s.currency ?? 'CLP');

// Las filas de totales y el detalle de cada ítem, compartidos por el HTML y el texto plano.
const totales = (s: Snapshot): [string, string][] => [
  ['Subtotal', dinero(s)(s.subtotal)],
  ...(s.discount > 0 ? [['Descuento', `-${dinero(s)(s.discount)}`] as [string, string]] : []),
  ...(s.include_vat ? [[`${s.vat_label ?? 'IVA'} (${tasaLegible(s.vat_rate ?? 19)} %)`, dinero(s)(s.vat ?? 0)] as [string, string]] : []),
  ['Total', dinero(s)(s.total)],
];
const lineaItem = (s: Snapshot, i: Snapshot['items'][number]) => ({
  detalle: i.kind === 'TASK' ? 'Tarea' : `${qty(i.quantity)} ${unitSymbol(i.unit)} × ${dinero(s)(i.unit_price)}`,
  valor: i.kind === 'TASK' && i.line_total === 0 ? 'Incluido' : dinero(s)(i.line_total),
});
const condiciones = (s: Snapshot): [string, string][] => [
  ['Garantía', s.warranty.text],
  ['Validez', `${s.validity_days} días (hasta el ${fecha(s.valid_until)})`],
  ...(s.observations ? [['Observaciones', s.observations] as [string, string]] : []),
];

// El presupuesto entero, con tablas y estilos en línea (lo único que respetan todos los clientes de correo).
function presupuestoCompleto(s: Snapshot): string {
  const rotulo = (t: string) => `<div style="margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${COLOR_SUAVE};">${t}</div>`;
  const items = s.items
    .map((i, n) => {
      const l = lineaItem(s, i);
      const borde = n ? `border-top:1px solid ${COLOR_LINEA};` : '';
      return `<tr><td style="padding:10px 12px 10px 0;vertical-align:top;word-break:break-word;${borde}"><div style="font-weight:bold;">${escapar(i.description)}</div><div style="font-size:14px;color:${COLOR_SUAVE};">${escapar(l.detalle)}</div></td><td align="right" style="padding:10px 0;vertical-align:top;white-space:nowrap;font-weight:bold;${borde}">${escapar(l.valor)}</td></tr>`;
    })
    .join('');
  const filasTotales = totales(s)
    .map(([k, v], n, todas) => {
      const final = n === todas.length - 1;
      const estilo = final ? `padding:10px 0 4px;border-top:2px solid ${COLOR_AZUL};font-size:20px;font-weight:bold;color:${COLOR_AZUL};` : `padding:4px 0;color:${COLOR_SUAVE};`;
      return `<tr><td align="right" style="${estilo}padding-right:16px;">${escapar(k)}</td><td align="right" style="${estilo}white-space:nowrap;">${escapar(v)}</td></tr>`;
    })
    .join('');
  return (
    datos([
      ['Presentado por', s.professional.name],
      ['Para', s.customer.name],
      ...(s.service_address ? [['Dirección', s.service_address] as [string, string]] : []),
      ['Servicio', s.service_description],
      ...(s.issued_on ? [['Fecha', fecha(s.issued_on)] as [string, string]] : []),
    ]) +
    rotulo('Detalle') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;border-top:1px solid ${COLOR_LINEA};border-bottom:1px solid ${COLOR_LINEA};">${items}</table>` +
    `<table role="presentation" align="right" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${filasTotales}</table><div style="clear:both;"></div>` +
    rotulo('Condiciones') +
    datos(condiciones(s))
  );
}

// Lo mismo en texto plano, para los clientes de correo que no muestran HTML.
const textoCompleto = (s: Snapshot) =>
  [
    `Presupuesto ${s.number} de ${s.professional.name}`,
    `Para: ${s.customer.name}${s.service_address ? ` (${s.service_address})` : ''}`,
    `Servicio: ${s.service_description}`,
    '',
    'Detalle:',
    ...s.items.map((i) => {
      const l = lineaItem(s, i);
      return `- ${i.description}: ${i.kind === 'TASK' ? l.valor : `${l.detalle} = ${l.valor}`}`;
    }),
    '',
    ...totales(s).map(([k, v]) => `${k}: ${v}`),
    '',
    ...condiciones(s).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');

const contacto = (s: Snapshot) => botonesSecundarios([['Llamar por teléfono', `tel:${s.professional.phone}`], ['Escribir por WhatsApp', whatsapp(s.professional.phone)]]);
const pie = (s: Snapshot) => `<strong>${escapar(s.professional.name)}</strong> · ${escapar(s.professional.phone)} · ${escapar(s.professional.email)}`;

// `estado`: «aceptable» ofrece el botón de aceptar; «aceptado» va sin él y con el PDF timbrado adjunto; «cerrado» (rechazado) va
// sin botón ni PDF.
export type EstadoCorreo = 'aceptable' | 'aceptado' | 'cerrado';
const saludo = (s: Snapshot) => `Hola ${s.customer.name}, te envío el presupuesto ${s.number}. Puedes revisarlo aquí mismo y aceptarlo desde este correo.`;
const invitacion = (s: Snapshot) => `¿Tienes dudas o quieres cambiar algo? Habla con ${escapar(s.professional.name)}:`;

export function correoPresupuesto(s: Snapshot, url: string, mensaje?: string, estado: EstadoCorreo = 'aceptable'): string {
  const aceptar = estado === 'aceptable' ? boton('Aceptar el presupuesto', urlAceptar(url)) : '';
  return correoCorporativo({
    preheader: `Presupuesto ${s.number} de ${s.professional.name}: ${formatoMonto(s.total, s.currency ?? 'CLP')}.`,
    titulo: `Presupuesto ${s.number}`,
    cuerpo:
      parrafo(escapar(mensaje ?? saludo(s)).replace(/\n/g, '<br>')) +
      aceptar + // arriba también: quien ya lo conversó no tiene que bajar hasta el final
      presupuestoCompleto(s) +
      aceptar +
      parrafo(invitacion(s)) +
      contacto(s) +
      (estado === 'aceptado' ? parrafo('El PDF con el timbre de aceptado va adjunto.', { suave: true }) : ''),
    pie: pie(s),
  });
}

export const textoPresupuesto = (s: Snapshot, url: string, mensaje?: string, estado: EstadoCorreo = 'aceptable') =>
  [
    mensaje ?? saludo(s),
    '',
    textoCompleto(s),
    '',
    ...(estado === 'aceptable' ? [`Para aceptarlo: ${urlAceptar(url)}`] : []),
    `¿Dudas? Llama o escribe a ${s.professional.name}: ${s.professional.phone}`,
  ].join('\n');

// La confirmación de que el cliente aceptó: al cliente, el mismo presupuesto completo con el sello y los botones para hablar con el
// profesional; al profesional, el aviso con un resumen. Los dos llevan el PDF con el timbre «ACEPTADO». `dia`: DD-MM-AAAA.
export function correosAceptado(s: Snapshot, dia: string) {
  const total = formatoMonto(s.total, s.currency ?? 'CLP');
  return {
    cliente: {
      subject: `Aceptaste el presupuesto ${s.number} de ${s.professional.name}`,
      text: [
        `Hola ${s.customer.name}, confirmamos que aceptaste el presupuesto ${s.number} el ${dia}. Te adjuntamos el PDF con el timbre de aceptado.`,
        '',
        textoCompleto(s),
        '',
        `${s.professional.name} se pondrá en contacto contigo para coordinar el trabajo: ${s.professional.phone}`,
      ].join('\n'),
      html: correoCorporativo({
        preheader: `Aceptaste el presupuesto ${s.number}: ${total}.`,
        titulo: `Presupuesto ${s.number} aceptado`,
        cuerpo:
          sello('ACEPTADO', `el ${dia}`) +
          parrafo(`Hola ${escapar(s.customer.name)}, confirmamos que aceptaste el presupuesto ${escapar(s.number)}. Te adjuntamos el PDF con el timbre de aceptado.`) +
          presupuestoCompleto(s) +
          parrafo(`${escapar(s.professional.name)} se pondrá en contacto contigo para coordinar el trabajo. Si quieres hablar antes:`) +
          contacto(s),
        pie: pie(s),
      }),
    },
    profesional: {
      subject: `${s.customer.name} aceptó el presupuesto ${s.number}`,
      text: `${s.customer.name} aceptó el presupuesto ${s.number} (${total}) el ${dia}. Ya figura como aceptado en la app. Te adjuntamos el PDF con el timbre de aceptado.`,
      html: correoCorporativo({
        preheader: `${s.customer.name} aceptó el presupuesto ${s.number}: ${total}.`,
        titulo: `${s.customer.name} aceptó tu presupuesto`,
        cuerpo:
          sello('ACEPTADO', `el ${dia}`) +
          parrafo(`${escapar(s.customer.name)} aceptó el presupuesto ${escapar(s.number)} desde el enlace que le enviaste. Ya figura como aceptado en la app.`) +
          datos([
            ['Cliente', s.customer.name],
            ['Servicio', s.service_description],
            ['Total', total],
          ]) +
          parrafo('Te adjuntamos el PDF con el timbre de aceptado.', { suave: true }),
      }),
    },
  };
}
