import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ err: message }, 'Unhandled error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error', message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not_found' });
}
