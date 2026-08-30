import type { Response } from 'express';
import { env } from '../env';
import { TOKEN_COOKIE } from './jwt';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
  });
}
