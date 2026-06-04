import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { config } from '../config';

/**
 * Guards the bridge's own endpoints with a static API key sent as `X-Api-Key`.
 * Uses a constant-time comparison to avoid timing side-channels.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header('x-api-key') ?? '';
  const expected = config.BRIDGE_API_KEY;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid X-Api-Key' });
    return;
  }
  next();
}
