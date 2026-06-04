import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

/**
 * Validates `req.body` against a Zod schema. On success the parsed (and
 * defaulted/transformed) value replaces `req.body`; on failure returns 422 with
 * a flat list of field errors.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: 'validation_failed',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.') || '(root)',
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
