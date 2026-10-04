// Traduce entre el contrato de la API (inglés, códigos) y el modelo de las pantallas (español, textos). Sin lógica de
// negocio: las reglas viven en el backend (CLAUDE.md §6). Es un archivo puro para poder probarlo sin servidor.
import type { GARANTIAS } from './opciones';

// Garantía: el texto que elige la persona ↔ el `warranty.kind` de la API (Contrato API §2).
const GARANTIA_A_CODIGO: Record<(typeof GARANTIAS)[number], string> = {
  'Sin garantía': 'NONE', '7 días': 'D7', '15 días': 'D15', '30 días': 'D30', '3 meses': 'M3', '6 meses': 'M6', '1 año': 'Y1',
};
export const codigoGarantia = (texto: string) => GARANTIA_A_CODIGO[texto as keyof typeof GARANTIA_A_CODIGO];
export const textoGarantia = (kind: string, personalizada: string | null) =>
  kind === 'CUSTOM' ? (personalizada ?? '') : (Object.entries(GARANTIA_A_CODIGO).find(([, c]) => c === kind)?.[0] ?? 'Sin garantía');

// Lo que devuelve `GET /quotes/{id}` y la web usa (Contrato API §2).
export type QuoteApi = {
  id: string;
  number: string | null;
  doc_status: 'DRAFT' | 'PENDING' | 'FINALIZED';
  commercial_status: string;
  customer: { name: string; phone: string; email: string | null };
  professional: { name: string; phone: string; email: string; has_logo: boolean };
  service_description: string;
  address: string | null;
  survey: { notes: string | null; measurements: { label: string; value: string }[]; photos: { id: string }[]; voice_notes: { id: string; duration_seconds: number }[] };
  items: { description: string; quantity: number; unit: string; unit_price: number }[];
  subtotal: number;
  discount: number;
  include_vat: boolean;
  vat: number;
  total: number;
  warranty: { kind: string; text: string | null };
  validity_days: number | null;
  observations: string | null;
  sent_at: string | null;
  public_url: string | null;
};

export type Presupuesto = {
  id: string;
  numero: string | null;
  estado: 'PENDING' | 'FINALIZED'; // DRAFT y PENDING se editan igual
  enviado: boolean;
  publicUrl: string | null;
  profesional: { nombre: string; telefono: string; correo: string; tieneLogo: boolean };
  cliente: { nombre: string; telefono: string; correo: string | null };
  descripcion: string;
  direccion: string | null;
  levantamiento: { notas: string | null; medidas: { etiqueta: string; valor: string }[]; fotos: string[]; audios: { id: string; segundos: number }[] };
  items: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
  subtotal: number;
  descuento: number;
  conIva: boolean;
  iva: number;
  total: number;
  garantia: string;
  validezDias: number;
  observaciones: string | null;
};

const VALIDEZ_POR_DEFECTO = 15;

export const aPresupuesto = (q: QuoteApi): Presupuesto => ({
  id: q.id,
  numero: q.number,
  estado: q.doc_status === 'FINALIZED' ? 'FINALIZED' : 'PENDING',
  enviado: q.sent_at !== null,
  publicUrl: q.public_url,
  profesional: { nombre: q.professional.name, telefono: q.professional.phone, correo: q.professional.email, tieneLogo: q.professional.has_logo },
  cliente: { nombre: q.customer.name, telefono: q.customer.phone, correo: q.customer.email },
  descripcion: q.service_description,
  direccion: q.address,
  levantamiento: {
    notas: q.survey.notes,
    medidas: q.survey.measurements.map((m) => ({ etiqueta: m.label, valor: m.value })),
    fotos: q.survey.photos.map((f) => f.id),
    audios: q.survey.voice_notes.map((v) => ({ id: v.id, segundos: v.duration_seconds })),
  },
  items: q.items.map((i) => ({ descripcion: i.description, cantidad: i.quantity, unidad: i.unit, precioUnitario: i.unit_price })),
  subtotal: q.subtotal,
  descuento: q.discount,
  conIva: q.include_vat,
  iva: q.vat,
  total: q.total,
  garantia: textoGarantia(q.warranty.kind, q.warranty.text),
  validezDias: q.validity_days ?? VALIDEZ_POR_DEFECTO, // el presupuesto que crea la app puede no traer vigencia
  observaciones: q.observations,
});

// Mensajes legibles para los errores 422 de la API (`details[].field` usa rutas como `items.0.quantity`).
const CAMPOS: Record<string, string> = {
  service_description: 'Servicio', items: 'Ítems', discount: 'Descuento', validity_days: 'Validez', 'warranty.text': 'Garantía',
  observations: 'Observaciones', logo_o_firma: 'Logo o firma', to: 'Correo',
};
export function mensajesDeError(details: { field: string; message: string }[], mensajeGeneral: string): string[] {
  if (details.length === 0) return [mensajeGeneral];
  const unicos = details.map((d) => {
    const fila = /^items\.(\d+)\./.exec(d.field);
    const campo = fila ? `Ítem ${Number(fila[1]) + 1}` : CAMPOS[d.field];
    return campo ? `${campo}: ${d.message}` : d.message;
  });
  return [...new Set(unicos)];
}
