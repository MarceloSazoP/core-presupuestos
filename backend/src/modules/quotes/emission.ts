import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Request, Router } from 'express';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { config } from '../../config';
import { query, withTx } from '../../db';
import { AppError, type Detail } from '../../errors';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import type { SendMail } from '../../lib/mail';
import { buildPdf, type Image } from '../../lib/pdf';
import { warrantyText, type Snapshot } from '../../lib/snapshot';
import { ensureTmp, keyFor, pathOf, put, remove, tmpDir } from '../../lib/storage';
import { allow, editable, loadQuote, session } from './guard';
import { quoteDetail, type QuoteRow } from './serialize';

export const publicUrl = (token: string) => `${config.WEB_BASE_URL}/q/${token}`;

type ItemRow = { description: string; quantity: number; unit: string; unit_price: number; line_total: number };
type UserRow = { name: string; phone: string; email: string; logo_file_id: string | null; signature_file_id: string | null };

// Lo que exige `finalize` (Contrato API §7). Devuelve todos los problemas juntos, no solo el primero.
function problems(q: QuoteRow, items: ItemRow[], user: UserRow): Detail[] {
  const d: Detail[] = [];
  if (!q.service_description?.trim()) d.push({ field: 'service_description', message: 'Describe el servicio' });
  if (items.length === 0) d.push({ field: 'items', message: 'Agrega al menos un ítem' });
  if (q.discount > q.subtotal) d.push({ field: 'discount', message: 'El descuento no puede superar el subtotal' });
  if (q.validity_days == null) d.push({ field: 'validity_days', message: 'Define la validez del presupuesto' });
  if (q.warranty_kind === 'CUSTOM' && !q.warranty_text) d.push({ field: 'warranty.text', message: 'Escribe la garantía' });
  if (q.include_signature && !user.signature_file_id) d.push({ field: 'include_signature', message: 'Sube tu firma para incluirla' });
  return d;
}

async function readImage(fileId: string | null): Promise<Image | undefined> {
  if (!fileId) return undefined;
  const { rows } = await query<{ storage_key: string; mime_type: string }>('SELECT storage_key, mime_type FROM files WHERE id = $1', [fileId]);
  return rows[0] ? { data: await readFile(pathOf(rows[0].storage_key)), mime: rows[0].mime_type } : undefined;
}

// Registrar el envío (Contrato API §7): NONE → SENT solo la primera vez; siempre queda en la auditoría con su canal.
async function registerSend(req: Request, q: QuoteRow, channel: string) {
  await query(`UPDATE quotes SET commercial_status = 'SENT', sent_at = now(), updated_at = now() WHERE id = $1 AND commercial_status = 'NONE'`, [q.id]);
  await audit(req, 'QUOTE_SENT', { userId: q.user_id, quoteId: q.id, metadata: { channel } });
}

const finalizedOnly = (q: QuoteRow) => {
  if (q.doc_status !== 'FINALIZED') throw new AppError(409, 'INVALID_STATE', 'El presupuesto aún no está finalizado');
};

async function activeToken(quoteId: string): Promise<string> {
  const { rows } = await query<{ token: string }>(`SELECT token FROM quote_access WHERE quote_id = $1 AND kind = 'PUBLIC' AND revoked_at IS NULL`, [quoteId]);
  if (!rows[0]) throw new AppError(409, 'INVALID_STATE', 'El presupuesto no tiene enlace público');
  return rows[0].token;
}

export function addEmissionRoutes(r: Router, deps: { sendMail: SendMail; mailLimit?: number }) {
  // ── Finalizar: snapshot + PDF + QR + enlace público, todo o nada ─────────────────────────────
  r.post('/:id/finalize', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q0 = await loadQuote(req, req.params.id);
    editable(q0);
    const [items, user, customer] = await Promise.all([
      query<ItemRow>('SELECT description, quantity, unit, unit_price, line_total FROM quote_items WHERE quote_id = $1 ORDER BY position', [q0.id]),
      query<UserRow>('SELECT name, phone, email, logo_file_id, signature_file_id FROM users WHERE id = $1', [q0.user_id]),
      query<{ name: string }>('SELECT name FROM customers WHERE id = $1 AND user_id = $2', [q0.customer_id, q0.user_id]),
    ]);
    const bad = problems(q0, items.rows, user.rows[0]!);
    if (bad.length) throw new AppError(422, 'VALIDATION_FAILED', 'El presupuesto está incompleto', bad);

    const fileId = randomUUID();
    const key = keyFor(q0.user_id, q0.id, fileId, 'pdf');
    let written = false;
    try {
      await withTx(async (c) => {
        // Bloqueo de la fila: dos "terminar" simultáneos no numeran dos veces; el segundo ve FINALIZED y recibe 409.
        const { rows: lock } = await c.query<QuoteRow>('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [q0.id]);
        editable(lock[0]!);
        const q = lock[0]!;
        const { rows: t } = await c.query<{ ts: Date; valid_until: string; year: number }>(
          `SELECT now() AS ts, ((now() AT TIME ZONE 'America/Santiago')::date + $1::int)::text AS valid_until,
                  extract(year FROM now() AT TIME ZONE 'America/Santiago')::int AS year`, [q.validity_days]);
        // Numeración atómica CP-AAAA-NNNN por usuario y año (Arquitectura §3, regla 5).
        const { rows: n } = await c.query<{ last_number: number }>(
          `INSERT INTO quote_counters (user_id, year, last_number) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, year) DO UPDATE SET last_number = quote_counters.last_number + 1 RETURNING last_number`, [q.user_id, t[0]!.year]);
        const number = `CP-${t[0]!.year}-${String(n[0]!.last_number).padStart(4, '0')}`;

        const u = user.rows[0]!;
        const snapshot: Snapshot = {
          number, finalized_at: t[0]!.ts.toISOString(), valid_until: t[0]!.valid_until,
          professional: { name: u.name, phone: u.phone, email: u.email, logo_file_id: u.logo_file_id, signature_file_id: q.include_signature ? u.signature_file_id : null },
          customer: { name: customer.rows[0]!.name },
          service_description: q.service_description!.trim(), service_address: q.address,
          items: items.rows.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, line_total: i.line_total })),
          subtotal: q.subtotal, discount: q.discount, total: q.total,
          warranty: { kind: q.warranty_kind, text: warrantyText(q.warranty_kind, q.warranty_text) },
          validity_days: q.validity_days!, observations: q.observations, include_signature: q.include_signature, include_qr: q.include_qr,
        };

        const token = randomBytes(24).toString('base64url'); // 192 bits
        const pdf = await buildPdf(snapshot, {
          logo: await readImage(u.logo_file_id),
          signature: q.include_signature ? await readImage(u.signature_file_id) : undefined,
          qr: q.include_qr ? await QRCode.toBuffer(publicUrl(token), { margin: 1, width: 300 }) : undefined,
        }).catch((e: unknown) => {
          // El tipo se detecta por la firma de bytes, pero el contenido puede estar corrupto: se pide volver a subirlo.
          if (/Invalid image/i.test(String(e))) throw new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'logo_o_firma', message: 'El logo o la firma no es una imagen válida: súbela de nuevo' }]);
          throw e;
        });
        await ensureTmp();
        const tmp = join(tmpDir(), randomUUID());
        await writeFile(tmp, pdf);
        await put(key, tmp);
        written = true;

        await c.query(`INSERT INTO files (id, user_id, quote_id, kind, storage_key, mime_type, size_bytes) VALUES ($1, $2, $3, 'PDF', $4, 'application/pdf', $5)`, [fileId, q.user_id, q.id, key, pdf.length]);
        await c.query('INSERT INTO quote_documents (quote_id, snapshot, pdf_file_id) VALUES ($1, $2, $3)', [q.id, JSON.stringify(snapshot), fileId]);
        await c.query(`INSERT INTO quote_access (quote_id, kind, token) VALUES ($1, 'PUBLIC', $2)`, [q.id, token]);
        await c.query(`UPDATE quotes SET doc_status = 'FINALIZED', number = $2, finalized_at = $3, updated_at = now() WHERE id = $1`, [q.id, number, t[0]!.ts]);
      });
    } catch (e) {
      if (written) await remove(key).catch(() => {}); // si algo falló, no queda un PDF suelto
      throw e;
    }
    await audit(req, 'QUOTE_FINALIZED', { userId: q0.user_id, quoteId: q0.id });
    res.json(await quoteDetail(await loadQuote(req, q0.id)));
  });

  // Logo de quien emite: el actual mientras se edita, y el que quedó fijado en el snapshot una vez finalizado.
  r.get('/:id/logo', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
      `SELECT f.storage_key, f.mime_type FROM files f
        WHERE f.id = CASE WHEN $2 THEN (SELECT (snapshot->'professional'->>'logo_file_id')::uuid FROM quote_documents WHERE quote_id = $1)
                          ELSE (SELECT logo_file_id FROM users WHERE id = $3) END`,
      [q.id, q.doc_status === 'FINALIZED', q.user_id]);
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No encontrado');
    res.type(rows[0].mime_type).sendFile(pathOf(rows[0].storage_key));
  });

  // ── Salidas de un presupuesto finalizado ─────────────────────────────────────────────────────
  r.get('/:id/pdf', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    const { rows } = await query<{ storage_key: string }>(
      'SELECT f.storage_key FROM quote_documents d JOIN files f ON f.id = d.pdf_file_id WHERE d.quote_id = $1', [q.id]);
    res.attachment(`${q.number}.pdf`).type('application/pdf').sendFile(pathOf(rows[0]!.storage_key));
  });

  r.get('/:id/share', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    res.json({ public_url: publicUrl(await activeToken(q.id)), qr_url: `/quotes/${q.id}/qr.png` });
  });

  // El QR es un acceso de consulta: apunta a la vista pública y no da permisos de edición.
  r.get('/:id/qr.png', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    res.type('image/png').send(await QRCode.toBuffer(publicUrl(await activeToken(q.id)), { margin: 2, width: 512 }));
  });

  const mailLimit = rateLimit({
    windowMs: 3_600_000, limit: deps.mailLimit ?? 10, standardHeaders: false, legacyHeaders: false,
    keyGenerator: (req) => session(req as Request).userId, // por usuario (Contrato API §1)
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Demasiados correos enviados. Intenta más tarde.', undefined, { 'Retry-After': '3600' })),
  });

  r.post('/:id/send-email', allow('USER', 'QUOTE_CODE'), mailLimit, async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    const b = parse(z.strictObject({ to: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional(), message: z.string().trim().max(2000).optional() }), req.body);
    const { rows: c } = await query<{ name: string; email: string | null }>('SELECT name, email FROM customers WHERE id = $1 AND user_id = $2', [q.customer_id, q.user_id]);
    const to = b.to ?? c[0]!.email;
    if (!to) throw new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'to', message: 'El cliente no tiene correo: indica uno' }]);
    const { rows: doc } = await query<{ storage_key: string; snapshot: Snapshot }>(
      'SELECT f.storage_key, d.snapshot FROM quote_documents d JOIN files f ON f.id = d.pdf_file_id WHERE d.quote_id = $1', [q.id]);
    const url = publicUrl(await activeToken(q.id));
    const s = doc[0]!.snapshot;
    await deps.sendMail({
      to,
      subject: `Presupuesto ${s.number} de ${s.professional.name}`,
      text: `${b.message ?? `Hola ${s.customer.name}, te adjunto el presupuesto ${s.number}.`}\n\nTambién puedes verlo en línea: ${url}\n\n${s.professional.name} · ${s.professional.phone}`,
      attachment: { filename: `${s.number}.pdf`, content: await readFile(pathOf(doc[0]!.storage_key)) },
    });
    await registerSend(req, q, 'EMAIL'); // solo si el envío salió bien
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // WhatsApp y compartir ocurren en el teléfono: el cliente avisa DESPUÉS de que el usuario confirma.
  r.post('/:id/mark-sent', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    const b = parse(z.strictObject({ channel: z.enum(['WHATSAPP', 'SHARE', 'LINK']) }), req.body);
    await registerSend(req, q, b.channel);
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });
}
