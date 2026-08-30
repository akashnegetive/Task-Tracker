import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { signToken } from '../../lib/jwt';
import { setAuthCookie, clearAuthCookie } from '../../lib/cookies';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.register(req.body);
    setAuthCookie(res, signToken(user.id));
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.login(req.body);
    setAuthCookie(res, signToken(user.id));
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export function me(req: Request, res: Response): void {
  res.json({ user: req.user });
}
