import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { customerController } from '../controllers/CustomerController';

const router = Router();

router.get('/', authMiddleware, (req, res) => customerController.listCustomers(req, res));
router.post('/', authMiddleware, (req, res) => customerController.createCustomer(req, res));
router.get('/:id', authMiddleware, (req, res) => customerController.getCustomer(req, res));
router.put('/:id', authMiddleware, (req, res) => customerController.updateCustomer(req, res));
router.delete('/:id', authMiddleware, (req, res) => customerController.deleteCustomer(req, res));

export default router;
