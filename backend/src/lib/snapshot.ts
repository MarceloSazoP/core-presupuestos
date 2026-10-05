// Snapshot inmutable de `quote_documents.snapshot` (Contrato BD §5): lo único que leen el PDF y la vista pública.
// Fotos, notas, medidas y observaciones de terreno nunca entran aquí (Definición §14: son internas).
export type Snapshot = {
  number: string;
  version?: number; // 2.ª, 3.ª versión de un rechazado; los snapshots anteriores no lo traen: son la versión 1
  previous_number?: string | null; // número del presupuesto rechazado al que reemplaza
  finalized_at: string; // ISO 8601 UTC
  issued_on?: string; // YYYY-MM-DD, en `timezone`; los anteriores a los varios países no lo traen: se usa `finalized_at` en Santiago
  valid_until: string; // YYYY-MM-DD, en `timezone`
  timezone?: string; // zona del teléfono de quien emitió; si falta, America/Santiago
  country?: string; // país, moneda e impuesto del presupuesto; si faltan, Chile (CL, CLP, IVA)
  currency?: string;
  vat_label?: string;
  professional: { name: string; phone: string; email: string; logo_file_id: string | null; signature_file_id: string | null };
  customer: { name: string };
  service_description: string;
  service_address: string | null;
  items: { kind?: 'ITEM' | 'TASK'; description: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  include_vat?: boolean; // los snapshots anteriores al IVA no lo traen: se leen como false
  vat?: number;
  vat_rate?: number; // la tasa vigente al finalizar, para que el PDF diga siempre lo que se calculó
  total: number;
  warranty: { kind: string; text: string };
  validity_days: number;
  observations: string | null;
  include_signature: boolean;
  include_qr: boolean;
};

const WARRANTY_TEXT: Record<string, string> = {
  NONE: 'Sin garantía', D7: '7 días', D15: '15 días', D30: '30 días', M3: '3 meses', M6: '6 meses', Y1: '1 año', LIFETIME: 'De por vida',
};

export const warrantyText = (kind: string, custom: string | null) => (kind === 'CUSTOM' ? (custom ?? '') : (WARRANTY_TEXT[kind] ?? kind));
