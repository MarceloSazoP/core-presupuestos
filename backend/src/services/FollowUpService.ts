import { query } from '../config/database';
import { FollowUp } from '../types';
import { BaseService } from './BaseService';

export class FollowUpService extends BaseService {
  protected tableName = 'follow_ups';

  async findByQuoteId(quoteId: string) {
    const result = await query(
      'SELECT * FROM follow_ups WHERE quote_id = $1 ORDER BY created_at DESC',
      [quoteId]
    );
    return result.rows;
  }

  async createFollowUp(
    quoteId: string,
    userId: string,
    data: Partial<FollowUp>
  ): Promise<FollowUp> {
    return this.create({
      quote_id: quoteId,
      user_id: userId,
      next_contact_date: data.next_contact_date,
      notes: data.notes,
      contact_method: data.contact_method,
    });
  }

  async getFollowUpsPending(userId: string, limit = 20) {
    const result = await query(
      `SELECT fu.*, q.quote_number, c.name as customer_name
       FROM follow_ups fu
       JOIN quotes q ON fu.quote_id = q.id
       JOIN customers c ON q.customer_id = c.id
       WHERE fu.user_id = $1 AND fu.next_contact_date <= CURRENT_DATE
       ORDER BY fu.next_contact_date ASC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
}

export const followUpService = new FollowUpService();
