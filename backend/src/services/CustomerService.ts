import { query } from '../config/database';
import { Customer } from '../types';
import { BaseService } from './BaseService';

export class CustomerService extends BaseService {
  protected tableName = 'customers';

  async findByUserId(userId: string, limit = 20, offset = 0) {
    const result = await query(
      'SELECT * FROM customers WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM customers WHERE user_id = $1',
      [userId]
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async createCustomer(userId: string, data: Partial<Customer>): Promise<Customer> {
    return this.create({
      user_id: userId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
    });
  }
}

export const customerService = new CustomerService();
