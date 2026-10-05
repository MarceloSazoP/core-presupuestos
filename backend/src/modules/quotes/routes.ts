import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTx } from '../../db';
import { AppError } from '../../errors';
import { requireSession } from '../../http/session';
import { parse } from '../../http/validate';
import { audit } from '../../lib/audit';
import { removeMany } from '../../lib/files';
import type { SendMail } from '../../lib/mail';
import { formatCode, hashSecret, newSecret, newShortId } from '../../lib/code';
import { email, name, phone } from '../auth/schemas';
import { allow, editable, loadQuote, session } from './guard';
import { addEmissionRoutes } from './emission';
import { addFollowUpRoutes } from './followups';
import { addMediaRoutes } from './media';
import { CreateQuote, Items, ListQuotes, Measurements, PatchQuote, Survey } from './schemas';
import { suscribir } from '../../lib/events';
import { quoteDetail, type QuoteRow } from './serialize';
import { FOLLOW_UP, SUMMARY_COLS, SUMMARY_FROM, toSummary } from './summary';
import { PAIS_POR_DEFECTO, paisDe } from '../../lib/paises';
import { lineTotal, sumTotals } from './totals';

const customerNotFound = () => new AppError(422, 'VALIDATION_FAILED', 'Datos inválidos', [{ field: 'customer_id', message: 'Cliente no encontrado' }]);
const dup = (e: unknown) => (e as { code?: string }).code === '23505';

export const quoteRoutes = (deps: { sendMail: SendMail; mailLimit?: number }) => {
  const r = Router();
  r.use(requireSession);
  addMediaRoutes(r);
  addEmissionRoutes(r, deps);
  addFollowUpRoutes(r);

  // ── Listado ────────────────────────────────────────────────────────────────
  r.get('/', allow('USER'), async (req, res) => {
    const f = parse(ListQuotes, req.query);
    const where = ['q.user_id = $1'];
    const params: unknown[] = [session(req).userId];
    const add = (sql: string, v: unknown) => (params.push(v), where.push(sql.replace('?', `$${params.length}`)));
    if (f.doc_status) add('q.doc_status = ?', f.doc_status);
    if (f.commercial_status) add('q.commercial_status = ?', f.commercial_status);
    if (f.customer_id) add('q.customer_id = ?', f.customer_id);
    const followUp = FOLLOW_UP;
    if (f.section === 'pending') where.push(`q.doc_status IN ('DRAFT','PENDING')`);
    if (f.section === 'follow_up') where.push(followUp);
    if (f.section === 'finalized') where.push(`q.doc_status = 'FINALIZED' AND NOT ${followUp}`);
    const { rows } = await query(
      `SELECT ${SUMMARY_COLS}, count(*) OVER ()::int AS total_rows ${SUMMARY_FROM}
        WHERE ${where.join(' AND ')} ORDER BY q.updated_at DESC, q.id LIMIT ${f.limit} OFFSET ${f.offset}`, params);
    res.json({ total: rows[0]?.total_rows ?? 0, data: rows.map(toSummary) });
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
      // El presupuesto guarda su propia copia del país, la moneda y el impuesto del usuario (Internacionalización.md §3.2).
      const pais = paisDe((await c.query<{ country: string }>('SELECT country FROM users WHERE id = $1', [userId])).rows[0]!.country) ?? PAIS_POR_DEFECTO;
      for (let intento = 0; intento < 5; intento++) {
        const { rows } = await c.query<QuoteRow>(
          `INSERT INTO quotes (id, user_id, customer_id, short_id, service_description, address, latitude, longitude, country, currency, vat_label, vat_rate)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (short_id) DO NOTHING RETURNING *`,
          [b.id ?? null, userId, customerId, newShortId(), b.service_description ?? null, b.address ?? null, b.latitude ?? null, b.longitude ?? null, pais.country, pais.currency, pais.vat_label, pais.vat_rate]);
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
    for (const k of ['customer_id', 'service_description', 'address', 'latitude', 'longitude', 'validity_days', 'observations', 'include_qr'] as const) {
      if (k in b) set(k, b[k]);
    }
    if (b.warranty) {
      set('warranty_kind', b.warranty.kind);
      set('warranty_text', b.warranty.kind === 'CUSTOM' ? b.warranty.text : null);
    }
    // El descuento y el IVA cambian el total: se recalcula con la función única de totales, bajo el mismo bloqueo que los ítems.
    const recalcula = b.discount !== undefined || b.include_vat !== undefined;
    if (sets.length || recalcula) {
      try {
        await withTx(async (c) => {
          if (recalcula) {
            const { rows } = await c.query<{ subtotal: number; discount: number; include_vat: boolean; vat_rate: number }>('SELECT subtotal, discount, include_vat, vat_rate FROM quotes WHERE id = $1 FOR UPDATE', [q.id]);
            const discount = b.discount ?? rows[0]!.discount;
            const includeVat = b.include_vat ?? rows[0]!.include_vat;
            const t = sumTotals([rows[0]!.subtotal], discount, includeVat, rows[0]!.vat_rate);
            set('discount', discount);
            set('include_vat', includeVat);
            set('vat', t.vat);
            set('total', t.total);
          }
          await c.query(`UPDATE quotes SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND user_id = $2`, params);
        });
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
    // Una tarea no tiene cantidad ni unidad: se guarda como 1 un y su total es su valor (0 = incluida).
    const lines = items.map((i) => lineTotal(i.kind === 'TASK' ? 1 : i.quantity, i.unit_price));
    try {
      await withTx(async (c) => {
        const { rows } = await c.query<{ discount: number; include_vat: boolean; vat_rate: number }>('SELECT discount, include_vat, vat_rate FROM quotes WHERE id = $1 FOR UPDATE', [q.id]);
        await c.query('DELETE FROM quote_items WHERE quote_id = $1', [q.id]);
        for (const [i, it] of items.entries()) {
          await c.query(
            `INSERT INTO quote_items (id, quote_id, position, kind, description, quantity, unit, unit_price, line_total)
             VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)`,
            [it.id ?? null, q.id, i, it.kind, it.description, it.kind === 'TASK' ? 1 : it.quantity, it.kind === 'TASK' ? 'un' : it.unit, it.unit_price, lines[i]]);
        }
        const { subtotal, vat, total } = sumTotals(lines, rows[0]!.discount, rows[0]!.include_vat, rows[0]!.vat_rate);
        await c.query('UPDATE quotes SET subtotal = $2, vat = $3, total = $4, updated_at = now() WHERE id = $1', [q.id, subtotal, vat, total]);
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

  // ── Corregir el teléfono o el correo del cliente (Contrato API §6) ─────────────────────────
  // Siempre se puede (el cliente se equivoca al dárselos y los confirma después): no están en el PDF ni en el snapshot. El
  // nombre sí sale en el PDF, así que solo cambia mientras el presupuesto se edita. Modifica al cliente, no solo a este presupuesto.
  r.patch('/:id/customer', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const b = parse(z.strictObject({ name, phone, email: email.nullable() }).partial().refine((x) => Object.keys(x).length > 0, { message: 'Envía al menos un campo' }), req.body);
    if (b.name !== undefined && q.doc_status === 'FINALIZED') throw new AppError(409, 'INVALID_STATE', 'El nombre del cliente ya no se puede cambiar: sale en el PDF del presupuesto terminado');
    await query(
      `UPDATE customers SET name = CASE WHEN $3 THEN $4 ELSE name END,
                            phone = CASE WHEN $5 THEN $6 ELSE phone END,
                            email = CASE WHEN $7 THEN $8 ELSE email END,
                            updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [q.customer_id, q.user_id, 'name' in b, b.name ?? null, 'phone' in b, b.phone ?? null, 'email' in b, b.email ?? null]);
    await audit(req, 'CUSTOMER_CONTACT_UPDATED', { userId: q.user_id, quoteId: q.id });
    res.json(await quoteDetail(await loadQuote(req, q.id)));
  });

  // Avisos en vivo (Contrato API §6): `changed` cada vez que algo del presupuesto cambia, desde cualquier cliente.
  r.get('/:id/events', allow('USER', 'QUOTE_CODE'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const avisar = () => res.write(`event: changed\ndata: ${JSON.stringify({ quote_id: q.id })}\n\n`);
    const baja = await suscribir(q.id, avisar);
    const latido = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(latido);
      baja();
    });
  });

  // ── Rehacer un presupuesto rechazado como nueva versión (Contrato API §6) ───────────────────
  // Lo enviado no cambia: la versión nueva es OTRO presupuesto, con su código, su número y su PDF.
  r.post('/:id/revise', allow('USER'), async (req, res) => {
    const q = await loadQuote(req, req.params.id);
    const b = parse(z.strictObject({ id: z.uuid().optional() }), req.body ?? {});
    const userId = q.user_id;
    if (b.id) {
      // Idempotencia (Contrato API §1): el mismo id de esta misma versión es un reintento.
      const { rows } = await query<QuoteRow>('SELECT * FROM quotes WHERE id = $1', [b.id]);
      if (rows[0]) {
        if (rows[0].user_id !== userId || rows[0].parent_quote_id !== q.id) throw new AppError(409, 'ID_CONFLICT', 'El id ya existe');
        res.status(200).json(await quoteDetail(rows[0]));
        return;
      }
    }
    if (q.doc_status !== 'FINALIZED' || q.commercial_status !== 'REJECTED') throw new AppError(409, 'INVALID_STATE', 'Solo un presupuesto rechazado se puede rehacer como nueva versión');
    const next = await query<{ id: string }>('SELECT id FROM quotes WHERE parent_quote_id = $1', [q.id]);
    if (next.rows[0]) throw new AppError(409, 'ALREADY_REVISED', 'Este presupuesto ya tiene una versión nueva', [{ field: 'next_version_id', message: next.rows[0].id }]);

    const secret = newSecret();
    const codeHash = await hashSecret(secret); // lento a propósito: fuera de la transacción
    const created = await withTx(async (c) => {
      let nuevo: QuoteRow | undefined;
      for (let intento = 0; intento < 5 && !nuevo; intento++) {
        nuevo = (await c.query<QuoteRow>(
          `INSERT INTO quotes (id, user_id, customer_id, short_id, service_description, address, latitude, longitude,
                               subtotal, discount, include_vat, vat, total, warranty_kind, warranty_text, validity_days, observations,
                               include_qr, version, parent_quote_id, country, currency, vat_label, vat_rate)
           SELECT COALESCE($2, gen_random_uuid()), user_id, customer_id, $3, service_description, address, latitude, longitude,
                  subtotal, discount, include_vat, vat, total, warranty_kind, warranty_text, validity_days, observations,
                  include_qr, version + 1, id, country, currency, vat_label, vat_rate
             FROM quotes WHERE id = $1
           ON CONFLICT (short_id) DO NOTHING RETURNING *`, [q.id, b.id ?? null, newShortId()])).rows[0];
      }
      if (!nuevo) throw new Error('no se pudo asignar un ID corto');
      // Se copia lo que se vuelve a trabajar; las fotos y la voz se quedan en la versión original.
      await c.query(`INSERT INTO quote_items (quote_id, position, kind, description, quantity, unit, unit_price, line_total)
                     SELECT $2, position, kind, description, quantity, unit, unit_price, line_total FROM quote_items WHERE quote_id = $1`, [q.id, nuevo.id]);
      await c.query(`INSERT INTO quote_surveys (quote_id, notes, field_observations)
                     SELECT $2, notes, field_observations FROM quote_surveys WHERE quote_id = $1`, [q.id, nuevo.id]);
      await c.query(`INSERT INTO survey_measurements (quote_id, position, label, value)
                     SELECT $2, position, label, value FROM survey_measurements WHERE quote_id = $1`, [q.id, nuevo.id]);
      await c.query(`INSERT INTO quote_access (quote_id, kind, code_hash) VALUES ($1, 'CODE', $2)`, [nuevo.id, codeHash]);
      return nuevo;
    });
    await audit(req, 'QUOTE_REVISED', { userId, quoteId: created.id, metadata: { from: q.id, version: created.version } });
    await audit(req, 'ACCESS_CODE_CREATED', { userId, quoteId: created.id });
    res.status(201).json({ ...(await quoteDetail(created)), access_code: formatCode(created.short_id, secret) });
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
