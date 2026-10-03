import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { AppError, notFound } from '../../errors';
import { requireSession, requireUser, type AuthedRequest } from '../../http/session';
import { parse } from '../../http/validate';
import { email, name, phone } from '../auth/schemas';

type Row = { id: string; name: string; phone: string; email: string | null; address: string | null; created_at: Date; updated_at: Date };

const COLS = 'id, name, phone, email, address, created_at, updated_at';
const cliente = (c: Row) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, created_at: c.created_at, updated_at: c.updated_at });

const Fields = { name, phone, email: email.nullish(), address: z.string().trim().max(300, 'Máximo 300 caracteres').nullish() };
const Create = z.strictObject({ id: z.uuid().optional(), ...Fields });
const Replace = z.strictObject(Fields);
const List = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
const Id = z.uuid();

// `LIKE` con los comodines del texto escapados: "50%" busca "50%", no "50" seguido de cualquier cosa.
const like = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;
const uid = (req: unknown) => (req as AuthedRequest).session.userId;
// Un id que no es UUID no puede existir: 404 igual que uno ajeno (nunca llega a Postgres).
const idParam = (v: unknown) => {
  const r = Id.safeParse(v);
  if (!r.success) throw notFound();
  return r.data;
};

export const customerRoutes = () => {
  const r = Router();
  r.use(requireSession, requireUser);

  r.get('/', async (req, res) => {
    const { q, limit, offset } = parse(List, req.query);
    const params: unknown[] = [uid(req)];
    let where = 'user_id = $1';
    if (q) {
      params.push(like(q));
      where += ` AND (name ILIKE $2 ESCAPE '\\' OR phone ILIKE $2 ESCAPE '\\')`;
    }
    const { rows } = await query<Row & { total: number }>(
      `SELECT ${COLS}, count(*) OVER ()::int AS total FROM customers WHERE ${where}
        ORDER BY lower(name), id LIMIT ${limit} OFFSET ${offset}`, params);
    const total = rows[0]?.total ?? (offset === 0 ? 0 : (await query<{ n: number }>(`SELECT count(*)::int AS n FROM customers WHERE ${where}`, params)).rows[0]!.n);
    res.json({ data: rows.map(cliente), total });
  });

  r.post('/', async (req, res) => {
    const b = parse(Create, req.body);
    if (b.id) {
      // Idempotencia (Contrato API §1): mismo usuario ⇒ 200 con lo existente; otro usuario ⇒ 409.
      const { rows } = await query<Row & { user_id: string }>(`SELECT ${COLS}, user_id FROM customers WHERE id = $1`, [b.id]);
      if (rows[0]) {
        if (rows[0].user_id !== uid(req)) throw new AppError(409, 'ID_CONFLICT', 'El id pertenece a otro usuario');
        res.status(200).json(cliente(rows[0]));
        return;
      }
    }
    const { rows } = await query<Row>(
      `INSERT INTO customers (id, user_id, name, phone, email, address) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6) RETURNING ${COLS}`,
      [b.id ?? null, uid(req), b.name, b.phone, b.email ?? null, b.address ?? null]);
    res.status(201).json(cliente(rows[0]!));
  });

  r.get('/:id', async (req, res) => {
    const id = idParam(req.params.id);
    const { rows } = await query<Row & { quotes: number; accepted: number; follow_up: number }>(
      `SELECT ${COLS},
              (SELECT count(*)::int FROM quotes q WHERE q.customer_id = c.id AND q.user_id = c.user_id) AS quotes,
              (SELECT count(*)::int FROM quotes q WHERE q.customer_id = c.id AND q.user_id = c.user_id AND q.commercial_status = 'ACCEPTED') AS accepted,
              (SELECT count(*)::int FROM quotes q WHERE q.customer_id = c.id AND q.user_id = c.user_id AND q.commercial_status = 'FOLLOW_UP') AS follow_up
         FROM customers c WHERE id = $1 AND user_id = $2`, [id, uid(req)]);
    if (!rows[0]) throw notFound();
    res.json({ ...cliente(rows[0]), summary: { quotes: rows[0].quotes, accepted: rows[0].accepted, follow_up: rows[0].follow_up } });
  });

  r.put('/:id', async (req, res) => {
    const id = idParam(req.params.id);
    const b = parse(Replace, req.body);
    const { rows } = await query<Row>(
      `UPDATE customers SET name = $3, phone = $4, email = $5, address = $6, updated_at = now()
        WHERE id = $1 AND user_id = $2 RETURNING ${COLS}`, [id, uid(req), b.name, b.phone, b.email ?? null, b.address ?? null]);
    if (!rows[0]) throw notFound();
    res.json(cliente(rows[0]));
  });

  r.delete('/:id', async (req, res) => {
    const id = idParam(req.params.id);
    try {
      const { rowCount } = await query('DELETE FROM customers WHERE id = $1 AND user_id = $2', [id, uid(req)]);
      if (!rowCount) throw notFound();
    } catch (e) {
      if ((e as { code?: string }).code === '23503') throw new AppError(409, 'CUSTOMER_HAS_QUOTES', 'El cliente tiene presupuestos');
      throw e;
    }
    res.status(204).end();
  });

  return r;
};
