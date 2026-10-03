import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export type Detail = { field: string; message: string };

// Formato de error del Contrato de API §1.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Detail[],
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'No autenticado');
export const notFound = () => new AppError(404, 'NOT_FOUND', 'No encontrado');

export const zodDetails = (e: ZodError): Detail[] =>
  e.issues.map((i) => ({ field: i.path.join('.') || '(cuerpo)', message: i.message }));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    if (err.headers) res.set(err.headers);
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'Datos inválidos', details: zodDetails(err) } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Cuerpo mal formado' } });
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Cuerpo demasiado grande' } });
    return;
  }
  console.error(err); // nunca se expone al cliente
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno' } });
};
