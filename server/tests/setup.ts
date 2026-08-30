import { execSync } from 'node:child_process';
import { beforeAll, afterAll } from 'vitest';
import { pool } from '../src/db';

beforeAll(() => {
  // Rebuild the schema fresh for the suite (uses DATABASE_URL from vitest env).
  execSync('tsx src/db/migrate.ts reset', { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
});

afterAll(async () => {
  await pool.end();
});
