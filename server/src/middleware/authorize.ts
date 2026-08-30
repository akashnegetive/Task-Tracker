import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../db/types';
import { forbidden, unauthorized } from '../lib/errors';

/** Requires the authenticated user to hold one of the given global roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}
