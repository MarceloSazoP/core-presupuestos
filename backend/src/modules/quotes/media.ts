import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { AppError, notFound } from '../../errors';
import { upload, uploaded } from '../../http/upload';
import { parse } from '../../http/validate';
import { AUDIO, IMAGES } from '../../lib/filetype';
import { discardUpload, removeMany, storeFile } from '../../lib/files';
import { allow, guardEditable } from './guard';
import type { QuoteRow } from './serialize';

const MB = 1024 * 1024;
const MAX_PHOTOS = 30;
const MAX_VOICE = 5;

const limitError = (message: string) => new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'file', message }]);
const quoteOf = (res: Response) => res.locals.quote as QuoteRow;

const PhotoBody = z.strictObject({ id: z.uuid().optional(), caption: z.string().trim().max(200, 'Máximo 200 caracteres').optional() });
const VoiceBody = z.strictObject({ id: z.uuid().optional(), duration_seconds: z.coerce.number().int().min(1).max(300) });

// Idempotencia por `id`: mismo usuario, presupuesto y tipo ⇒ ya existe (200); de otro ⇒ 409.
async function alreadyExists(q: QuoteRow, id: string | undefined, kind: 'PHOTO' | 'VOICE') {
  if (!id) return false;
  const { rows } = await query<{ user_id: string; quote_id: string | null; kind: string }>('SELECT user_id, quote_id, kind FROM files WHERE id = $1', [id]);
  const f = rows[0];
  if (!f) return false;
  if (f.user_id !== q.user_id || f.quote_id !== q.id || f.kind !== kind) throw new AppError(409, 'ID_CONFLICT', 'El id ya existe');
  return true;
}

// Fotos y notas de voz del levantamiento (Contrato API §6, Etapa 2). La subida va DESPUÉS de autorizar y de
// comprobar el estado, para no recibir archivos de quien no puede escribir.
export function addMediaRoutes(r: Router) {
  r.post('/:id/photos', allow('USER', 'QUOTE_CODE'), guardEditable, upload(10 * MB, IMAGES), async (req, res) => {
    const up = uploaded(req);
    try {
      const q = quoteOf(res);
      const b = parse(PhotoBody, { ...req.body });
      if (await alreadyExists(q, b.id, 'PHOTO')) {
        const { rows } = await query('SELECT file_id AS id, caption, created_at FROM survey_photos WHERE file_id = $1', [b.id]);
        res.status(200).json({ ...rows[0], url: `/files/${b.id}` });
        return;
      }
      const photo = await storeFile({ userId: q.user_id, quoteId: q.id, kind: 'PHOTO', id: b.id, up }, async (c, fileId) => {
        await c.query('SELECT 1 FROM quotes WHERE id = $1 FOR UPDATE', [q.id]); // serializa subidas simultáneas
        const n = (await c.query<{ n: number }>('SELECT count(*)::int AS n FROM survey_photos WHERE quote_id = $1', [q.id])).rows[0]!.n;
        if (n >= MAX_PHOTOS) throw limitError(`Máximo ${MAX_PHOTOS} fotos por presupuesto`);
        const { rows } = await c.query('INSERT INTO survey_photos (quote_id, file_id, caption, position) VALUES ($1, $2, $3, $4) RETURNING file_id AS id, caption, created_at', [q.id, fileId, b.caption ?? null, n]);
        await c.query('UPDATE quotes SET updated_at = now() WHERE id = $1', [q.id]);
        return rows[0];
      });
      res.status(201).json({ ...photo, url: `/files/${photo.id}` });
    } finally {
      await discardUpload(up); // si ya se movió a su ruta final, no hay nada que borrar
    }
  });

  r.post('/:id/voice-notes', allow('USER', 'QUOTE_CODE'), guardEditable, upload(10 * MB, AUDIO), async (req, res) => {
    const up = uploaded(req);
    try {
      const q = quoteOf(res);
      const b = parse(VoiceBody, { ...req.body });
      if (await alreadyExists(q, b.id, 'VOICE')) {
        const { rows } = await query('SELECT file_id AS id, duration_seconds, created_at FROM survey_voice_notes WHERE file_id = $1', [b.id]);
        res.status(200).json({ ...rows[0], url: `/files/${b.id}` });
        return;
      }
      const note = await storeFile({ userId: q.user_id, quoteId: q.id, kind: 'VOICE', id: b.id, up }, async (c, fileId) => {
        await c.query('SELECT 1 FROM quotes WHERE id = $1 FOR UPDATE', [q.id]);
        const n = (await c.query<{ n: number }>('SELECT count(*)::int AS n FROM survey_voice_notes WHERE quote_id = $1', [q.id])).rows[0]!.n;
        if (n >= MAX_VOICE) throw limitError(`Máximo ${MAX_VOICE} notas de voz por presupuesto`);
        const { rows } = await c.query('INSERT INTO survey_voice_notes (quote_id, file_id, duration_seconds) VALUES ($1, $2, $3) RETURNING file_id AS id, duration_seconds, created_at', [q.id, fileId, b.duration_seconds]);
        await c.query('UPDATE quotes SET updated_at = now() WHERE id = $1', [q.id]);
        return rows[0];
      });
      res.status(201).json({ ...note, url: `/files/${note.id}` });
    } finally {
      await discardUpload(up);
    }
  });

  // Borrar: la fila de `files` se elimina junto con la de la foto/nota (cascada); después se borra el archivo del disco.
  const del = (table: 'survey_photos' | 'survey_voice_notes', param: 'photoId' | 'noteId') => async (req: Request, res: Response) => {
    const q = quoteOf(res);
    const id = z.uuid().safeParse(req.params[param]);
    if (!id.success) throw notFound();
    const key = await withTx(async (c) => {
      const { rows } = await c.query<{ storage_key: string }>(
        `DELETE FROM files f USING ${table} t WHERE t.file_id = f.id AND f.id = $1 AND t.quote_id = $2 RETURNING f.storage_key`, [id.data, q.id]);
      if (!rows[0]) throw notFound();
      await c.query('UPDATE quotes SET updated_at = now() WHERE id = $1', [q.id]);
      return rows[0].storage_key;
    });
    await removeMany([key]);
    res.status(204).end();
  };
  r.delete('/:id/photos/:photoId', allow('USER', 'QUOTE_CODE'), guardEditable, del('survey_photos', 'photoId'));
  r.delete('/:id/voice-notes/:noteId', allow('USER', 'QUOTE_CODE'), guardEditable, del('survey_voice_notes', 'noteId'));
}
