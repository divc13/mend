import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Pool } from 'pg';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Forward-only migrations. Each file runs once inside a transaction and is
 * recorded in schema_migrations. A Postgres advisory lock prevents two API or
 * indexer processes from migrating at the same time.
 */
export async function runMigrations(pool: Pool, options: { dir?: string } = {}): Promise<MigrationResult> {
  const dir = options.dir ?? MIGRATIONS_DIR;
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    );
    const entries = (await readdir(dir))
      .filter((name) => name.endsWith('.sql') && !name.endsWith('.down.sql'))
      .sort();
    const applied: string[] = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [entry]);
      if (existing.rows.length > 0) {
        skipped.push(entry);
        continue;
      }
      const sql = await readFile(path.join(dir, entry), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [entry]);
        await client.query('COMMIT');
        applied.push(entry);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${entry} failed: ${(error as Error).message}`, { cause: error });
      }
    }
    return { applied, skipped };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(727001)');
    } finally {
      client.release();
    }
  }
}

export async function listMigrationFiles(dir = MIGRATIONS_DIR): Promise<string[]> {
  return (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
}
