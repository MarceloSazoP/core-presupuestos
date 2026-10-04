import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { AppError, notFound } from '../../errors';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import { decoyHash, parseCode, verifySecret } from '../../lib/code';
import { randomToken, sha256 } from '../../lib/crypto';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const SESSION_MINUTES = 30;
const PAIR_MINUTES = 2;

const limited: RequestHandler = (_req, _res, next) =>
  next(new AppError(429, 'RATE_LIMITED', 'Demasiados intentos. Intenta más tarde.', undefined, { 'Retry-After': '3600' }));

// Intercambia el código del presupuesto por una sesión QUOTE_CODE (Contrato API §9).
export function accessRoutes(ipLimit = 10) {
  const r = Router();
  const perIp = rateLimit({ windowMs: 3_600_000, limit: ipLimit, standardHeaders: false, legacyHeaders: false, handler: limited });

  r.post('/code/exchange', perIp, async (req, res) => {
    const { code } = parse(z.strictObject({ code: z.string().max(64) }), req.body);
    const parsed = parseCode(code);

    // Cuenta el intento ANTES de verificar (así una ráfaga en paralelo no se salta el límite) y solo si no está bloqueado.
    const found = parsed
      ? (await query<{ id: string; quote_id: string; user_id: string; doc_status: string; code_hash: string; failed_attempts: number; locked: boolean }>(
          `UPDATE quote_access a SET failed_attempts = failed_attempts + 1,
                  locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
             FROM quotes q
            WHERE q.id = a.quote_id AND q.short_id = $1 AND a.kind = 'CODE' AND a.revoked_at IS NULL
              AND (a.locked_until IS NULL OR a.locked_until <= now())
          RETURNING a.id, a.quote_id, q.user_id, q.doc_status, a.code_hash, a.failed_attempts, false AS locked`,
          [parsed.shortId, MAX_FAILS, LOCK_MINUTES])).rows[0]
      : undefined;

    if (parsed && !found) {
      // ¿Existe pero está bloqueado? Entonces 429; si no existe o está revocado, el mismo 404 de siempre.
      const locked = await query(
        `SELECT 1 FROM quote_access a JOIN quotes q ON q.id = a.quote_id
          WHERE q.short_id = $1 AND a.kind = 'CODE' AND a.revoked_at IS NULL AND a.locked_until > now()`, [parsed.shortId]);
      if (locked.rowCount) throw new AppError(429, 'RATE_LIMITED', 'Demasiados intentos con este código. Intenta en 15 minutos.', undefined, { 'Retry-After': String(LOCK_MINUTES * 60) });
    }

    // Se verifica siempre (contra un señuelo si no hay código) para que la respuesta tarde lo mismo.
    const ok = await verifySecret(found?.code_hash ?? (await decoyHash()), parsed?.secret ?? '0');
    if (!found || !parsed || !ok) {
      if (parsed) await audit(req, 'ACCESS_CODE_FAILED', { metadata: { short_id: parsed.shortId } });
      throw notFound();
    }

    await query('UPDATE quote_access SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [found.id]);
    const token = randomToken();
    const { rows } = await query<{ expires_at: Date }>(
      `INSERT INTO sessions (user_id, token_hash, scope, quote_id, expires_at)
       VALUES ($1, $2, 'QUOTE_CODE', $3, now() + make_interval(mins => $4)) RETURNING expires_at`,
      [found.user_id, sha256(token), found.quote_id, SESSION_MINUTES]);
    await audit(req, 'ACCESS_CODE_USED', { userId: found.user_id, quoteId: found.quote_id });
    res.json({ token, quote_id: found.quote_id, doc_status: found.doc_status, expires_at: rows[0]!.expires_at });
  });

  // ── Vínculo por QR (Contrato API §9): la web muestra un QR por visita y la app, logueada, lo escanea. ──
  const pairLimit = (limit: number) => rateLimit({ windowMs: 3_600_000, limit, standardHeaders: false, legacyHeaders: false, handler: limited });

  r.post('/pair', pairLimit(120), async (_req, res) => {
    await query('DELETE FROM web_pairings WHERE expires_at < now() - interval \'1 hour\'');
    const code = randomToken();
    const secret = randomToken();
    const { rows } = await query<{ id: string; expires_at: Date }>(
      `INSERT INTO web_pairings (code_hash, secret_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3)) RETURNING id, expires_at`,
      [sha256(code), sha256(secret), PAIR_MINUTES]);
    res.json({ id: rows[0]!.id, code, secret, expires_at: rows[0]!.expires_at });
  });

  // La web pregunta con su secreto. Entrega la sesión una sola vez; todo lo demás es el mismo 404.
  r.post('/pair/poll', pairLimit(600), async (req, res) => {
    const { id, secret } = parse(z.strictObject({ id: z.uuid(), secret: z.string().max(64) }), req.body);
    const entrega = await withTx(async (c) => {
      const { rows } = await c.query<{ claimed_at: Date | null; delivered_at: Date | null; session_token: string | null; quote_id: string | null }>(
        'SELECT claimed_at, delivered_at, session_token, quote_id FROM web_pairings WHERE id = $1 AND secret_hash = $2 AND expires_at > now() AND delivered_at IS NULL FOR UPDATE',
        [id, sha256(secret)]);
      const p = rows[0];
      if (!p) throw notFound();
      if (!p.claimed_at || !p.session_token) return null;
      await c.query('UPDATE web_pairings SET session_token = NULL, delivered_at = now() WHERE id = $1', [id]);
      const s = (await c.query<{ expires_at: Date; doc_status: string }>(
        'SELECT s.expires_at, q.doc_status FROM sessions s JOIN quotes q ON q.id = s.quote_id WHERE s.token_hash = $1', [sha256(p.session_token)])).rows[0]!;
      return { status: 'CLAIMED', token: p.session_token, quote_id: p.quote_id, doc_status: s.doc_status, expires_at: s.expires_at };
    });
    res.json(entrega ?? { status: 'WAITING' });
  });

  // La app (sesión USER) vincula el QR con uno de sus presupuestos: no necesita tener el código guardado.
  r.post('/pair/claim', pairLimit(30), requireSession, requireUser, async (req, res) => {
    const { code, quote_id } = parse(z.strictObject({ code: z.string().max(64), quote_id: z.uuid() }), req.body);
    const userId = (req as AuthedRequest).session.userId;
    await withTx(async (c) => {
      if (!(await c.query('SELECT 1 FROM quotes WHERE id = $1 AND user_id = $2', [quote_id, userId])).rowCount) throw notFound();
      const token = randomToken();
      const claimed = await c.query(
        `UPDATE web_pairings SET quote_id = $2, user_id = $3, session_token = $4, claimed_at = now()
          WHERE code_hash = $1 AND expires_at > now() AND claimed_at IS NULL`,
        [sha256(code), quote_id, userId, token]);
      if (!claimed.rowCount) throw notFound();
      await c.query(
        `INSERT INTO sessions (user_id, token_hash, scope, quote_id, expires_at) VALUES ($1, $2, 'QUOTE_CODE', $3, now() + make_interval(mins => $4))`,
        [userId, sha256(token), quote_id, SESSION_MINUTES]);
    });
    await audit(req, 'ACCESS_PAIR_USED', { userId, quoteId: quote_id });
    res.status(204).end();
  });

  return r;
}
