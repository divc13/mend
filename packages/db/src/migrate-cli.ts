import { Pool } from 'pg';
import { runMigrations } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set; refusing to migrate');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  const result = await runMigrations(pool);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
