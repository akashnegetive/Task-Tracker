/**
 * Minimal, transparent SQL migration runner.
 *
 * Applies every *.sql file in ../../migrations (sorted by name) that hasn't been
 * applied yet, each inside its own transaction, and records it in _migrations.
 *
 *   tsx src/db/migrate.ts up      apply pending migrations
 *   tsx src/db/migrate.ts reset   drop the public schema and re-apply everything
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { env } from '../env';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM _migrations');
  return new Set(rows.map((r) => r.name));
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function up(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  const done = await appliedMigrations(pool);
  const pending = migrationFiles().filter((f) => !done.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}

async function reset(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('Schema reset.');
  await up(pool);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const pool = new Pool({ connectionString: env.databaseUrl });
  try {
    if (command === 'up') await up(pool);
    else if (command === 'reset') await reset(pool);
    else {
      console.error(`Unknown command: ${command}. Use "up" or "reset".`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
