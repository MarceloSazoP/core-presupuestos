import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, it } from 'node:test';
import type { PoolClient } from 'pg';
import { migrate } from '../scripts/migrate';
import { pool } from '../src/db';

const FINALIZED = `doc_status='FINALIZED', number='CP-2026-0001', finalized_at=now(),
                   service_description='x', validity_days=15`;

// ID corto aleatorio con el alfabeto Crockford base32 del contrato (sin I, L, O, U).
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const shortId = () => Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");

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
    id(`INSERT INTO quotes (user_id, customer_id, short_id) VALUES ($1, $2, $3) RETURNING id`, [userA, customerA, shortId()]).then(
      async (q) => {
        if (extra) await c.query(`UPDATE quotes SET ${extra} WHERE id = $1`, [q]);
        return q;
      },
    );

  it('un presupuesto no puede apuntar al cliente de otro usuario', async () => {
    await expectCode('23503', 'INSERT INTO quotes (user_id, customer_id, short_id) VALUES ($1, $2, $3)', [userB, customerA, shortId()]);
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

  it('la unidad de medida del ítem vale "un" por defecto y solo admite códigos cortos en minúscula', async () => {
    const q = await newQuote();
    await c.query(
      `INSERT INTO quote_items (quote_id, position, description, quantity, unit_price, line_total)
       VALUES ($1, 1, 'i', 1, 100, 100)`,
      [q],
    );
    const { rows } = await c.query<{ unit: string }>('SELECT unit FROM quote_items WHERE quote_id = $1', [q]);
    assert.equal(rows[0]!.unit, 'un');

    const conUnidad = `INSERT INTO quote_items (quote_id, position, description, quantity, unit_price, line_total, unit)
                       VALUES ($1, $2, 'i', 1, 100, 100, $3)`;
    await c.query(conUnidad, [q, 2, 'm2']);
    await expectCode('23514', conUnidad, [q, 3, 'M²']);
    await expectCode('23514', conUnidad, [q, 4, '']);
  });

  it('sesiones QUOTE_CODE exigen presupuesto y las USER no lo admiten', async () => {
    const q = await newQuote();
    const ins = `INSERT INTO sessions (user_id, token_hash, scope, quote_id, expires_at)
                 VALUES ($1, $2, $3, $4, now() + interval '1 day')`;
    await expectCode('23514', ins, [userA, 'h1', 'QUOTE_CODE', null]);
    await expectCode('23514', ins, [userA, 'h2', 'USER', q]);
    await expectCode('23514', ins, [userA, 'h4', 'QUOTE_EDIT', q]); // el scope viejo ya no existe
    await c.query(ins, [userA, 'h3', 'QUOTE_CODE', q]);
  });

  it('short_id: solo alfabeto Crockford de 6 caracteres y sin repetirse', async () => {
    const ins = 'INSERT INTO quotes (user_id, customer_id, short_id) VALUES ($1, $2, $3)';
    await c.query(ins, [userA, customerA, '7K4M2Q']);
    await expectCode('23505', ins, [userA, customerA, '7K4M2Q']);
    for (const malo of ['7K4M2', '7K4M2QQ', '7k4m2q', '7K4M2I', '7K4M2L', '7K4M2O', '7K4M2U', '']) {
      await expectCode('23514', ins, [userA, customerA, malo]);
    }
  });

  it('quote_access: CODE exige code_hash, PUBLIC exige token y EDIT ya no existe', async () => {
    const q = await newQuote();
    const ins = 'INSERT INTO quote_access (quote_id, kind, token, code_hash) VALUES ($1, $2, $3, $4)';
    await expectCode('23514', ins, [q, 'CODE', null, null]);
    await expectCode('23514', ins, [q, 'PUBLIC', null, null]);
    await expectCode('23514', ins, [q, 'CODE', 'tok', '$argon2id$x']);
    await expectCode('23514', ins, [q, 'EDIT', null, '$argon2id$x']);
    await c.query(ins, [q, 'CODE', null, '$argon2id$x']);
    await expectCode('23505', ins, [q, 'CODE', null, '$argon2id$y']); // un solo código activo por presupuesto
  });
});
