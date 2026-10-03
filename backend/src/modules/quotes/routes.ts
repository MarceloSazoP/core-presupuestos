import { Router } from 'express';
import type { PoolClient } from 'pg';
import { query, withTx } from '../../db';
import { AppError } from '../../errors';
import { requireSession } from '../../http/session';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import { removeMany } from '../../lib/files';
import { formatCode, hashSecret, newSecret, newShortId } from '../../lib/code';
import { allow, editable, loadQuote, session } from './guard';
import { addMediaRoutes } from './media';
import { CreateQuote, Items, ListQuotes, Measurements, PatchQuote, Survey } from './schemas';
import { quoteDetail, type QuoteRow } from './serialize';
import { lineTotal, sumTotals } from './totals';

const TODAY = `(now() AT TIME ZONE 'America/Santiago')::date`;

const customerNotFound = () => new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'customer_id', message: 'Cliente no encontrado' }]);
const dup = (e: unknown) => (e as { code?: string }).code === '23505';

export const quoteRoutes = () => {
  const r = Router();
  r.use(requireSession);
  addMediaRoutes(r);

  // ── Listado ────────────────────────────────────────────────────────────────
  r.get('/', allow('USER'), async (req, res) => {
    const f = parse(ListQuotes, req.query);
    const where = ['q.user_id = $1'];
    const params: unknown[] = [session(req).userId];
    const add = (sql: string, v: unknown) => (params.push(v), where.push(sql.replace('?', `$${params.length}`)));
    if (f.doc_status) add('q.doc_status = ?', f.doc_status);
    if (f.commercial_status) add('q.commercial_status = ?', f.commercial_status);
    if (f.customer_id) add('q.customer_id = ?', f.customer_id);
    const followUp = `(q.commercial_status IN ('SENT','FOLLOW_UP') AND q.next_contact_date <= ${TODAY})`;
    if (f.section === 'pending') where.push(`q.doc_status IN ('DRAFT','PENDING')`);
    if (f.section === 'follow_up') where.push(followUp);
    if (f.section === 'finalized') where.push(`q.doc_status = 'FINALIZED' AND NOT ${followUp}`);
    const { rows } = await query(
      `SELECT q.id, q.number, q.service_description, q.total, q.doc_status, q.commercial_status, q.next_contact_date,
              q.sent_at, q.updated_at, c.id AS customer_id, c.name AS customer_name, count(*) OVER ()::int AS total_rows
         FROM quotes q JOIN customers c ON c.id = q.customer_id AND c.user_id = q.user_id
        WHERE ${where.join(' AND ')} ORDER BY q.updated_at DESC, q.id LIMIT ${f.limit} OFFSET ${f.offset}`, params);
    res.json({
      total: rows[0]?.total_rows ?? 0,
      data: rows.map((q) => ({
        id: q.id, number: q.number, customer: { id: q.customer_id, name: q.customer_name },
        service_description: q.service_description ?? '', total: q.total, doc_status: q.doc_status, commercial_status: q.commercial_status,
        next_contact_date: q.next_contact_date, sent_at: q.sent_at, updated_at: q.updated_at,
      })),
    });
  });

  // ── Crear (Etapa 1) ────────────────────────────────────────────────────────
  r.post('/', allow('USER'), async (req, res) => {
    const b = parse(CreateQuote, req.body);
    const userId = session(req).userId;
    if (b.id) {
      // Idempotencia: mismo usuario ⇒ 200 con lo existente (sin código: el secreto no se puede volver a leer); otro ⇒ 409.
      const { rows } = await query<QuoteRow>('SELECT * FROM quotes WHERE id = $1', [b.id]);
      if (rows[0]) {
        if (rows[0].user_id !== userId) throw new AppError(409, 'ID_CONFLICT', 'El id pertenece a otro usuario');
        res.status(200).json(await quoteDetail(rows[0]));
        return;
      }
    }
    const secret = newSecret();
    const codeHash = await hashSecret(secret); // lento a propósito: se hace fuera de la transacción
    const created = await withTx(async (c) => {
      let customerId = b.customer_id;
      if (customerId) {
        const ok = await c.query('SELECT 1 FROM customers WHERE id = $1 AND user_id = $2', [customerId, userId]);
        if (!ok.rowCount) throw customerNotFound();
      } else {
        const n = b.customer!;
        customerId = (await c.query<{ id: string }>(
          'INSERT INTO customers (user_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [userId, n.name, n.phone, n.email ?? null, n.address ?? null])).rows[0]!.id;
      }
      for (let intento = 0; intento < 5; intento++) {
        const { rows } = await c.query<QuoteRow>(
          `INSERT INTO quotes (id, user_id, customer_id, short_id, service_description, address, latitude, longitude)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (short_id) DO NOTHING RETURNING *`,
          [b.id ?? null, userId, customerId, newShortId(), b.service_description ?? null, b.address ?? null, b.latitude ?? null, b.longitude ?? null]);
        if (rows[0]) {
          await c.query(`INSERT INTO quote_access (quote_id, kind, code_hash) VALUES ($1, 'CODE', $2)`, [rows[0].id, codeHash]);
          return rows[0];
        }
      }
      throw new Error('no se pudo asignar un ID corto'); // 32^6 combinaciones: no ocurre en la práctica
    });
    await audit(req, 'QUOTE_CREATED', { userId, quoteId: created.id });
    await audit(req, 'ACCESS_CODE_CREATED', { userId, quoteId: created.id });
    res.status(201).json({ ...(await quoteDetail(created)), access_code: formatCode(created.short_id, secret) });
  });

  // ── Leer ───────────────────────────────────────────────────────────────────
  r.get('/:id', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    res.json(await quoteDetail(await loadQuote(req, req.params.id)));
  });

  // ── Editar cabecera y Etapa 3 ──────────────────────────────────────────────
  r.patch('/:id', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    const b = parse(PatchQuote, req.body);
    const sets: string[] = [];
    const params: unknown[] = [q.id, q.user_id];
    const set = (col: string, v: unknown) => (params.push(v), sets.push(`${col} = $${params.length}`)); // `col` es siempre una constante de este archivo
    for (const k of ['customer_id', 'service_description', 'address', 'latitude', 'longitude', 'validity_days', 'observations', 'include_signature', 'include_qr'] as const) {
      if (k in b) set(k, b[k]);
    }
    if (b.warranty) {
      set('warranty_kind', b.warranty.kind);
      set('warranty_text', b.warranty.kind === 'CUSTOM' ? b.warranty.text : null);
    }
    if (b.discount !== undefined) {
      params.push(b.discount);
      sets.push(`discount = $${params.length}`, `total = subtotal - $${params.length}`);
    }
    if (sets.length) {
      try {
        await query(`UPDATE quotes SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND user_id = $2`, params);
      } catch (e) {
        if ((e as { code?: string }).code === '23503') throw customerNotFound(); // FK compuesta: cliente de otro usuario
        throw e;
      }
    }
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // ── Etapa 2: levantamiento ─────────────────────────────────────────────────
  r.put('/:id/survey', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    const b = parse(Survey, req.body);
    await query(
      `INSERT INTO quote_surveys (quote_id, notes, field_observations) VALUES ($1, $2, $3)
       ON CONFLICT (quote_id) DO UPDATE SET
         notes = CASE WHEN $4 THEN EXCLUDED.notes ELSE quote_surveys.notes END,
         field_observations = CASE WHEN $5 THEN EXCLUDED.field_observations ELSE quote_surveys.field_observations END,
         updated_at = now()`,
      [q.id, b.notes ?? null, b.field_observations ?? null, 'notes' in b, 'field_observations' in b]);
    await query('UPDATE quotes SET updated_at = now() WHERE id = $1', [q.id]);
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  r.put('/:id/measurements', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    const { measurements } = parse(Measurements, req.body);
    try {
      await withTx(async (c) => {
        await c.query('SELECT 1 FROM quotes WHERE id = $1 FOR UPDATE', [q.id]); // serializa reemplazos simultáneos
        await c.query('DELETE FROM survey_measurements WHERE quote_id = $1', [q.id]);
        for (const [i, m] of measurements.entries()) {
          await c.query('INSERT INTO survey_measurements (id, quote_id, position, label, value) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)', [m.id ?? null, q.id, i, m.label, m.value]);
        }
        await c.query('UPDATE quotes SET updated_at = now() WHERE id = $1', [q.id]);
      });
    } catch (e) {
      if (dup(e)) throw new AppError(409, 'ID_CONFLICT', 'Un id de medida ya existe');
      throw e;
    }
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // ── Etapa 3: ítems (el backend calcula todo) ───────────────────────────────
  r.put('/:id/items', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    const { items } = parse(Items, req.body);
    const lines = items.map((i) => lineTotal(i.quantity, i.unit_price));
    try {
      await withTx(async (c) => {
        const { rows } = await c.query<{ discount: number }>('SELECT discount FROM quotes WHERE id = $1 FOR UPDATE', [q.id]);
        await c.query('DELETE FROM quote_items WHERE quote_id = $1', [q.id]);
        for (const [i, it] of items.entries()) {
          await c.query(
            `INSERT INTO quote_items (id, quote_id, position, description, quantity, unit, unit_price, line_total)
             VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)`,
            [it.id ?? null, q.id, i, it.description, it.quantity, it.unit, it.unit_price, lines[i]]);
        }
        const { subtotal, total } = sumTotals(lines, rows[0]!.discount);
        await c.query('UPDATE quotes SET subtotal = $2, total = $3, updated_at = now() WHERE id = $1', [q.id, subtotal, total]);
      });
    } catch (e) {
      if (dup(e)) throw new AppError(409, 'ID_CONFLICT', 'Un id de ítem ya existe');
      throw e;
    }
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // ── Guardar: DRAFT → PENDING (sobre un PENDING no cambia nada) ─────────────
  r.post('/:id/save', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    await query(`UPDATE quotes SET doc_status = 'PENDING', updated_at = now() WHERE id = $1 AND doc_status = 'DRAFT'`, [q.id]);
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // ── Borrar (solo DRAFT/PENDING; en cascada) ────────────────────────────────
  r.delete('/:id', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    editable(q);
    // Las filas de `files` caen en cascada; las claves se leen antes para borrar también los archivos del disco.
    const keys = (await query<{ storage_key: string }>('SELECT storage_key FROM files WHERE quote_id = $1', [q.id])).rows.map((f) => f.storage_key);
    await query('DELETE FROM quotes WHERE id = $1 AND user_id = $2', [q.id, q.user_id]);
    await removeMany(keys);
    await audit(req, 'QUOTE_DELETED', { userId: q.user_id, quoteId: q.id });
    res.status(204).end();
  });

  // ── Código del presupuesto: crear/rotar y revocar (Contrato API §9) ───────
  const revokeCode = async (c: PoolClient, quoteId: string) => {
    await c.query(`UPDATE quote_access SET revoked_at = now() WHERE quote_id = $1 AND kind = 'CODE' AND revoked_at IS NULL`, [quoteId]);
    await c.query(`UPDATE sessions SET revoked_at = now() WHERE quote_id = $1 AND scope = 'QUOTE_CODE' AND revoked_at IS NULL`, [quoteId]);
  };

  r.post('/:id/access-code', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const secret = newSecret();
    const codeHash = await hashSecret(secret);
    await withTx(async (c) => {
      await revokeCode(c, q.id);
      await c.query(`INSERT INTO quote_access (quote_id, kind, code_hash) VALUES ($1, 'CODE', $2)`, [q.id, codeHash]);
    });
    await audit(req, 'ACCESS_CODE_CREATED', { userId: q.user_id, quoteId: q.id, metadata: { rotated: true } });
    res.json({ code: formatCode(q.short_id, secret) });
  });

  r.delete('/:id/access-code', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    await withTx((c) => revokeCode(c, q.id));
    await audit(req, 'ACCESS_CODE_REVOKED', { userId: q.user_id, quoteId: q.id });
    res.status(204).end();
  });

  return r;
};
