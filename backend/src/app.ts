import express, { type Request, type Response } from 'express';
import { googleLugares, type Lugares } from './lib/places';
import { placesRoutes } from './modules/places/routes';
import { config } from './config';
import { query } from './db';
import { AppError, errorHandler } from './errors';
import { cors } from './lib/cors';
import { sendCode as defaultSendCode, type SendCode } from './lib/deliver';
import { sendMail as defaultSendMail, type SendMail } from './lib/mail';
import { accessRoutes } from './modules/access/routes';
import { authRoutes } from './modules/auth/routes';
import { customerRoutes } from './modules/customers/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { fileRoutes } from './modules/files/routes';
import { PAISES } from './lib/paises';
import { meRoutes } from './modules/me/routes';
import { publicRoutes } from './modules/public/routes';
import { quoteRoutes } from './modules/quotes/routes';

// `deps` existe para las pruebas: se inyecta el envío de códigos y el límite por IP.
export function createApp(deps: { places?: Lugares; sendCode?: SendCode; sendMail?: SendMail; ipStartLimit?: number; ipExchangeLimit?: number; mailLimit?: number; publicLimit?: number; corsOrigins?: string[] } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY); // 0 = sin proxy; configurar según el hosting para que el límite use la IP real
  // Solo en desarrollo: una línea por pedido (método, ruta sin parámetros de consulta, estado, tiempo). Nunca cabeceras ni
  // cuerpos: así se ve qué llega desde el teléfono sin exponer tokens ni códigos.
  if (config.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      const t0 = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - t0}ms`));
      next();
    });
  }
  app.use(cors(deps.corsOrigins ?? config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)));
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

  const ipLimite = config.AUTH_IP_LIMIT_PER_HOUR ?? (config.NODE_ENV === 'development' ? 1000 : 10);
  const api = express.Router();
  const correo = deps.sendMail ?? defaultSendMail;
  api.use('/auth', authRoutes(deps.sendCode ?? defaultSendCode, deps.ipStartLimit ?? ipLimite, correo, ipLimite));
  api.get('/countries', (_req, res) => void res.json(PAISES)); // sin sesión: se usa para elegir el país
  api.use('/me', meRoutes(correo));
  api.use('/customers', customerRoutes());
  api.use('/quotes', quoteRoutes({ sendMail: deps.sendMail ?? defaultSendMail, mailLimit: deps.mailLimit }));
  api.use('/places', placesRoutes(deps.places ?? googleLugares));
  api.use('/files', fileRoutes());
  api.use('/dashboard', dashboardRoutes());
  api.use('/access', accessRoutes(deps.ipExchangeLimit));
  api.use('/public', publicRoutes(deps.publicLimit));
  app.use('/api/v1', api);

  app.use((_req: Request, _res: Response, next) => next(new AppError(404, 'NOT_FOUND', 'No encontrado')));
  app.use(errorHandler);
  return app;
}
