import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../../db';
import { AppError } from '../../errors';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { parse } from '../../http/validate';
import type { Lugares } from '../../lib/places';

// Sugerencias de direcciones (Contrato API §12.2). Sesión `USER`; 60 consultas por minuto y por usuario.
const Session = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Sesión inválida');
const Autocomplete = z.strictObject({ input: z.string().trim().min(3).max(120), session: Session, region: z.string().regex(/^[A-Za-z]{2}$/).optional() });
const Detalle = z.strictObject({ session: Session });
const IdLugar = z.string().regex(/^[A-Za-z0-9_-]{3,300}$/, 'Lugar inválido');
const uid = (req: Request) => (req as unknown as AuthedRequest).session.userId;

export const placesRoutes = (lugares: Lugares) => {
  const r = Router();
  r.use(requireSession, requireUser);
  r.use(
    rateLimit({
      windowMs: 60_000, limit: 60, standardHeaders: false, legacyHeaders: false,
      keyGenerator: (req) => uid(req as Request),
      handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Demasiadas consultas. Intenta en un minuto.', undefined, { 'Retry-After': '60' })),
    }),
  );

  r.post('/autocomplete', async (req, res) => {
    const b = parse(Autocomplete, req.body);
    const region = b.region ?? (await query<{ country: string }>('SELECT country FROM users WHERE id = $1', [uid(req)])).rows[0]!.country;
    res.json({ suggestions: await lugares.autocomplete(b.input, region, b.session) });
  });

  r.get('/:id', async (req, res) => {
    const id = parse(IdLugar, req.params.id);
    const q = parse(Detalle, { session: req.query.session });
    res.json(await lugares.details(id, q.session));
  });
  return r;
};
