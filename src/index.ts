import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`🚀 Qontak API Bridge listening on http://localhost:${config.PORT}`);
});

// Graceful shutdown so in-flight broadcasts aren't killed mid-request.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down…`);
    server.close(() => process.exit(0));
  });
}
