import type { Role } from '../db/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      // Populated by project-membership guards to avoid re-querying downstream.
      projectRole?: 'MANAGER' | 'MEMBER';
    }
  }
}

export {};
