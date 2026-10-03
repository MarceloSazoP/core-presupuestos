import type { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { AppError } from '../../errors';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import { allow, loadQuote } from './guard';
import { quoteDetail, type QuoteRow } from './serialize';
import { TODAY } from './summary';

// Seguimiento comercial (Contrato API §8). Solo el usuario: una sesión del código no lo toca (Contrato API §13).
const started = (q: QuoteRow) => {
  if (q.commercial_status === 'NONE') throw new AppError(409, 'INVALID_STATE', 'El presupuesto aún no fue enviado');
};

const Note = z.string().trim().min(1).max(2000, 'Máximo 2000 caracteres');
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD').refine((d) => !Number.isNaN(Date.parse(d)), 'Fecha inválida');

const followUp = (f: Record<string, unknown>) => ({ id: f.id, note: f.note, next_contact_date: f.next_contact_date, commercial_status: f.commercial_status, created_at: f.created_at });

export function addFollowUpRoutes(r: Router) {
  // Cambio manual y libre entre SENT, FOLLOW_UP, ACCEPTED y REJECTED (Contrato BD §4). Nunca vuelve a NONE.
  r.put('/:id/commercial-status', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    started(q);
    const b = parse(z.strictObject({ status: z.enum(['SENT', 'FOLLOW_UP', 'ACCEPTED', 'REJECTED']), note: Note.optional() }), req.body);
    await withTx(async (c) => {
      // Aceptar fija accepted_at (una sola vez); salir de ACCEPTED lo limpia. Aceptar o rechazar limpia el próximo contacto.
      await c.query(
        `UPDATE quotes SET commercial_status = $2,
                accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN COALESCE(accepted_at, now()) ELSE NULL END,
                next_contact_date = CASE WHEN $2 IN ('ACCEPTED','REJECTED') THEN NULL ELSE next_contact_date END,
                updated_at = now()
          WHERE id = $1`, [q.id, b.status]);
      if (b.note) await c.query('INSERT INTO follow_ups (quote_id, user_id, note, commercial_status) VALUES ($1, $2, $3, $4)', [q.id, q.user_id, b.note, b.status]);
    });
    if (b.status !== q.commercial_status) await audit(req, 'COMMERCIAL_STATUS_CHANGED', { userId: q.user_id, quoteId: q.id, metadata: { from: q.commercial_status, to: b.status } });
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  r.get('/:id/follow-ups', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const { rows } = await query('SELECT id, note, next_contact_date, commercial_status, created_at FROM follow_ups WHERE quote_id = $1 AND user_id = $2 ORDER BY created_at DESC, id DESC', [q.id, q.user_id]);
    res.json({ data: rows.map(followUp) });
  });

  r.post('/:id/follow-ups', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    started(q);
    const b = parse(z.strictObject({ note: Note.optional(), next_contact_date: Day.optional() }).refine((x) => x.note || x.next_contact_date, { message: 'Envía una nota, una fecha o ambas' }), req.body);
    if (b.next_contact_date && (q.commercial_status === 'ACCEPTED' || q.commercial_status === 'REJECTED')) {
      throw new AppError(409, 'INVALID_STATE', 'No se puede programar un contacto en un presupuesto aceptado o rechazado');
    }
    const created = await withTx(async (c) => {
      if (b.next_contact_date) {
        const ok = await c.query(`SELECT $1::date >= ${TODAY} AS ok`, [b.next_contact_date]);
        if (!ok.rows[0].ok) throw new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'next_contact_date', message: 'Debe ser hoy o una fecha futura' }]);
        await c.query('UPDATE quotes SET next_contact_date = $2, updated_at = now() WHERE id = $1', [q.id, b.next_contact_date]);
      }
      const { rows } = await c.query(
        'INSERT INTO follow_ups (quote_id, user_id, note, next_contact_date, commercial_status) VALUES ($1, $2, $3, $4, $5) RETURNING id, note, next_contact_date, commercial_status, created_at',
        [q.id, q.user_id, b.note ?? null, b.next_contact_date ?? null, q.commercial_status]);
      return rows[0];
    });
    res.status(201).json(followUp(created));
  });

  r.delete('/:id/next-contact', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    await query('UPDATE quotes SET next_contact_date = NULL, updated_at = now() WHERE id = $1', [q.id]);
    res.status(204).end();
  });
}
