import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { notFound } from '../../errors';
import { requireSession } from '../../http/session';
import { pathOf } from '../../lib/storage';
import { session } from '../quotes/guard';

// Descarga autenticada (Contrato API §6). Un usuario solo ve lo suyo; una sesión QUOTE_CODE, solo los archivos de su
// presupuesto. Ajeno o inexistente ⇒ 404. El tipo sale de la BD, nunca del nombre del archivo.
export const fileRoutes = () => {
  const r = Router();
  r.use(requireSession);
  r.get('/:id', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw notFound();
    const s = session(req);
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
      `SELECT storage_key, mime_type FROM files WHERE id = $1 AND user_id = $2 AND ($3::uuid IS NULL OR quote_id = $3)`,
      [id.data, s.userId, s.scope === 'QUOTE_CODE' ? s.quoteId : null]);
    if (!rows[0]) throw notFound();
    res.type(rows[0].mime_type).sendFile(pathOf(rows[0].storage_key), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
  return r;
};
