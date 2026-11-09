import { Pool } from 'pg';
import { PgRepository } from './postgres.js';
import { runMigrations } from './migrate.js';

export * from './types.js';
export { MemoryRepository } from './memory.js';
export { PgRepository } from './postgres.js';
export { runMigrations, listMigrationFiles, MIGRATIONS_DIR } from './migrate.js';
export { stripUndefined } from './normalize.js';

/** Connects to Postgres, optionally runs forward migrations, and returns a repository. */
export async function createPostgresRepository(
  connectionString: string,
  options: { migrate?: boolean } = {},
): Promise<{ repo: PgRepository; pool: Pool }> {
  const pool = new Pool({ connectionString });
  if (options.migrate !== false) await runMigrations(pool);
  return { repo: PgRepository.fromPool(pool), pool };
}
