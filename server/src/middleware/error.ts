import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

/** 404 for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

/** Central error handler — turns thrown errors into a consistent JSON shape. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Postgres unique-violation → 409 (defensive; services usually pre-check).
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
