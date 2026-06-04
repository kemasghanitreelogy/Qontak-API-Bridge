import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  // Never leak credentials into logs.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'headers.authorization',
      '*.MEKARI_CLIENT_SECRET',
      '*.BRIDGE_API_KEY',
    ],
    remove: true,
  },
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
