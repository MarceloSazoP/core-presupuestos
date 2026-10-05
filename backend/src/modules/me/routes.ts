import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { AppError, notFound } from '../../errors';
import { upload, uploaded } from '../../http/upload';
import { parse } from '../../http/validate';
import { IMAGES } from '../../lib/filetype';
import { discardUpload, removeMany, storeFile, type FileKind } from '../../lib/files';
import { audit } from '../../lib/audit';
import type { SendMail } from '../../lib/mail';
import { pathOf } from '../../lib/storage';
import { enviarQrRecuperacion } from '../auth/recuperacion';
import { maskDestination } from '../../lib/deliver';
import { PAISES, zonaValida } from '../../lib/paises';
import { email, name, phone } from '../auth/schemas';

type Row = { id: string; name: string; phone: string; email: string; country: string; timezone: string; contact_phone: string | null; contact_email: string | null; logo_file_id: string | null; signature_file_id: string | null; use_logo: boolean; include_signature: boolean };

const perfil = (u: Row) => ({
  id: u.id, name: u.name, phone: u.phone, email: u.email, country: u.country, timezone: u.timezone, contact_phone: u.contact_phone, contact_email: u.contact_email,
  has_logo: u.logo_file_id !== null, has_signature: u.signature_file_id !== null, use_logo: u.use_logo, include_signature: u.include_signature,
  // cambian con cada imagen nueva: las apps los usan en la dirección de la imagen para no mostrar una guardada en caché
  logo_id: u.logo_file_id, signature_id: u.signature_file_id,
});

const COLS = 'id, name, phone, email, country, timezone, contact_phone, contact_email, logo_file_id, signature_file_id, use_logo, include_signature';
const uid = (req: unknown) => (req as AuthedRequest).session.userId;
const MB = 1024 * 1024;

// Cambia el archivo de una ranura (logo o firma) y devuelve la clave del anterior para borrarlo del disco.
// `column` es siempre una de las dos constantes de abajo, nunca texto del cliente.
async function setSlot(c: PoolClient, userId: string, column: 'logo_file_id' | 'signature_file_id', newId: string | null): Promise<string | null> {
  const old = (await c.query<{ id: string | null }>(`SELECT ${column} AS id FROM users WHERE id = $1 FOR UPDATE`, [userId])).rows[0]!.id;
  // Subir una imagen enciende su interruptor (quien sube un logo quiere usarlo); borrarla lo deja como está.
  const flag = column === 'logo_file_id' ? 'use_logo' : 'include_signature';
  await c.query(`UPDATE users SET ${column} = $2, ${flag} = CASE WHEN $2::uuid IS NOT NULL THEN true ELSE ${flag} END, updated_at = now() WHERE id = $1`, [userId, newId]);
  if (!old) return null;
  // Un presupuesto ya finalizado conserva su logo y su firma (el snapshot es inmutable): si alguno los usa, el archivo se queda.
  return (await c.query<{ storage_key: string }>(
    `DELETE FROM files f WHERE f.id = $1 AND f.user_id = $2
       AND NOT EXISTS (SELECT 1 FROM quote_documents d WHERE d.snapshot->'professional'->>'logo_file_id' = f.id::text OR d.snapshot->'professional'->>'signature_file_id' = f.id::text)
     RETURNING f.storage_key`, [old, userId])).rows[0]?.storage_key ?? null;
}

export const meRoutes = (sendMail?: SendMail) => {
  const r = Router();
  r.use(requireSession, requireUser);

  const profile = async (userId: string) => perfil((await query<Row>(`SELECT ${COLS} FROM users WHERE id = $1`, [userId])).rows[0]!);

  r.get('/', async (req, res) => {
    res.json(await profile(uid(req)));
  });

  // Nombre y datos de contacto que salen en los presupuestos. El teléfono y el correo de la CUENTA no se cambian en el MVP
  // (Contrato API §4); `.strict()` rechaza cualquier otro campo. Lo no enviado se conserva y `null` borra el contacto propio.
  r.put('/', async (req, res) => {
    const body = parse(
      z.strictObject({ name, country: z.enum(PAISES.map((p) => p.country) as [string, ...string[]]), timezone: z.string().refine(zonaValida, 'Zona horaria no válida (por ejemplo America/Lima)'), contact_phone: phone.nullable(), contact_email: email.nullable(), use_logo: z.boolean(), include_signature: z.boolean() }).partial().refine((b) => Object.keys(b).length > 0, { message: 'Envía al menos un campo' }),
      req.body,
    );
    await query(
      `UPDATE users SET name = CASE WHEN $2 THEN $3 ELSE name END,
                        contact_phone = CASE WHEN $4 THEN $5 ELSE contact_phone END,
                        contact_email = CASE WHEN $6 THEN $7 ELSE contact_email END,
                        include_signature = CASE WHEN $8 THEN $9 ELSE include_signature END,
                        use_logo = CASE WHEN $10 THEN $11 ELSE use_logo END,
                        country = CASE WHEN $12 THEN $13 ELSE country END,
                        timezone = CASE WHEN $14 THEN $15 ELSE timezone END,
                        updated_at = now() WHERE id = $1`,
      [uid(req), 'name' in body, body.name ?? null, 'contact_phone' in body, body.contact_phone ?? null, 'contact_email' in body, body.contact_email ?? null, 'include_signature' in body, body.include_signature ?? false, 'use_logo' in body, body.use_logo ?? false, 'country' in body, body.country ?? null, 'timezone' in body, body.timezone ?? null],
    );
    res.json(await profile(uid(req)));
  });

  // Un QR de recuperación nuevo, al correo de la cuenta (Recuperación de cuenta con QR.md). Invalida el anterior. 3 por hora y usuario.
  r.post('/recovery-qr', async (req, res) => {
    if (!sendMail) throw new AppError(502, 'DELIVERY_FAILED', 'El envío por correo no está configurado.');
    const { rows } = await query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_events WHERE user_id = $1 AND event = 'RECOVERY_QR_SENT' AND created_at > now() - interval '1 hour'`, [uid(req)]);
    if (rows[0]!.n >= 3) throw new AppError(429, 'RATE_LIMITED', 'Ya pediste varios QR. Intenta de nuevo más tarde.', undefined, { 'Retry-After': '3600' });
    const { email } = await enviarQrRecuperacion(uid(req), sendMail, 'pedido');
    await audit(req, 'RECOVERY_QR_SENT', { userId: uid(req), metadata: { motivo: 'pedido' } });
    res.status(202).json({ destination_masked: maskDestination('EMAIL', email) });
  });

  // Logo y firma: PNG/JPEG ≤ 2 MB; reemplazan al anterior.
  for (const [path, column, kind] of [
    ['logo', 'logo_file_id', 'LOGO'],
    ['signature', 'signature_file_id', 'SIGNATURE'],
  ] as const satisfies readonly [string, 'logo_file_id' | 'signature_file_id', FileKind][]) {
    r.put(`/${path}`, upload(2 * MB, IMAGES), async (req, res) => {
      const up = uploaded(req);
      try {
        const oldKey = await storeFile({ userId: uid(req), quoteId: null, kind, up }, (c, fileId) => setSlot(c, uid(req), column, fileId));
        if (oldKey) await removeMany([oldKey]);
        res.json(await profile(uid(req)));
      } finally {
        await discardUpload(up);
      }
    });
    // Descarga del propio logo o firma (para mostrarlos en «Configurar»). `column` es una de las dos constantes de arriba.
    r.get(`/${path}`, async (req, res) => {
      const f = (await query<{ storage_key: string; mime_type: string }>(`SELECT f.storage_key, f.mime_type FROM files f JOIN users u ON u.${column} = f.id WHERE u.id = $1`, [uid(req)])).rows[0];
      if (!f) throw notFound();
      res.type(f.mime_type).sendFile(pathOf(f.storage_key));
    });
    r.delete(`/${path}`, async (req, res) => {
      const oldKey = await withTx((c) => setSlot(c, uid(req), column, null));
      if (oldKey) await removeMany([oldKey]);
      res.status(204).end();
    });
  }

  return r;
};
