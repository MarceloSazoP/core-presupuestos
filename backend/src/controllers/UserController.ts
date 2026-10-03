import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { userService } from '../services/UserService';
import { ValidationError } from '../errors/AppError';

export class UserController {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = await userService.findById(req.userId!);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const { name, logo_url, signature_url } = req.body;

      if (!name) {
        throw new ValidationError('Name is required');
      }

      const user = await userService.updateProfile(req.userId!, {
        name,
        logo_url,
        signature_url,
      });

      res.json(user);
    } catch (error) {
      const statusCode = error instanceof ValidationError ? 400 : 500;
      res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }
}

export const userController = new UserController();
