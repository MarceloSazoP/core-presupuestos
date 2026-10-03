import { query } from '../config/database';
import { User } from '../types';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { BaseService } from './BaseService';

export class UserService extends BaseService {
  protected tableName = 'users';

  async findByPhone(phone: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async createUser(phone: string, email: string, name: string): Promise<User> {
    const existingPhone = await this.findByPhone(phone);
    if (existingPhone) {
      throw new ValidationError('Phone already exists');
    }

    const existingEmail = await this.findByEmail(email);
    if (existingEmail) {
      throw new ValidationError('Email already exists');
    }

    return this.create({
      phone,
      email,
      name,
    });
  }

  async updateProfile(
    userId: string,
    data: Partial<User>
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.update(userId, {
      name: data.name || user.name,
      logo_url: data.logo_url || user.logo_url,
      signature_url: data.signature_url || user.signature_url,
    });
  }
}

export const userService = new UserService();
