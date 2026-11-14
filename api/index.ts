/**
 * Vercel Functions entrypoint for the MEND Fastify API.
 *
 * The Fastify instance is built once per warm function and reused across
 * invocations. Vercel hands us Node's raw IncomingMessage/ServerResponse, so we
 * inject them into Fastify's own HTTP server instead of calling listen().
 *
 * Deployment-only file: application code stays in apps/api/src.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import {
  PgRepository,
  createPostgresRepository,
  runMigrations,
  type Repository,
} from '@mend/db';
import { buildApp } from '../apps/api/src/app.js';
import { assertProductionGuards, loadConfig } from '../apps/api/src/config.js';

let readyApp: Promise<FastifyInstance> | undefined;

/**
 * Locate the SQL migrations that @mend/db reads at runtime. They are copied
 * into the function bundle by scripts/vercel/build-output.mjs; the first
 * candidate is relative to the function root (/var/task on Vercel).
 */
async function resolveMigrationsDir(): Promise<string | undefined> {
  const candidates: string[] = [];
  if (process.env.MEND_MIGRATIONS_DIR) candidates.push(process.env.MEND_MIGRATIONS_DIR);
  candidates.push(path.join(process.cwd(), 'packages/db/migrations'));
  if (typeof __dirname !== 'undefined') {
    candidates.push(path.resolve(__dirname, '..', 'packages/db/migrations'));
  }
  for (const candidate of candidates) {
    try {
      const entries = await readdir(candidate);
      if (entries.some((entry) => entry.endsWith('.sql'))) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

async function createRepository(databaseUrl: string): Promise<Repository> {
  // Neon's pooled endpoint (PgBouncer, transaction mode) can leak session-level
  // advisory locks across clients. Migrations take one, so run them through the
  // unpooled URL when Neon provides it; the repository keeps using the pooled
  // URL that is appropriate for serverless traffic.
  const migrationUrl = process.env.DATABASE_URL_UNPOOLED || databaseUrl;
  const migrationsDir = await resolveMigrationsDir();
  if (!migrationsDir) {
    // Let @mend/db use its own default resolution as a last resort.
    const connected = await createPostgresRepository(migrationUrl);
    return connected.repo;
  }

  const migrationPool = new Pool({ connectionString: migrationUrl, max: 1 });
  try {
    await runMigrations(migrationPool, { dir: migrationsDir });
  } finally {
    await migrationPool.end().catch(() => undefined);
  }
  return PgRepository.fromPool(new Pool({ connectionString: databaseUrl, max: 5 }));
}

async function initApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  assertProductionGuards(config);
  const repo = config.databaseUrl ? await createRepository(config.databaseUrl) : undefined;
  const { app } = await buildApp({ config, ...(repo ? { repo } : {}) });
  await app.ready();
  return app;
}

function getApp(): Promise<FastifyInstance> {
  readyApp ??= initApp().catch((error: unknown) => {
    // Allow the next invocation to retry a failed cold start (for example a
    // transient Neon connection error).
    readyApp = undefined;
    throw error;
  });
  return readyApp;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (error) {
    console.error('[mend-api] failed to initialize', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'MEND_API_BOOT_FAILED' }));
    }
  }
}
