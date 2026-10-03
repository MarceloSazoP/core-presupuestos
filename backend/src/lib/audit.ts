import type { Request } from 'express';
import { query } from '../db';

// Auditoría mínima (Contrato BD §6): solo se agrega. `ip` queda null si Express no la conoce.
export function audit(req: Request, event: string, o: { userId?: string | null; quoteId?: string; metadata?: object } = {}) {
  return query('INSERT INTO audit_events (user_id, quote_id, event, metadata, ip) VALUES ($1, $2, $3, $4, $5)', [
    o.userId ?? null,
    o.quoteId ?? null,
    event,
    o.metadata ? JSON.stringify(o.metadata) : null,
    req.ip ?? null,
  ]);
}
