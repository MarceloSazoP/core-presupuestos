// `QuoteSummary` del Contrato de API §2, compartido por el listado y el dashboard.
export const SUMMARY_COLS = `q.id, q.short_id, q.version, q.number, q.service_description, q.total, q.doc_status, q.commercial_status, q.next_contact_date,
       q.sent_at, q.updated_at, c.id AS customer_id, c.name AS customer_name`;
export const SUMMARY_FROM = `FROM quotes q JOIN customers c ON c.id = q.customer_id AND c.user_id = q.user_id`;

// "Hoy" siempre en America/Santiago (Arquitectura §3, regla 6).
export const TODAY = `(now() AT TIME ZONE 'America/Santiago')::date`;
// Sección Seguimiento (Contrato BD §4). COALESCE: sin fecha de contacto la comparación da NULL y `NOT NULL` sacaría
// al presupuesto de todas las secciones.
export const FOLLOW_UP = `COALESCE(q.commercial_status IN ('SENT','FOLLOW_UP') AND q.next_contact_date <= ${TODAY}, false)`;

type Row = Record<string, unknown>;
export const toSummary = (q: Row) => ({
  id: q.id, code_id: q.short_id, version: q.version, number: q.number, customer: { id: q.customer_id, name: q.customer_name },
  service_description: q.service_description ?? '', total: q.total, doc_status: q.doc_status, commercial_status: q.commercial_status,
  next_contact_date: q.next_contact_date, sent_at: q.sent_at, updated_at: q.updated_at,
});
