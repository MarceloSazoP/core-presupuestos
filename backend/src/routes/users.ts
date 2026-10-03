import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { userController } from '../controllers/UserController';

const router = Router();

router.get('/profile', authMiddleware, (req, res) => userController.getProfile(req, res));
router.put('/profile', authMiddleware, (req, res) => userController.updateProfile(req, res));

export default router;
