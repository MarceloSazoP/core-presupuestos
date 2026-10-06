import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from './config';

// Montos y cantidades caben en un número de JS (el contrato limita todo muy por debajo de 2^53); fechas como texto YYYY-MM-DD.
types.setTypeParser(types.builtins.INT8, Number);
types.setTypeParser(types.builtins.NUMERIC, Number);
types.setTypeParser(types.builtins.DATE, (v) => v);

export const pool = new Pool({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
