import { config } from '../../config';
import { query } from '../../db';

export type QuoteRow = {
  id: string; user_id: string; customer_id: string; short_id: string; number: string | null;
  version: number; parent_quote_id: string | null;
  doc_status: 'DRAFT' | 'PENDING' | 'FINALIZED'; commercial_status: string;
  service_description: string | null; address: string | null; latitude: number | null; longitude: number | null;
  subtotal: number; discount: number; include_vat: boolean; vat: number; total: number;
  warranty_kind: string; warranty_text: string | null; validity_days: number | null; observations: string | null;
  include_qr: boolean; next_contact_date: string | null;
  finalized_at: Date | null; sent_at: Date | null; accepted_at: Date | null; created_at: Date; updated_at: Date;
};

// Serializador explícito del `Quote` del Contrato de API §2 (nunca SELECT * hacia el cliente).
// `public_url` existe solo mientras el presupuesto tiene un enlace público activo (desde que se finaliza).
export async function quoteDetail(q: QuoteRow) {
  const [customer, survey, measurements, photos, voice, items, access, pro, parent, child] = await Promise.all([
    query('SELECT id, name, phone, email, address, created_at, updated_at FROM customers WHERE id = $1 AND user_id = $2', [q.customer_id, q.user_id]),
    query<{ notes: string | null; field_observations: string | null }>('SELECT notes, field_observations FROM quote_surveys WHERE quote_id = $1', [q.id]),
    query('SELECT id, label, value FROM survey_measurements WHERE quote_id = $1 ORDER BY position', [q.id]),
    query('SELECT file_id, caption, created_at FROM survey_photos WHERE quote_id = $1 ORDER BY position, created_at', [q.id]),
    query('SELECT file_id, duration_seconds, created_at FROM survey_voice_notes WHERE quote_id = $1 ORDER BY created_at', [q.id]),
    query('SELECT id, kind, description, quantity, unit, unit_price, line_total FROM quote_items WHERE quote_id = $1 ORDER BY position', [q.id]),
    query<{ token: string }>(`SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC' AND revoked_at IS NULL`, [q.id]),
    query<{ name: string; phone: string; email: string; logo_file_id: string | null; use_logo: boolean }>('SELECT name, COALESCE(contact_phone, phone) AS phone, COALESCE(contact_email, email) AS email, logo_file_id, use_logo FROM users WHERE id = $1', [q.user_id]),
    q.parent_quote_id ? query<{ number: string }>('SELECT number FROM quotes WHERE id = $1', [q.parent_quote_id]) : Promise.resolve({ rows: [] as { number: string }[] }),
    query<{ id: string }>('SELECT id FROM quotes WHERE parent_quote_id = $1', [q.id]),
  ]);
  return {
    id: q.id, code_id: q.short_id, number: q.number, doc_status: q.doc_status, commercial_status: q.commercial_status,
    // 2.ª, 3.ª versión de un presupuesto rechazado (Contrato API §6): de cuál viene y cuál lo reemplazó
    version: q.version, previous_number: parent.rows[0]?.number ?? null, next_version_id: child.rows[0]?.id ?? null,
    customer: customer.rows[0],
    // Quien emite el presupuesto: lo necesita la web (que entra con el código, sin acceso a /me) para su encabezado.
    professional: { name: pro.rows[0]!.name, phone: pro.rows[0]!.phone, email: pro.rows[0]!.email, has_logo: pro.rows[0]!.use_logo && pro.rows[0]!.logo_file_id !== null },
    service_description: q.service_description ?? '', address: q.address, latitude: q.latitude, longitude: q.longitude,
    survey: {
      notes: survey.rows[0]?.notes ?? null,
      field_observations: survey.rows[0]?.field_observations ?? null,
      measurements: measurements.rows,
      photos: photos.rows.map((p) => ({ id: p.file_id, url: `/files/${p.file_id}`, caption: p.caption, created_at: p.created_at })),
      voice_notes: voice.rows.map((v) => ({ id: v.file_id, url: `/files/${v.file_id}`, duration_seconds: v.duration_seconds, created_at: v.created_at })),
    },
    items: items.rows,
    subtotal: q.subtotal, discount: q.discount, include_vat: q.include_vat, vat: q.vat, total: q.total,
    warranty: { kind: q.warranty_kind, text: q.warranty_text },
    validity_days: q.validity_days, observations: q.observations,
    include_qr: q.include_qr,
    next_contact_date: q.next_contact_date,
    finalized_at: q.finalized_at, sent_at: q.sent_at, accepted_at: q.accepted_at,
    public_url: access.rows[0] ? `${config.WEB_BASE_URL}/q/${access.rows[0].token}` : null,
    created_at: q.created_at, updated_at: q.updated_at,
  };
}
