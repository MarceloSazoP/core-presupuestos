import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { followUpService } from '../services/FollowUpService';
import { quoteService } from '../services/QuoteService';
import { ValidationError } from '../errors/AppError';

export class FollowUpController {
  async listFollowUps(req: AuthRequest, res: Response) {
    try {
      const { quoteId } = req.params;

      // Verificar que el presupuesto pertenezca al usuario
      const quote = await quoteService.findById(quoteId);
      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const followUps = await followUpService.findByQuoteId(quoteId);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async getPendingFollowUps(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const followUps = await followUpService.getFollowUpsPending(req.userId!, limit);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async createFollowUp(req: AuthRequest, res: Response) {
    try {
      const { quoteId } = req.params;
      const { next_contact_date, notes, contact_method } = req.body;

      // Verificar que el presupuesto pertenezca al usuario
      const quote = await quoteService.findById(quoteId);
      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (!next_contact_date) {
        throw new ValidationError('Next contact date is required');
      }

      const followUp = await followUpService.createFollowUp(quoteId, req.userId!, {
        next_contact_date,
        notes,
        contact_method,
      });

      res.status(201).json(followUp);
    } catch (error) {
      const statusCode = error instanceof ValidationError ? 400 : 500;
      res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async updateFollowUp(req: AuthRequest, res: Response) {
    try {
      const { quoteId, followUpId } = req.params;

      // Verificar que el presupuesto pertenezca al usuario
      const quote = await quoteService.findById(quoteId);
      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await followUpService.update(followUpId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }
}

export const followUpController = new FollowUpController();
