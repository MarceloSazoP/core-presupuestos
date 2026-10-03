import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { Request, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError } from '../errors';
import { detectFile, type Detected } from '../lib/filetype';
import { ensureTmp, tmpDir } from '../lib/storage';

export type Uploaded = { tempPath: string; size: number; type: Detected };

// multer escribe a STORAGE_DIR/tmp con el límite del recurso y un nombre aleatorio (el del cliente se descarta).
export function upload(maxBytes: number, allowed: string[]): RequestHandler {
  const m = multer({
    storage: multer.diskStorage({ destination: (_r, _f, cb) => void ensureTmp().then(() => cb(null, tmpDir())), filename: (_r, _f, cb) => cb(null, randomUUID()) }),
    limits: { fileSize: maxBytes, files: 1, fields: 5, fieldSize: 1000 },
  }).single('file');

  return (req, res, next) => {
    m(req, res, async (err: unknown) => {
      const tmp = (req as Request).file?.path;
      const fail = async (e: AppError) => {
        if (tmp) await rm(tmp, { force: true });
        next(e);
      };
      if (err instanceof MulterError) {
        return fail(err.code === 'LIMIT_FILE_SIZE'
          ? new AppError(413, 'FILE_TOO_LARGE', 'El archivo supera el límite permitido')
          : new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: err.field ?? 'file', message: 'Campo de archivo no esperado' }]));
      }
      if (err) return next(err);
      if (!req.file) return fail(new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'file', message: 'Falta el archivo' }]));
      const type = await detectFile(req.file.path);
      if (!type || !allowed.includes(type.mime)) return fail(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Tipo de archivo no admitido'));
      (req as Request & { uploaded: Uploaded }).uploaded = { tempPath: req.file.path, size: req.file.size, type };
      next();
    });
  };
}

export const uploaded = (req: Request) => (req as Request & { uploaded: Uploaded }).uploaded;
