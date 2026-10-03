import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { PoolClient } from 'pg';
import { withTx } from '../db';
import type { Uploaded } from '../http/upload';
import { keyFor, put, remove, removeMany } from './storage';

export type FileKind = 'LOGO' | 'SIGNATURE' | 'PHOTO' | 'VOICE' | 'PDF';

// Guarda el archivo y sus filas en el orden de la Arquitectura §3: mover a su ruta final → transacción → si falla,
// borrar el archivo. `rows` recibe el cliente de la transacción y el `fileId` ya insertado en `files`.
export async function storeFile<T>(
  o: { userId: string; quoteId: string | null; kind: FileKind; id?: string; up: Uploaded },
  rows: (c: PoolClient, fileId: string) => Promise<T>,
): Promise<T> {
  const fileId = o.id ?? randomUUID();
  const key = keyFor(o.userId, o.quoteId, fileId, o.up.type.ext);
  await put(key, o.up.tempPath);
  try {
    return await withTx(async (c) => {
      await c.query('INSERT INTO files (id, user_id, quote_id, kind, storage_key, mime_type, size_bytes) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        fileId, o.userId, o.quoteId, o.kind, key, o.up.type.mime, o.up.size,
      ]);
      return rows(c, fileId);
    });
  } catch (e) {
    await remove(key).catch(() => {});
    throw e;
  }
}

export const discardUpload = (up: Uploaded | undefined) => (up ? rm(up.tempPath, { force: true }) : Promise.resolve());
export { removeMany };
