import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { upload, uploaded } from '../../http/upload';
import { parse } from '../../http/validate';
import { IMAGES } from '../../lib/filetype';
import { discardUpload, removeMany, storeFile, type FileKind } from '../../lib/files';
import { name } from '../auth/schemas';

type Row = { id: string; name: string; phone: string; email: string; logo_file_id: string | null; signature_file_id: string | null };

const perfil = (u: Row) => ({
  id: u.id, name: u.name, phone: u.phone, email: u.email,
  has_logo: u.logo_file_id !== null, has_signature: u.signature_file_id !== null,
});

const COLS = 'id, name, phone, email, logo_file_id, signature_file_id';
const uid = (req: unknown) => (req as AuthedRequest).session.userId;
const MB = 1024 * 1024;

// Cambia el archivo de una ranura (logo o firma) y devuelve la clave del anterior para borrarlo del disco.
// `column` es siempre una de las dos constantes de abajo, nunca texto del cliente.
async function setSlot(c: PoolClient, userId: string, column: 'logo_file_id' | 'signature_file_id', newId: string | null): Promise<string | null> {
  const old = (await c.query<{ id: string | null }>(`SELECT ${column} AS id FROM users WHERE id = $1 FOR UPDATE`, [userId])).rows[0]!.id;
  await c.query(`UPDATE users SET ${column} = $2, updated_at = now() WHERE id = $1`, [userId, newId]);
  if (!old) return null;
  return (await c.query<{ storage_key: string }>('DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING storage_key', [old, userId])).rows[0]?.storage_key ?? null;
}

export const meRoutes = () => {
  const r = Router();
  r.use(requireSession, requireUser);

  const profile = async (userId: string) => perfil((await query<Row>(`SELECT ${COLS} FROM users WHERE id = $1`, [userId])).rows[0]!);

  r.get('/', async (req, res) => {
    res.json(await profile(uid(req)));
  });

  // El teléfono y el correo no se cambian en el MVP (Contrato API §4); `.strict()` rechaza cualquier otro campo.
  r.put('/', async (req, res) => {
    const body = parse(z.strictObject({ name }), req.body);
    await query('UPDATE users SET name = $2, updated_at = now() WHERE id = $1', [uid(req), body.name]);
    res.json(await profile(uid(req)));
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
    r.delete(`/${path}`, async (req, res) => {
      const oldKey = await withTx((c) => setSlot(c, uid(req), column, null));
      if (oldKey) await removeMany([oldKey]);
      res.status(204).end();
    });
  }

  return r;
};
