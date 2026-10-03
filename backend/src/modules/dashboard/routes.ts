import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db';
import { requireSession, requireUser } from '../../http/session';
import { parse } from '../../http/validate';
import { session } from '../quotes/guard';
import { FOLLOW_UP, SUMMARY_COLS, SUMMARY_FROM, TODAY, toSummary } from '../quotes/summary';

const SHOWN = 5; // el tablero muestra hasta 5 por sección; las listas completas salen de GET /quotes?section=

export const dashboardRoutes = () => {
  const r = Router();
  r.use(requireSession, requireUser);

  // Pendientes (DRAFT y PENDING), Seguimiento (enviados con contacto vencido o de hoy) y Finalizados (el resto).
  r.get('/', async (req, res) => {
    const u = [session(req).userId];
    const section = (where: string, order: string, extra = '') =>
      query(`SELECT ${SUMMARY_COLS}, count(*) OVER ()::int AS n ${extra} ${SUMMARY_FROM} WHERE q.user_id = $1 AND ${where} ORDER BY ${order} LIMIT ${SHOWN}`, u);
    const [pending, follow, finalized] = await Promise.all([
      section(`q.doc_status IN ('DRAFT','PENDING')`, 'q.updated_at DESC, q.id'),
      query(`SELECT ${SUMMARY_COLS}, count(*) OVER ()::int AS n, (${TODAY} - (q.sent_at AT TIME ZONE 'America/Santiago')::date) AS days_since_sent
               ${SUMMARY_FROM} WHERE q.user_id = $1 AND ${FOLLOW_UP} ORDER BY q.next_contact_date, q.id LIMIT ${SHOWN}`, u),
      section(`q.doc_status = 'FINALIZED' AND NOT ${FOLLOW_UP}`, 'q.updated_at DESC, q.id'),
    ]);
    const n = (rows: { n?: number }[]) => rows[0]?.n ?? 0;
    res.json({
      counts: { pending: n(pending.rows), follow_up: n(follow.rows), finalized: n(finalized.rows) },
      pending: pending.rows.map(toSummary),
      follow_up: follow.rows.map((q) => ({ ...toSummary(q), days_since_sent: q.days_since_sent })),
      finalized: finalized.rows.map(toSummary),
    });
  });

  // Indicadores opcionales del mes (Contrato API §11). La zona horaria es America/Santiago.
  r.get('/kpis', async (req, res) => {
    const { month } = parse(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato YYYY-MM').optional() }), req.query);
    const { rows: m } = await query<{ month: string; from: Date; to: Date }>(
      `WITH p AS (SELECT COALESCE($1, to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM')) AS month)
       SELECT month,
              make_timestamptz(split_part(month, '-', 1)::int, split_part(month, '-', 2)::int, 1, 0, 0, 0, 'America/Santiago') AS "from",
              make_timestamptz(split_part(month, '-', 1)::int, split_part(month, '-', 2)::int, 1, 0, 0, 0, 'America/Santiago') + interval '1 month' AS "to"
         FROM p`, [month ?? null]);
    const { month: label, from, to } = m[0]!;
    const uid = session(req).userId;
    const [quoted, accepted, rejected, follow] = await Promise.all([
      query<{ n: number; amount: number }>(`SELECT count(*)::int AS n, COALESCE(sum(total), 0)::bigint AS amount FROM quotes WHERE user_id = $1 AND finalized_at >= $2 AND finalized_at < $3`, [uid, from, to]),
      query<{ n: number; amount: number }>(`SELECT count(*)::int AS n, COALESCE(sum(total), 0)::bigint AS amount FROM quotes WHERE user_id = $1 AND accepted_at >= $2 AND accepted_at < $3`, [uid, from, to]),
      // No hay `rejected_at`: la fecha del rechazo es la del último cambio de estado a REJECTED, de los que siguen rechazados.
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM quotes q
          WHERE q.user_id = $1 AND q.commercial_status = 'REJECTED'
            AND (SELECT e.created_at FROM audit_events e WHERE e.quote_id = q.id AND e.event = 'COMMERCIAL_STATUS_CHANGED' AND e.metadata->>'to' = 'REJECTED' ORDER BY e.id DESC LIMIT 1) >= $2
            AND (SELECT e.created_at FROM audit_events e WHERE e.quote_id = q.id AND e.event = 'COMMERCIAL_STATUS_CHANGED' AND e.metadata->>'to' = 'REJECTED' ORDER BY e.id DESC LIMIT 1) < $3`, [uid, from, to]),
      query<{ n: number }>(`SELECT count(*)::int AS n FROM quotes q WHERE q.user_id = $1 AND ${FOLLOW_UP}`, [uid]),
    ]);
    const a = accepted.rows[0]!;
    const decided = a.n + rejected.rows[0]!.n;
    res.json({
      month: label,
      quotes_count: quoted.rows[0]!.n, quoted_amount: quoted.rows[0]!.amount,
      accepted_count: a.n, accepted_amount: a.amount, avg_ticket: a.n ? Math.round(a.amount / a.n) : 0,
      acceptance_rate: decided ? a.n / decided : null, // sin presupuestos decididos en el mes no hay tasa
      follow_up_pending: follow.rows[0]!.n,
    });
  });

  return r;
};
