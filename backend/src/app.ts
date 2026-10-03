import express, { type Request, type Response } from 'express';
import { config } from './config';
import { query } from './db';
import { AppError, errorHandler } from './errors';
import { sendCode as defaultSendCode, type SendCode } from './lib/deliver';
import { accessRoutes } from './modules/access/routes';
import { authRoutes } from './modules/auth/routes';
import { customerRoutes } from './modules/customers/routes';
import { meRoutes } from './modules/me/routes';
import { quoteRoutes } from './modules/quotes/routes';

// `deps` existe para las pruebas: se inyecta el envío de códigos y el límite por IP.
export function createApp(deps: { sendCode?: SendCode; ipStartLimit?: number; ipExchangeLimit?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY); // 0 = sin proxy; configurar según el hosting para que el límite use la IP real
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health/db', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'down' });
    }
  });

  const api = express.Router();
  api.use('/auth', authRoutes(deps.sendCode ?? defaultSendCode, deps.ipStartLimit));
  api.use('/me', meRoutes());
  api.use('/customers', customerRoutes());
  api.use('/quotes', quoteRoutes());
  api.use('/access', accessRoutes(deps.ipExchangeLimit));
  app.use('/api/v1', api);

  app.use((_req: Request, _res: Response, next) => next(new AppError(404, 'NOT_FOUND', 'No encontrado')));
  app.use(errorHandler);
  return app;
}
