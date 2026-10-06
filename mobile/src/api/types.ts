// Tipos del Contrato de API §2 que usa la app. Se declaran aquí y no en un paquete compartido (Arquitectura A16).
export type Usuario = { id: string; name: string; phone: string; email: string; country?: string; timezone?: string; contact_phone?: string | null; contact_email?: string | null; has_logo: boolean; has_signature: boolean; use_logo?: boolean; include_signature?: boolean; logo_id?: string | null; signature_id?: string | null };

export type Estado = 'DRAFT' | 'PENDING' | 'FINALIZED';
export type EstadoComercial = 'NONE' | 'SENT' | 'FOLLOW_UP' | 'ACCEPTED' | 'REJECTED';

export type ResumenPresupuesto = {
  id: string;
  version?: number; // 2.ª, 3.ª versión de un presupuesto rechazado (las listas guardadas antes no lo traen)
  code_id?: string; // ID corto; las listas guardadas por una versión anterior no lo traen
  number: string | null;
  customer: { id: string; name: string };
  service_description: string;
  total: number;
  currency?: string; // las listas guardadas antes de los varios países no la traen: pesos chilenos
  doc_status: Estado;
  commercial_status: EstadoComercial;
  next_contact_date: string | null;
  updated_at: string;
};

export type Presupuesto = {
  id: string;
  code_id: string;
  version?: number;
  previous_number?: string | null; // número del rechazado al que reemplaza
  next_version_id?: string | null; // la versión que lo reemplazó
  number: string | null;
  doc_status: Estado;
  commercial_status: EstadoComercial;
  customer: { id: string; name: string; phone: string; email: string | null; address: string | null };
  service_description: string;
  address: string | null;
  latitude?: number | null; // el punto de la dirección en el mapa; van juntos o ninguno
  longitude?: number | null;
  survey: {
    notes: string | null;
    measurements: { id: string; label: string; value: string }[];
    photos: { id: string; url: string; caption: string | null; local_uri?: string }[]; // local_uri: aún no subida
    voice_notes: { id: string; url: string; duration_seconds: number; local_uri?: string }[];
  };
  items: { id: string; kind?: 'ITEM' | 'TASK'; description: string; quantity: number; unit: string; unit_price: number; line_total: number }[]; // TASK: actividad sin cantidad ni unidad; sin `kind` (copias antiguas) es un ítem
  subtotal: number;
  discount: number;
  include_vat: boolean;
  vat: number;
  country?: string; // país, moneda e impuesto del presupuesto, fijados al crearlo; los anteriores a los varios países no los traen
  currency?: string;
  vat_label?: string;
  vat_rate?: number;
  total: number;
  warranty: { kind: string; text: string | null };
  validity_days: number | null;
  next_contact_date: string | null;
  observations: string | null;
  public_url: string | null;
};

export type PresupuestoCreado = Presupuesto & { access_code?: string };

export type Cliente = { id: string; name: string; phone: string; email: string | null; address: string | null };
export type ClienteDetalle = Cliente & { summary: { quotes: number; accepted: number; follow_up: number } };

// Resumen del mes y seguimientos de hoy (Contrato API §11).
export type Indicadores = { month: string; quotes_count: number; quoted_amount: number; accepted_count: number; accepted_amount: number; avg_ticket: number; acceptance_rate: number | null; follow_up_pending: number; waiting_count: number; waiting_amount: number; todo_count: number };
export type Tablero = { counts: { pending: number; follow_up: number; finalized: number }; follow_up: (ResumenPresupuesto & { days_since_sent: number })[] };
