import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { parse } from '../../http/validate';
import { name } from '../auth/schemas';

type Row = { id: string; name: string; phone: string; email: string; logo_file_id: string | null; signature_file_id: string | null };

const perfil = (u: Row) => ({
  id: u.id, name: u.name, phone: u.phone, email: u.email,
  has_logo: u.logo_file_id !== null, has_signature: u.signature_file_id !== null,
});

const COLS = 'id, name, phone, email, logo_file_id, signature_file_id';

export const meRoutes = () => {
  const r = Router();
  r.use(requireSession, requireUser);

  r.get('/', async (req, res) => {
    const { rows } = await query<Row>(`SELECT ${COLS} FROM users WHERE id = $1`, [(req as AuthedRequest).session.userId]);
    res.json(perfil(rows[0]!));
  });

  // El teléfono y el correo no se cambian en el MVP (Contrato API §4); `.strict()` rechaza cualquier otro campo.
  r.put('/', async (req, res) => {
    const body = parse(z.strictObject({ name }), req.body);
    const { rows } = await query<Row>(`UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING ${COLS}`, [(req as AuthedRequest).session.userId, body.name]);
    res.json(perfil(rows[0]!));
  });

  return r;
};
