import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/** Validates req.body against a zod schema, replacing it with the parsed value. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(badRequest('Validation failed', err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}

/** Validates req.query, storing the parsed result on res.locals.query (req.query is read-only). */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(badRequest('Invalid query parameters', err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
