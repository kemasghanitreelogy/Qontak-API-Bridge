import pino from 'pino';

// NODE_ENV is injected by the platform (Vercel sets it to "production"); it is
// not part of the validated app config, so read it directly here.
const nodeEnv = process.env.NODE_ENV ?? 'production';

export const logger = pino({
  level: nodeEnv === 'production' ? 'info' : 'debug',
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
    nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
