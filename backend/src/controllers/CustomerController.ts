import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { customerService } from '../services/CustomerService';
import { ValidationError } from '../errors/AppError';

export class CustomerController {
  async listCustomers(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const customers = await customerService.findByUserId(req.userId!, limit, offset);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async getCustomer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const customer = await customerService.findById(id);

      // Verificar que pertenezca al usuario autenticado
      if (customer.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async createCustomer(req: AuthRequest, res: Response) {
    try {
      const { name, phone, email, address, notes } = req.body;

      if (!name) {
        throw new ValidationError('Name is required');
      }

      const customer = await customerService.createCustomer(req.userId!, {
        name,
        phone,
        email,
        address,
        notes,
      });

      res.status(201).json(customer);
    } catch (error) {
      const statusCode = error instanceof ValidationError ? 400 : 500;
      res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async updateCustomer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const customer = await customerService.findById(id);

      if (customer.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await customerService.update(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async deleteCustomer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const customer = await customerService.findById(id);

      if (customer.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await customerService.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }
}

export const customerController = new CustomerController();
