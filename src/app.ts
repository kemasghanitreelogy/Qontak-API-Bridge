import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './logger';
import { requireApiKey } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';
import { whatsappRouter } from './routes/whatsapp';

export function createApp() {
  const app = express();

  // Behind Vercel's proxy: trust the first proxy hop so req.ip / rate limiting
  // use the real client IP from X-Forwarded-For.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  // Liveness probe — no auth.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Throttle the API surface (defence in depth on top of the API key).
  const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests, slow down.' },
  });

  // Rate limit + API key on the whole /api surface, then mount the router.
  app.use('/api', apiLimiter, requireApiKey);
  app.use('/api/whatsapp', whatsappRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
