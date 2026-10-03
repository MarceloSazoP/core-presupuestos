import type { NextFunction, Request, Response } from 'express';
import { query } from '../db';
import { AppError, unauthenticated } from '../errors';
import { sha256 } from '../lib/crypto';

export type Session = { id: string; userId: string; scope: 'USER' | 'QUOTE_CODE'; quoteId: string | null };
export type AuthedRequest = Request & { session: Session };

export const SESSION_DAYS = 90; // móviles (Contrato API §15, n.º 1)

// Sesión por `Authorization: Bearer`, nunca por cookie (Arquitectura §1): sin cookies no hay CSRF contra la API.
export async function requireSession(req: Request, _res: Response, next: NextFunction) {
  const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw unauthenticated();
  const { rows } = await query<{ id: string; user_id: string; scope: Session['scope']; quote_id: string | null }>(
    `UPDATE sessions
        SET last_used_at = now(),
            expires_at = CASE WHEN scope = 'USER' THEN now() + make_interval(days => $2) ELSE expires_at END
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      RETURNING id, user_id, scope, quote_id`,
    [sha256(token), SESSION_DAYS],
  );
  const s = rows[0];
  if (!s) throw unauthenticated();
  (req as AuthedRequest).session = { id: s.id, userId: s.user_id, scope: s.scope, quoteId: s.quote_id };
  next();
}

// Perfil, clientes y dashboard son solo de una sesión de usuario (Contrato API §13).
export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if ((req as AuthedRequest).session.scope !== 'USER') {
    throw new AppError(403, 'INSUFFICIENT_SCOPE', 'Esta sesión no permite esa operación');
  }
  next();
}
