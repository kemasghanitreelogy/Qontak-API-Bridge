import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { requireApiKey } from '../src/middleware/auth';
import { validateBody } from '../src/middleware/validate';
import { errorHandler, notFound } from '../src/middleware/errorHandler';

function mockRes() {
  const res = {} as Response & { body?: unknown; statusCode?: number; headersSent: boolean };
  res.headersSent = false;
  res.status = vi.fn().mockImplementation((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn().mockImplementation((b: unknown) => {
    res.body = b;
    return res;
  });
  return res;
}

describe('requireApiKey', () => {
  const headerFor = (key?: string) =>
    ({ header: (_: string) => key } as unknown as Request);

  it('calls next() for the correct key', () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireApiKey(headerFor('test-bridge-key-1234567890'), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a missing key with 401', () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireApiKey(headerFor(undefined), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a wrong key (same length) with 401', () => {
    const next = vi.fn() as NextFunction;
    const res = mockRes();
    requireApiKey(headerFor('XXXXXXXXXXXXXXXXXXXXXXXXXX'), res, next);
    expect(res.statusCode).toBe(401);
  });
});

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('passes valid body and replaces req.body with parsed data', () => {
    const req = { body: { name: 'ok', extra: 'stripped' } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'ok' });
  });

  it('returns 422 with field details on invalid body', () => {
    const req = { body: {} } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    validateBody(schema)(req, res, next);
    expect(res.statusCode).toBe(422);
    expect(next).not.toHaveBeenCalled();
    expect((res.body as { error: string }).error).toBe('validation_failed');
  });

  it('labels root-level errors as (root)', () => {
    const rootSchema = z.string();
    const req = { body: 123 } as Request;
    const res = mockRes();
    validateBody(rootSchema)(req, res, vi.fn() as NextFunction);
    const details = (res.body as { details: Array<{ field: string }> }).details;
    expect(details[0].field).toBe('(root)');
  });
});

describe('errorHandler / notFound', () => {
  it('returns 500 with the error message', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), {} as Request, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(500);
    expect((res.body as { message: string }).message).toBe('boom');
  });

  it('handles non-Error throwables', () => {
    const res = mockRes();
    errorHandler('weird', {} as Request, res, vi.fn() as NextFunction);
    expect((res.body as { message: string }).message).toBe('Unknown error');
  });

  it('does nothing if headers already sent', () => {
    const res = mockRes();
    res.headersSent = true;
    errorHandler(new Error('x'), {} as Request, res, vi.fn() as NextFunction);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('notFound returns 404', () => {
    const res = mockRes();
    notFound({} as Request, res);
    expect(res.statusCode).toBe(404);
  });
});
