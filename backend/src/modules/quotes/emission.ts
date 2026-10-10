import { randomBytes, randomUUID } from 'node:crypto';
import { correoPresupuesto, textoPresupuesto } from '../../lib/correo-presupuesto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Request, Response, Router } from 'express';
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
import { ensureTmp, keyFor, put, read, remove, send, tmpDir } from '../../lib/storage';
import { allow, editable, loadQuote, session } from './guard';
import { quoteDetail, type QuoteRow } from './serialize';

export const publicUrl = (token: string) => `${config.WEB_BASE_URL}/q/${token}`;

type ItemRow = { kind: 'ITEM' | 'TASK'; description: string; quantity: number; unit: string; unit_price: number; line_total: number };
type UserRow = { name: string; phone: string; email: string; logo_file_id: string | null; signature_file_id: string | null; use_logo: boolean; include_signature: boolean; timezone: string };

// Lo que exige `finalize` (Contrato API §7). Devuelve todos los problemas juntos, no solo el primero.
function problems(q: QuoteRow, items: ItemRow[], user: UserRow): Detail[] {
  const d: Detail[] = [];
  if (!q.service_description?.trim()) d.push({ field: 'service_description', message: 'Describe el servicio' });
  if (items.length === 0) d.push({ field: 'items', message: 'Agrega al menos un ítem' });
  if (q.discount > q.subtotal) d.push({ field: 'discount', message: 'El descuento no puede superar el subtotal' });
  if (q.validity_days == null) d.push({ field: 'validity_days', message: 'Define la validez del presupuesto' });
  if (q.warranty_kind === 'CUSTOM' && !q.warranty_text) d.push({ field: 'warranty.text', message: 'Escribe la garantía' });
  return d;
}

export async function readImage(fileId: string | null): Promise<Image | undefined> {
  if (!fileId) return undefined;
  const { rows } = await query<{ storage_key: string; mime_type: string }>('SELECT storage_key, mime_type FROM files WHERE id = $1', [fileId]);
  return rows[0] ? { data: await read(rows[0].storage_key), mime: rows[0].mime_type } : undefined;
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

// El PDF de un presupuesto terminado. Mientras esté aceptado (por el cliente o a mano) se genera desde el snapshot con el timbre
// «ACEPTADO» y la fecha; si no, es el que se guardó al terminar, que nunca cambia (Contrato API §10).
export async function pdfDelPresupuesto(quoteId: string): Promise<{ number: string; storageKey: string; aceptado: Buffer | null }> {
  const { rows } = await query<{ storage_key: string; snapshot: Snapshot; aceptado: string | null; token: string | null }>(
    `SELECT f.storage_key, d.snapshot,
            CASE WHEN q.commercial_status = 'ACCEPTED'
                 THEN to_char(COALESCE(q.accepted_at, now()) AT TIME ZONE COALESCE(d.snapshot->>'timezone', 'America/Santiago'), 'DD-MM-YYYY') END AS aceptado,
            (SELECT a.token FROM quote_access a WHERE a.quote_id = q.id AND a.kind = 'PUBLIC' AND a.revoked_at IS NULL) AS token
       FROM quotes q JOIN quote_documents d ON d.quote_id = q.id JOIN files f ON f.id = d.pdf_file_id
      WHERE q.id = $1`, [quoteId]);
  const { storage_key, snapshot: s, aceptado, token } = rows[0]!;
  if (!aceptado) return { number: s.number, storageKey: storage_key, aceptado: null };
  const pdf = await buildPdf(s, {
    logo: await readImage(s.professional.logo_file_id),
    signature: s.include_signature ? await readImage(s.professional.signature_file_id) : undefined,
    qr: s.include_qr && token ? await QRCode.toBuffer(publicUrl(token), { margin: 1, width: 300 }) : undefined,
    aceptado,
  });
  return { number: s.number, storageKey: storage_key, aceptado: pdf };
}

// Descargar ese PDF: el aceptado se entrega entero; el guardado, desde el almacenamiento (admite rangos).
export async function enviarPdf(req: Request, res: Response, quoteId: string) {
  const p = await pdfDelPresupuesto(quoteId);
  if (p.aceptado) return void res.attachment(`${p.number}-aceptado.pdf`).type('application/pdf').send(p.aceptado);
  await send(req, res.attachment(`${p.number}.pdf`).type('application/pdf'), p.storageKey);
}

// Lo que se imprime, a partir de lo guardado. Lo comparten terminar (queda fijado) y la vista previa (no se guarda).
function makeSnapshot(q: QuoteRow, items: ItemRow[], u: UserRow, customerName: string, o: { number: string; previousNumber: string | null; at: Date; validUntil: string; issuedOn: string; timezone: string }): Snapshot {
  return {
    number: o.number, version: q.version, previous_number: o.previousNumber, finalized_at: o.at.toISOString(), issued_on: o.issuedOn, valid_until: o.validUntil,
    timezone: o.timezone, country: q.country, currency: q.currency, vat_label: q.vat_label,
    professional: { name: u.name, phone: u.phone, email: u.email, logo_file_id: u.use_logo ? u.logo_file_id : null, signature_file_id: u.include_signature ? u.signature_file_id : null },
    customer: { name: customerName },
    service_description: (q.service_description ?? '').trim() || '(sin descripción)', service_address: q.address,
    items: items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, line_total: i.line_total })),
    subtotal: q.subtotal, discount: q.discount, include_vat: q.include_vat, vat: q.vat, vat_rate: q.vat_rate, total: q.total,
    warranty: { kind: q.warranty_kind, text: warrantyText(q.warranty_kind, q.warranty_text) },
    validity_days: q.validity_days ?? 15, observations: q.observations, include_signature: u.include_signature, include_qr: q.include_qr, // la firma sigue al perfil de este momento
  };
}

export function addEmissionRoutes(r: Router, deps: { sendMail: SendMail; mailLimit?: number }) {
  // ── Finalizar: snapshot + PDF + QR + enlace público, todo o nada ─────────────────────────────
  r.post('/:id/finalize', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q0 = await loadQuote(req, req.params.id);
    editable(q0);
    const [items, user, customer] = await Promise.all([
      query<ItemRow>('SELECT kind, description, quantity, unit, unit_price, line_total FROM quote_items WHERE quote_id = $1 ORDER BY position', [q0.id]),
      query<UserRow>('SELECT name, COALESCE(contact_phone, phone) AS phone, COALESCE(contact_email, email) AS email, logo_file_id, signature_file_id, use_logo, include_signature, timezone FROM users WHERE id = $1', [q0.user_id]),
      query<{ name: string }>('SELECT name FROM customers WHERE id = $1 AND user_id = $2', [q0.customer_id, q0.user_id]),
    ]);
    const bad = problems(q0, items.rows, user.rows[0]!);
    if (bad.length) throw new AppError(422, 'VALIDATION_FAILED', 'El presupuesto está incompleto', bad);

    const previousNumber = q0.parent_quote_id ? ((await query<{ number: string }>('SELECT number FROM quotes WHERE id = $1', [q0.parent_quote_id])).rows[0]?.number ?? null) : null;
    const fileId = randomUUID();
    const key = keyFor(q0.user_id, q0.id, fileId, 'pdf');
    let written = false;
    try {
      await withTx(async (c) => {
        // Bloqueo de la fila: dos "terminar" simultáneos no numeran dos veces; el segundo ve FINALIZED y recibe 409.
        const { rows: lock } = await c.query<QuoteRow>('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [q0.id]);
        editable(lock[0]!);
        const q = lock[0]!;
        const zona = user.rows[0]!.timezone; // la del teléfono de quien emite (Internacionalización.md §3.4)
        const { rows: t } = await c.query<{ ts: Date; valid_until: string; issued_on: string; year: number }>(
          `SELECT now() AS ts, ((now() AT TIME ZONE $2::text)::date + $1::int)::text AS valid_until,
                  (now() AT TIME ZONE $2::text)::date::text AS issued_on,
                  extract(year FROM now() AT TIME ZONE $2::text)::int AS year`, [q.validity_days, zona]);
        // Numeración atómica CP-AAAA-NNNN por usuario y año (Arquitectura §3, regla 5).
        const { rows: n } = await c.query<{ last_number: number }>(
          `INSERT INTO quote_counters (user_id, year, last_number) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, year) DO UPDATE SET last_number = quote_counters.last_number + 1 RETURNING last_number`, [q.user_id, t[0]!.year]);
        const number = `CP-${t[0]!.year}-${String(n[0]!.last_number).padStart(4, '0')}`;

        const u = user.rows[0]!;
        const snapshot = makeSnapshot(q, items.rows, u, customer.rows[0]!.name, { number, previousNumber, at: t[0]!.ts, validUntil: t[0]!.valid_until, issuedOn: t[0]!.issued_on, timezone: zona });

        const token = randomBytes(24).toString('base64url'); // 192 bits
        const qrBuffer = q.include_qr ? await QRCode.toBuffer(publicUrl(token), { margin: 1, width: 300 }).catch((e: unknown) => {
          console.error('QR error:', e);
          throw new AppError(500, 'QR_GENERATION_FAILED', 'No pudimos generar el QR', undefined, { error: String(e) });
        }) : undefined;
        const pdf = await buildPdf(snapshot, {
          logo: u.use_logo ? await readImage(u.logo_file_id) : undefined,
          signature: u.include_signature ? await readImage(u.signature_file_id) : undefined,
          qr: qrBuffer,
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

  // Vista previa del borrador (Contrato API §7): el PDF con lo guardado hoy, sin numerar ni fijar nada.
  r.get('/:id/preview', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    const [items, user, customer, fecha] = await Promise.all([
      query<ItemRow>('SELECT kind, description, quantity, unit, unit_price, line_total FROM quote_items WHERE quote_id = $1 ORDER BY position', [q.id]),
      query<UserRow>('SELECT name, COALESCE(contact_phone, phone) AS phone, COALESCE(contact_email, email) AS email, logo_file_id, signature_file_id, use_logo, include_signature, timezone FROM users WHERE id = $1', [q.user_id]),
      query<{ name: string }>('SELECT name FROM customers WHERE id = $1 AND user_id = $2', [q.customer_id, q.user_id]),
      query<{ ts: Date; valid_until: string; issued_on: string }>(
        `SELECT now() AS ts, ((now() AT TIME ZONE u.timezone)::date + $1::int)::text AS valid_until, (now() AT TIME ZONE u.timezone)::date::text AS issued_on FROM users u WHERE u.id = $2`, [q.validity_days ?? 15, q.user_id]),
    ]);
    const u = user.rows[0]!;
    const snapshot = makeSnapshot(q, items.rows, u, customer.rows[0]!.name, { number: 'Borrador', previousNumber: null, at: fecha.rows[0]!.ts, validUntil: fecha.rows[0]!.valid_until, issuedOn: fecha.rows[0]!.issued_on, timezone: u.timezone });
    const pdf = await buildPdf({ ...snapshot, include_qr: false }, {
      logo: u.use_logo ? await readImage(u.logo_file_id) : undefined,
      signature: u.include_signature ? await readImage(u.signature_file_id) : undefined,
      preview: true,
    });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="vista-previa.pdf"', 'Content-Length': String(pdf.length) }).end(pdf);
  });

  // Logo de quien emite: el actual mientras se edita, y el que quedó fijado en el snapshot una vez finalizado.
  r.get('/:id/logo', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
      `SELECT f.storage_key, f.mime_type FROM files f
        WHERE f.id = CASE WHEN $2 THEN (SELECT (snapshot->'professional'->>'logo_file_id')::uuid FROM quote_documents WHERE quote_id = $1)
                          ELSE (SELECT CASE WHEN use_logo THEN logo_file_id END FROM users WHERE id = $3) END`,
      [q.id, q.doc_status === 'FINALIZED', q.user_id]);
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No encontrado');
    await send(req, res.type(rows[0].mime_type), rows[0].storage_key);
  });

  // ── Salidas de un presupuesto finalizado ─────────────────────────────────────────────────────
  r.get('/:id/pdf', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    finalizedOnly(q);
    await enviarPdf(req, res, q.id);
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
    const { rows: doc } = await query<{ snapshot: Snapshot }>('SELECT snapshot FROM quote_documents WHERE quote_id = $1', [q.id]);
    const url = publicUrl(await activeToken(q.id));
    const s = doc[0]!.snapshot;
    // Sin PDF (es el documento oficial: el cliente lo recibe al aceptar, Contrato API §7). Si ya está aceptado, va sin el botón de
    // aceptar y con el PDF timbrado.
    const pdf = await pdfDelPresupuesto(q.id);
    const estado = pdf.aceptado ? 'aceptado' : q.commercial_status === 'REJECTED' ? 'cerrado' : 'aceptable';
    const logo = await readImage(s.professional.logo_file_id); // el del snapshot: el que lleva el presupuesto
    await deps.sendMail({
      to,
      subject: `Presupuesto ${s.number} de ${s.professional.name}`,
      text: textoPresupuesto(s, url, b.message, estado),
      html: correoPresupuesto(s, url, b.message, estado, !!logo),
      logo: logo && { content: logo.data, contentType: logo.mime },
      attachment: pdf.aceptado ? { filename: `${s.number}-aceptado.pdf`, content: pdf.aceptado } : undefined,
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
