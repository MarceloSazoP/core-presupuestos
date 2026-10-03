import { query } from '../config/database';
import { NotFoundError } from '../errors/AppError';

export abstract class BaseService {
  protected tableName: string = '';

  async findById(id: string) {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`${this.tableName} not found`);
    }

    return result.rows[0];
  }

  async findAll(userId: string, limit = 20, offset = 0) {
    const result = await query(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1 LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async create(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return result.rows[0];
  }

  async update(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await query(
      `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`${this.tableName} not found`);
    }

    return result.rows[0];
  }

  async delete(id: string) {
    await query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }
}
