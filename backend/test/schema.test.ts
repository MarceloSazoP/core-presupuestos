import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, it } from 'node:test';
import type { PoolClient } from 'pg';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';

const FINALIZED = `doc_status='FINALIZED', number='CP-2026-0001', finalized_at=now(),
                   service_description='x', validity_days=15`;

let c: PoolClient;
let userA: string;
let userB: string;
let customerA: string;

async function expectCode(code: string, sql: string, params: unknown[] = []) {
  await c.query('SAVEPOINT s');
  await assert.rejects(c.query(sql, params), (e: { code?: string }) => e.code === code);
  await c.query('ROLLBACK TO s');
}

async function id(sql: string, params: unknown[]): Promise<string> {
  return (await c.query<{ id: string }>(sql, params)).rows[0]!.id;
}

describe('esquema: restricciones del Contrato de BD', () => {
  before(async () => {
    const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
    assert.ok(rows[0]!.db.endsWith('-test'), `Las pruebas solo corren en una BD *-test, no en ${rows[0]!.db}`);
    await migrate(pool);
  });
  after(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    c = await pool.connect();
    await c.query('BEGIN');
    const user = (phone: string, email: string) =>
      id('INSERT INTO users (phone, email, name) VALUES ($1, $2, $3) RETURNING id', [phone, email, 'Test']);
    userA = await user('+56911111111', 'a@test.cl');
    userB = await user('+56922222222', 'b@test.cl');
    customerA = await id(
      'INSERT INTO customers (user_id, name, phone) VALUES ($1, $2, $3) RETURNING id',
      [userA, 'Juan', '+56933333333'],
    );
  });
  afterEach(async () => {
    await c.query('ROLLBACK');
    c.release();
  });

  const newQuote = (extra = '') =>
    id(`INSERT INTO quotes (user_id, customer_id) VALUES ($1, $2) RETURNING id`, [userA, customerA]).then(
      async (q) => {
        if (extra) await c.query(`UPDATE quotes SET ${extra} WHERE id = $1`, [q]);
        return q;
      },
    );

  it('un presupuesto no puede apuntar al cliente de otro usuario', async () => {
    await expectCode('23503', 'INSERT INTO quotes (user_id, customer_id) VALUES ($1, $2)', [userB, customerA]);
  });

  it('FINALIZED exige número, fecha y datos mínimos; con ellos es válido', async () => {
    const q = await newQuote();
    await expectCode('23514', `UPDATE quotes SET doc_status='FINALIZED' WHERE id=$1`, [q]);
    await expectCode('23514', `UPDATE quotes SET doc_status='FINALIZED', number='CP-1', finalized_at=now() WHERE id=$1`, [q]);
    await c.query(`UPDATE quotes SET ${FINALIZED} WHERE id=$1`, [q]);
  });

  it('el estado comercial solo existe en presupuestos finalizados y enviados', async () => {
    const draft = await newQuote();
    await expectCode('23514', `UPDATE quotes SET commercial_status='SENT', sent_at=now() WHERE id=$1`, [draft]);
    const q = await newQuote(FINALIZED);
    await expectCode('23514', `UPDATE quotes SET commercial_status='SENT' WHERE id=$1`, [q]);
    await c.query(`UPDATE quotes SET commercial_status='SENT', sent_at=now() WHERE id=$1`, [q]);
    await expectCode('23514', `UPDATE quotes SET commercial_status='ACCEPTED' WHERE id=$1`, [q]);
    await c.query(`UPDATE quotes SET commercial_status='ACCEPTED', accepted_at=now() WHERE id=$1`, [q]);
  });

  it('total = subtotal - descuento; lat y lng van juntas', async () => {
    const q = await newQuote();
    await expectCode('23514', `UPDATE quotes SET subtotal=1000, discount=100, total=1000 WHERE id=$1`, [q]);
    await c.query(`UPDATE quotes SET subtotal=1000, discount=100, total=900 WHERE id=$1`, [q]);
    await expectCode('23514', `UPDATE quotes SET latitude=-33.4 WHERE id=$1`, [q]);
  });

  it('line_total = round(cantidad × precio), con .5 hacia arriba', async () => {
    const q = await newQuote();
    const add = (qty: string, price: number, total: number, pos: number) =>
      c.query(
        `INSERT INTO quote_items (quote_id, position, description, quantity, unit_price, line_total)
         VALUES ($1, $2, 'i', $3, $4, $5)`,
        [q, pos, qty, price, total],
      );
    await add('1.500', 5000, 7500, 1);
    await add('0.500', 1, 1, 2);
    await c.query('SAVEPOINT s');
    await assert.rejects(add('0.500', 1, 0, 3), (e: { code?: string }) => e.code === '23514');
    await c.query('ROLLBACK TO s');
  });

  it('LOGO y SIGNATURE no cuelgan de un presupuesto; las fotos sí', async () => {
    const q = await newQuote();
    const file = (kind: string, quote: string | null) =>
      `INSERT INTO files (user_id, quote_id, kind, storage_key, mime_type, size_bytes)
       VALUES ('${userA}', ${quote ? `'${quote}'` : 'NULL'}, '${kind}', '${kind}-${Math.random()}', 'image/jpeg', 10)`;
    await expectCode('23514', file('LOGO', q));
    await expectCode('23514', file('PHOTO', null));
    await c.query(file('LOGO', null));
    await c.query(file('PHOTO', q));
  });

  it('sesiones QUOTE_EDIT exigen presupuesto y las USER no lo admiten', async () => {
    const q = await newQuote();
    const ins = `INSERT INTO sessions (user_id, token_hash, scope, quote_id, expires_at)
                 VALUES ($1, $2, $3, $4, now() + interval '1 day')`;
    await expectCode('23514', ins, [userA, 'h1', 'QUOTE_EDIT', null]);
    await expectCode('23514', ins, [userA, 'h2', 'USER', q]);
    await c.query(ins, [userA, 'h3', 'QUOTE_EDIT', q]);
  });
});
