import { formatoMonto } from './paises';
import { boton, correoCorporativo, datos, escapar, parrafo } from './plantilla-correo';
import type { Snapshot } from './snapshot';

// El presupuesto al cliente: el mensaje de quien lo emite (o uno por defecto), un resumen con el total y la vigencia, y el botón para verlo en línea.
// El PDF va adjunto; el pie lleva los datos de contacto del profesional.
const fecha = (iso: string) => iso.split('-').reverse().join('-'); // YYYY-MM-DD → DD-MM-YYYY

export function correoPresupuesto(s: Snapshot, url: string, mensaje?: string): string {
  const moneda = s.currency ?? 'CLP';
  const impuesto = s.include_vat ? ` (${s.vat_label ?? 'IVA'} incluido)` : '';
  return correoCorporativo({
    preheader: `Presupuesto ${s.number} de ${s.professional.name}: ${formatoMonto(s.total, moneda)}.`,
    titulo: `Presupuesto ${s.number}`,
    cuerpo:
      parrafo(escapar(mensaje ?? `Hola ${s.customer.name}, te adjunto el presupuesto ${s.number}.`).replace(/\n/g, '<br>')) +
      datos([
        ['Presentado por', s.professional.name],
        ['Para', s.customer.name],
        ['Trabajo', s.service_description],
        ['Total', `${formatoMonto(s.total, moneda)}${impuesto}`],
        ['Válido hasta', fecha(s.valid_until)],
      ]) +
      boton('Ver el presupuesto en línea', url) +
      parrafo('El presupuesto también va adjunto a este correo, en PDF.', { suave: true }),
    pie: `<strong>${escapar(s.professional.name)}</strong> · ${escapar(s.professional.phone)} · ${escapar(s.professional.email)}`,
  });
}
