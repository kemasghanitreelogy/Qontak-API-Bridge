import { createApp } from './app';
import { logger } from './logger';

/**
 * Local development server only. On Vercel the app is served as a serverless
 * function via `api/index.ts`, so this file is not used in production.
 */
const port = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(port, () => {
  logger.info(`🚀 Qontak API Bridge listening on http://localhost:${port}`);
});

// Graceful shutdown so in-flight broadcasts aren't killed mid-request.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down…`);
    server.close(() => process.exit(0));
  });
}
