import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { quoteService } from '../services/QuoteService';
import { ValidationError } from '../errors/AppError';

export class QuoteController {
  async listQuotes(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const filters = {
        doc_status: req.query.doc_status as string | undefined,
        commercial_status: req.query.commercial_status as string | undefined,
      };

      const quotes = await quoteService.findByUserId(req.userId!, filters, limit, offset);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async getQuote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await quoteService.findById(id);

      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async createQuote(req: AuthRequest, res: Response) {
    try {
      const { customer_id, title, description, service_location } = req.body;

      if (!customer_id) {
        throw new ValidationError('Customer ID is required');
      }

      const quote = await quoteService.createQuote(req.userId!, customer_id, {
        title,
        description,
        service_location,
      });

      res.status(201).json(quote);
    } catch (error) {
      const statusCode = error instanceof ValidationError ? 400 : 500;
      res.status(statusCode).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async updateQuote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await quoteService.findById(id);

      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await quoteService.update(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async finalizeQuote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await quoteService.findById(id);

      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await quoteService.finalizeQuote(id, req.userId!);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }

  async sendQuote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const quote = await quoteService.findById(id);

      if (quote.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await quoteService.sendQuote(id, req.userId!);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  }
}

export const quoteController = new QuoteController();
