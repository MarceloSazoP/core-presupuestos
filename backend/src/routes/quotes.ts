import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { quoteController } from '../controllers/QuoteController';
import { followUpController } from '../controllers/FollowUpController';

const router = Router();

// Quotes
router.get('/', authMiddleware, (req, res) => quoteController.listQuotes(req, res));
router.post('/', authMiddleware, (req, res) => quoteController.createQuote(req, res));
router.get('/:id', authMiddleware, (req, res) => quoteController.getQuote(req, res));
router.put('/:id', authMiddleware, (req, res) => quoteController.updateQuote(req, res));
router.post('/:id/finalize', authMiddleware, (req, res) => quoteController.finalizeQuote(req, res));
router.post('/:id/send', authMiddleware, (req, res) => quoteController.sendQuote(req, res));

// Follow ups
router.get('/:quoteId/follow-ups', authMiddleware, (req, res) => followUpController.listFollowUps(req, res));
router.post('/:quoteId/follow-ups', authMiddleware, (req, res) => followUpController.createFollowUp(req, res));
router.put('/:quoteId/follow-ups/:followUpId', authMiddleware, (req, res) => followUpController.updateFollowUp(req, res));

export default router;
