import { query } from '../config/database';
import { Quote } from '../types';
import { BaseService } from './BaseService';
import { generatePublicAccessKey, generateEditAccessKey } from '../utils/crypto';

export class QuoteService extends BaseService {
  protected tableName = 'quotes';

  async findByUserId(
    userId: string,
    filters?: { doc_status?: string; commercial_status?: string },
    limit = 20,
    offset = 0
  ) {
    let sql = 'SELECT * FROM quotes WHERE user_id = $1';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (filters?.doc_status) {
      sql += ` AND doc_status = $${paramIndex}`;
      params.push(filters.doc_status);
      paramIndex++;
    }

    if (filters?.commercial_status) {
      sql += ` AND commercial_status = $${paramIndex}`;
      params.push(filters.commercial_status);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    const countSql = 'SELECT COUNT(*) FROM quotes WHERE user_id = $1' +
      (filters?.doc_status ? ` AND doc_status = $2` : '') +
      (filters?.commercial_status ? ` AND commercial_status = $${filters.doc_status ? 3 : 2}` : '');

    const countParams = [userId];
    if (filters?.doc_status) countParams.push(filters.doc_status);
    if (filters?.commercial_status) countParams.push(filters.commercial_status);

    const countResult = await query(countSql, countParams);

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async createQuote(userId: string, customerId: string, data: Partial<Quote>): Promise<Quote> {
    const publicAccessKey = generatePublicAccessKey();
    const editAccessKey = generateEditAccessKey();

    return this.create({
      user_id: userId,
      customer_id: customerId,
      title: data.title,
      description: data.description,
      service_location: data.service_location,
      public_access_key: publicAccessKey,
      edit_access_key: editAccessKey,
      doc_status: 'DRAFT',
      commercial_status: 'NONE',
    });
  }

  async finalizeQuote(quoteId: string, userId: string): Promise<Quote> {
    return this.update(quoteId, {
      doc_status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
    });
  }

  async sendQuote(quoteId: string, userId: string): Promise<Quote> {
    return this.update(quoteId, {
      commercial_status: 'SENT',
      sent_at: new Date().toISOString(),
    });
  }
}

export const quoteService = new QuoteService();
