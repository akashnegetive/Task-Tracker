import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { pool } from '../src/db';

export const app = createApp();

/** Wipe all data between tests (keeps schema + _migrations). */
export async function truncateAll(): Promise<void> {
  await pool.query(`
    TRUNCATE task_events, overdue_dismissals, task_dependencies, task_assignees,
             tasks, project_memberships, projects, users RESTART IDENTITY CASCADE;
  `);
}

/** Registers a user and returns a cookie-carrying agent + the user object. */
export async function registerAgent(
  email: string,
  name: string,
): Promise<{ agent: TestAgent; user: { id: string; role: string; email: string } }> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ email, password: 'password123', name });
  return { agent, user: res.body.user };
}

export { request };
