import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../../db';
import { AppError, notFound } from '../../errors';
import type { Snapshot } from '../../lib/snapshot';
import { send } from '../../lib/storage';

// Vista pública del cliente (Contrato API §10): sin autenticación, el token de la URL es la credencial. Solo expone
// el snapshot (nunca user_id, IDs internos, levantamiento, fotos, notas ni seguimiento) y sin teléfono ni correo del cliente.
type Doc = { snapshot: Snapshot; pdf_key: string };

async function docByToken(token: string): Promise<Doc> {
  const { rows } = await query<Doc>(
    `SELECT d.snapshot, f.storage_key AS pdf_key
       FROM quote_access a
       JOIN quote_documents d ON d.quote_id = a.quote_id
       JOIN files f ON f.id = d.pdf_file_id
      WHERE a.kind = 'PUBLIC' AND a.token = $1 AND a.revoked_at IS NULL`, [token]);
  if (!rows[0]) throw notFound(); // inexistente o revocado: el mismo 404
  return rows[0];
}

const view = (s: Snapshot, token: string) => ({
  number: s.number, version: s.version ?? 1, previous_number: s.previous_number ?? null, finalized_at: s.finalized_at, issued_on: s.issued_on ?? null, valid_until: s.valid_until,
  timezone: s.timezone ?? 'America/Santiago', country: s.country ?? 'CL', currency: s.currency ?? 'CLP', vat_label: s.vat_label ?? 'IVA',
  professional: { name: s.professional.name, phone: s.professional.phone, email: s.professional.email, has_logo: !!s.professional.logo_file_id, has_signature: !!s.professional.signature_file_id },
  customer: { name: s.customer.name },
  service_description: s.service_description, service_address: s.service_address,
  items: s.items, subtotal: s.subtotal, discount: s.discount,
  include_vat: s.include_vat ?? false, vat: s.vat ?? 0, vat_rate: s.vat_rate ?? 0, total: s.total,
  warranty: s.warranty, validity_days: s.validity_days, observations: s.observations,
  pdf_url: `/public/quotes/${token}/pdf`,
});

export function publicRoutes(ipLimit = 60) {
  const r = Router();
  const headers: RequestHandler = (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    next();
  };
  const perIp = rateLimit({
    windowMs: 60_000, limit: ipLimit, standardHeaders: false, legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Demasiadas consultas. Intenta en un minuto.', undefined, { 'Retry-After': '60' })),
  });
  r.use(headers);
  r.use((req, _res, next) => (req.method === 'GET' ? next() : next(new AppError(405, 'METHOD_NOT_ALLOWED', 'Solo lectura'))));
  r.use(perIp);

  r.get('/quotes/:token', async (req, res) => {
    const { snapshot } = await docByToken(req.params.token);
    res.json(view(snapshot, req.params.token));
  });

  r.get('/quotes/:token/pdf', async (req, res) => {
    const { snapshot, pdf_key } = await docByToken(req.params.token);
    await send(req, res.attachment(`${snapshot.number}.pdf`).type('application/pdf'), pdf_key);
  });

  // Logo y firma salen del archivo que el snapshot fija; la firma solo si el presupuesto la incluye.
  for (const [name, field] of [['logo', 'logo_file_id'], ['signature', 'signature_file_id']] as const) {
    r.get(`/quotes/:token/assets/${name}`, async (req, res) => {
      const { snapshot } = await docByToken(req.params.token);
      const fileId = snapshot.professional[field];
      if (!fileId || (name === 'signature' && !snapshot.include_signature)) throw notFound();
      const { rows } = await query<{ storage_key: string; mime_type: string }>('SELECT storage_key, mime_type FROM files WHERE id = $1', [fileId]);
      if (!rows[0]) throw notFound();
      await send(req, res.type(rows[0].mime_type), rows[0].storage_key);
    });
  }

  return r;
}
