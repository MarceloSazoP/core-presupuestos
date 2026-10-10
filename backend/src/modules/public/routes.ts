import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { query, withTx } from '../../db';
import { AppError, notFound } from '../../errors';
import { audit } from '../../lib/audit';
import { correosAceptado } from '../../lib/correo-presupuesto';
import type { SendMail } from '../../lib/mail';
import type { EnviarPush } from '../../lib/push';
import { formatoMonto } from '../../lib/paises';
import type { Snapshot } from '../../lib/snapshot';
import { send } from '../../lib/storage';
import { pdfDelPresupuesto, readImage } from '../quotes/emission';

// Vista pública del cliente (Contrato API §10): sin autenticación, el token de la URL es la credencial. Solo expone
// el snapshot (nunca user_id, IDs internos, levantamiento, fotos, notas ni seguimiento) y sin teléfono ni correo del cliente.
// Lo único que el cliente puede hacer es aceptar el presupuesto. El PDF es el documento oficial del profesional: la web nunca lo
// entrega; el cliente lo recibe por correo, con el timbre «ACEPTADO», al aceptar (decisiones del 2026-10-10).
type Doc = {
  snapshot: Snapshot; quote_id: string; user_id: string; commercial_status: string; customer_email: string | null;
  accepted_on: string | null; revisado: boolean; vencido: boolean;
};

// La fecha de aceptación y «hoy» se miden en la zona del presupuesto (la de quien lo emitió).
async function docByToken(token: string): Promise<Doc> {
  const { rows } = await query<Doc>(
    `SELECT d.snapshot, q.id AS quote_id, q.user_id, q.commercial_status, c.email AS customer_email,
            CASE WHEN q.commercial_status = 'ACCEPTED'
                 THEN (COALESCE(q.accepted_at, now()) AT TIME ZONE COALESCE(d.snapshot->>'timezone', 'America/Santiago'))::date::text END AS accepted_on,
            EXISTS (SELECT 1 FROM quotes v WHERE v.parent_quote_id = q.id) AS revisado,
            (now() AT TIME ZONE COALESCE(d.snapshot->>'timezone', 'America/Santiago'))::date > (d.snapshot->>'valid_until')::date AS vencido
       FROM quote_access a
       JOIN quotes q ON q.id = a.quote_id
       JOIN quote_documents d ON d.quote_id = q.id
       LEFT JOIN customers c ON c.id = q.customer_id
      WHERE a.kind = 'PUBLIC' AND a.token = $1 AND a.revoked_at IS NULL`, [token]);
  if (!rows[0]) throw notFound(); // inexistente o revocado: el mismo 404
  return rows[0];
}

const fecha = (iso: string) => iso.split('-').reverse().join('-'); // YYYY-MM-DD → DD-MM-YYYY

// Por qué ya no se puede aceptar (null si se puede). El mensaje invita a hablar con el profesional.
function noAceptable(d: Doc): string | null {
  const llamar = `Comunícate con ${d.snapshot.professional.name} para revisarlo.`;
  if (d.commercial_status === 'REJECTED') return `Este presupuesto ya no está vigente. ${llamar}`;
  if (d.revisado) return `Hay una versión más nueva de este presupuesto. ${llamar}`;
  if (d.vencido) return `Este presupuesto venció el ${fecha(d.snapshot.valid_until)}. ${llamar}`;
  return null;
}

const view = (d: Doc) => {
  const s = d.snapshot;
  return {
    number: s.number, version: s.version ?? 1, previous_number: s.previous_number ?? null, finalized_at: s.finalized_at, issued_on: s.issued_on ?? null, valid_until: s.valid_until,
    timezone: s.timezone ?? 'America/Santiago', country: s.country ?? 'CL', currency: s.currency ?? 'CLP', vat_label: s.vat_label ?? 'IVA',
    professional: { name: s.professional.name, phone: s.professional.phone, email: s.professional.email, has_logo: !!s.professional.logo_file_id, has_signature: !!s.professional.signature_file_id },
    customer: { name: s.customer.name },
    service_description: s.service_description, service_address: s.service_address,
    items: s.items, subtotal: s.subtotal, discount: s.discount,
    include_vat: s.include_vat ?? false, vat: s.vat ?? 0, vat_rate: s.vat_rate ?? 0, total: s.total,
    warranty: s.warranty, validity_days: s.validity_days, observations: s.observations,
    accepted_on: d.accepted_on,
    can_accept: !d.accepted_on && !noAceptable(d),
    customer_has_email: !!d.customer_email, // para decirle si le llega el PDF por correo (sin mostrar el correo)
  };
};

export function publicRoutes(sendMail: SendMail, enviarPush: EnviarPush, ipLimit = 60) {
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
  // Solo lectura, salvo aceptar.
  r.use((req, _res, next) => (req.method === 'GET' || (req.method === 'POST' && req.path.endsWith('/accept')) ? next() : next(new AppError(405, 'METHOD_NOT_ALLOWED', 'Solo lectura'))));
  r.use(perIp);

  r.get('/quotes/:token', async (req, res) => {
    res.json(view(await docByToken(req.params.token)));
  });

  // Aceptar (Contrato API §10): solo con este POST, que la vista pide confirmar. Los correos salen después de guardar: si uno
  // falla, la aceptación ya quedó y solo se registra el error. Ya aceptado ⇒ 200 sin repetir nada.
  r.post('/quotes/:token/accept', async (req, res) => {
    const token = req.params.token;
    const d = await docByToken(token);
    if (d.accepted_on) return void res.json({ ...view(d), confirmation_sent: false });
    const motivo = noAceptable(d);
    if (motivo) throw new AppError(409, 'INVALID_STATE', motivo);
    const aceptado = await withTx(async (c) => {
      const { rowCount } = await c.query(
        `UPDATE quotes SET commercial_status = 'ACCEPTED', accepted_at = now(), next_contact_date = NULL, updated_at = now()
          WHERE id = $1 AND commercial_status NOT IN ('ACCEPTED', 'REJECTED')`, [d.quote_id]);
      if (rowCount) await c.query(`INSERT INTO follow_ups (quote_id, user_id, note, commercial_status) VALUES ($1, $2, 'Aceptado por el cliente desde el enlace', 'ACCEPTED')`, [d.quote_id, d.user_id]);
      return rowCount === 1;
    });
    const ahora = await docByToken(token);
    if (!aceptado) return void res.json({ ...view(ahora), confirmation_sent: false }); // otro lo aceptó (o rechazó) recién
    await audit(req, 'QUOTE_ACCEPTED_BY_CUSTOMER', { userId: d.user_id, quoteId: d.quote_id });

    const imagen = await readImage(ahora.snapshot.professional.logo_file_id);
    const logo = imagen && { content: imagen.data, contentType: imagen.mime };
    const correos = correosAceptado(ahora.snapshot, fecha(ahora.accepted_on!), !!logo);
    const adjunto = { filename: `${ahora.snapshot.number}-aceptado.pdf`, content: (await pdfDelPresupuesto(d.quote_id)).aceptado! };
    // El del cliente lleva el logo arriba (si lo hay); el aviso al profesional, no.
    const enviar = (to: string, m: { subject: string; text: string; html: string }, conLogo = false) =>
      sendMail({ to, ...m, attachment: adjunto, ...(conLogo && logo && { logo }) }).then(() => true, (e: unknown) => (console.error('Correo de aceptación:', e), false));
    // El aviso push al profesional: le llega aunque tenga la app cerrada (Arquitectura §5). Se espera aquí: en Vercel la función se
    // congela al responder.
    const s = ahora.snapshot;
    const [confirmation_sent] = await Promise.all([
      ahora.customer_email ? enviar(ahora.customer_email, correos.cliente, true) : false,
      enviar(s.professional.email, correos.profesional),
      enviarPush(d.user_id, { title: 'Presupuesto aceptado', body: `${s.customer.name} aceptó el presupuesto ${s.number} (${formatoMonto(s.total, s.currency ?? 'CLP')}).`, data: { tipo: 'aceptado', quoteId: d.quote_id } }),
    ]);
    res.json({ ...view(ahora), confirmation_sent });
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
