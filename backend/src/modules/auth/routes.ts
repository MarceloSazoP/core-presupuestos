import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { query, withTx } from '../../db';
import { AppError, unauthenticated } from '../../errors';
import { requireSession, SESSION_DAYS, type AuthedRequest } from '../../http/session';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import { hashCode, randomCode6, randomToken, safeEqual, sha256 } from '../../lib/crypto';
import { maskDestination, type Channel, type SendCode } from '../../lib/deliver';
import { StartBody, VerifyBody } from './schemas';

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_PHONE_HOUR = 3;

const limited = (message: string): RequestHandler => (_req, _res, next) =>
  next(new AppError(429, "RATE_LIMITED", message, undefined, { "Retry-After": "3600" }));

export function authRoutes(sendCode: SendCode, ipStartLimit = 10) {
  const r = Router();
  const ipLimit = rateLimit({
    windowMs: 3_600_000,
    limit: ipStartLimit,
    standardHeaders: false,
    legacyHeaders: false,
    handler: limited('Demasiados intentos. Intenta más tarde.'),
  });

  // Inicia registro o ingreso. La respuesta es idéntica exista o no la cuenta (Contrato API §3).
  r.post('/start', ipLimit, async (req, res) => {
    const body = parse(StartBody, req.body);
    const { rows: users } = await query<{ phone: string; email: string }>('SELECT phone, email FROM users WHERE phone = $1', [body.phone]);
    const existing = users[0];
    // Cuenta existente: el código va al contacto GUARDADO, nunca a uno enviado en la petición.
    const destination = existing ? (body.channel === 'SMS' ? existing.phone : existing.email) : body.channel === 'SMS' ? body.phone : body.email;

    const { rows: recent } = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM auth_challenges WHERE phone = $1 AND created_at > now() - interval '1 hour'`, [body.phone]);
    if (recent[0]!.n >= MAX_PER_PHONE_HOUR) throw new AppError(429, 'RATE_LIMITED', 'Demasiados intentos para este teléfono', undefined, { 'Retry-After': '3600' });
    if (body.channel === 'SMS') {
      // Tope diario global: cada SMS cuesta dinero (Arquitectura §3).
      const { rows: today } = await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM auth_challenges WHERE channel = 'SMS' AND created_at > now() - interval '1 day'`);
      if (today[0]!.n >= config.SMS_DAILY_CAP) throw new AppError(429, 'RATE_LIMITED', 'Por ahora no podemos enviar SMS. Elige correo.', undefined, { 'Retry-After': '3600' });
    }

    const id = randomUUID();
    const code = randomCode6();
    await query(
      `INSERT INTO auth_challenges (id, phone, channel, destination, signup_name, signup_email, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))`,
      [id, body.phone, body.channel, destination, existing ? null : body.name, existing ? null : body.email, hashCode(id, code), CODE_MINUTES],
    );
    try {
      await sendCode(body.channel, destination, code);
    } catch (e) {
      await query('DELETE FROM auth_challenges WHERE id = $1', [id]); // un envío fallido no cuenta contra el límite
      throw e;
    }
    await audit(req, 'AUTH_CODE_SENT', { metadata: { channel: body.channel } });
    res.status(202).json({ challenge_id: id, expires_in_seconds: CODE_MINUTES * 60, destination_masked: maskDestination(body.channel as Channel, destination) });
  });

  r.post('/verify', async (req, res) => {
    const { challenge_id, code } = parse(VerifyBody, req.body);
    // Cuenta el intento ANTES de comparar y solo sobre desafíos vigentes: así el intento 6 nunca llega a comparar.
    const { rows } = await query<{ phone: string; signup_name: string | null; signup_email: string | null; code_hash: string }>(
      `UPDATE auth_challenges SET attempts = attempts + 1
        WHERE id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < $2
        RETURNING phone, signup_name, signup_email, code_hash`,
      [challenge_id, MAX_ATTEMPTS],
    );
    const ch = rows[0];
    if (!ch || !safeEqual(ch.code_hash, hashCode(challenge_id, code))) throw unauthenticated();

    const result = await withTx(async (c) => {
      const used = await c.query('UPDATE auth_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL', [challenge_id]);
      if (used.rowCount === 0) throw unauthenticated(); // otro verify ganó la carrera
      let { rows: u } = await c.query('SELECT id, name, phone, email, logo_file_id, signature_file_id FROM users WHERE phone = $1', [ch.phone]);
      let isNew = false;
      if (!u[0]) {
        if (!ch.signup_name || !ch.signup_email) throw unauthenticated();
        try {
          u = (await c.query(
            `INSERT INTO users (phone, email, name) VALUES ($1, $2, $3)
             RETURNING id, name, phone, email, logo_file_id, signature_file_id`, [ch.phone, ch.signup_email, ch.signup_name])).rows;
        } catch (e) {
          if ((e as { code?: string }).code === '23505') {
            throw new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'email', message: 'Ese correo ya está en uso' }]);
          }
          throw e;
        }
        isNew = true;
      }
      const token = randomToken();
      const { rows: s } = await c.query<{ expires_at: Date }>(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING expires_at`,
        [u[0].id, sha256(token), SESSION_DAYS],
      );
      return { token, expires_at: s[0]!.expires_at, isNew, user: u[0] };
    });
    await audit(req, 'LOGIN', { userId: result.user.id });
    res.json({
      token: result.token,
      expires_at: result.expires_at,
      is_new_user: result.isNew,
      user: { id: result.user.id, name: result.user.name, phone: result.user.phone, email: result.user.email, has_logo: result.user.logo_file_id !== null, has_signature: result.user.signature_file_id !== null },
    });
  });

  r.post('/logout', requireSession, async (req, res) => {
    const { session } = req as AuthedRequest;
    await query('UPDATE sessions SET revoked_at = now() WHERE id = $1', [session.id]);
    await audit(req, 'LOGOUT', { userId: session.userId });
    res.status(204).end();
  });

  return r;
}
