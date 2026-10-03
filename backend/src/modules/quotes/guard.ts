import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { AppError, notFound } from '../../errors';
import type { AuthedRequest, Session } from '../../http/session';
import type { QuoteRow } from './serialize';

export const session = (req: Request) => (req as AuthedRequest).session;
const isUuid = (v: unknown): v is string => z.uuid().safeParse(v).success;

// Qué sesiones pueden usar cada ruta (Contrato API §9 y §13).
export const allow = (...scopes: Session['scope'][]): RequestHandler => (req, _res, next) => {
  if (!scopes.includes(session(req).scope)) throw new AppError(403, 'INSUFFICIENT_SCOPE', 'Esta sesión no permite esa operación');
  next();
};

// Único punto de entrada por presupuesto (Arquitectura §3, regla 1): filtra por el dueño y, si la sesión es
// QUOTE_CODE, exige que sea justamente su presupuesto. Ajeno o inexistente ⇒ 404.
export async function loadQuote(req: Request, id: unknown): Promise<QuoteRow> {
  const s = session(req);
  if (!isUuid(id)) throw notFound();
  const { rows } = await query<QuoteRow>(
    `SELECT * FROM quotes WHERE id = $1 AND user_id = $2 AND ($3::uuid IS NULL OR id = $3)`,
    [id, s.userId, s.scope === 'QUOTE_CODE' ? s.quoteId : null],
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

export const editable = (q: QuoteRow) => {
  if (q.doc_status === 'FINALIZED') throw new AppError(409, 'INVALID_STATE', 'El presupuesto ya está finalizado y no se puede editar');
};

// Para las rutas de subida: autoriza y comprueba el estado ANTES de aceptar un archivo grande.
export async function guardEditable(req: Request, res: Response, next: NextFunction) {
  const q = await loadQuote(req, req.params.id);
  editable(q);
  res.locals.quote = q;
  next();
}
