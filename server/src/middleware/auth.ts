import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { TOKEN_COOKIE, verifyToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Authenticates the request from the JWT (httpOnly cookie or Bearer header),
 * loads the *current* user (so role changes take effect immediately), and
 * attaches it as req.user. Rejects with 401 if anything is off.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();

    let userId: string;
    try {
      userId = verifyToken(token).sub;
    } catch {
      throw unauthorized('Invalid or expired session');
    }

    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'role'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) throw unauthorized('Account no longer exists');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
