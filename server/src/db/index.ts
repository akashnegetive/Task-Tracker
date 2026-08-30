import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { env } from '../env';
import type { Database } from './types';

/** Shared pg connection pool. */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

/** Typed query builder used across the app. */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
