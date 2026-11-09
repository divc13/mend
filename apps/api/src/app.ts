import Fastify, { type FastifyInstance } from 'fastify';
import { MemoryRepository, PgRepository, type Repository } from '@mend/db';
import type { AppConfig } from './config.js';
import { loadConfig } from './config.js';
import { apiErrorBody, normalizeError } from './errors.js';
import type { AppDeps } from './context.js';
import { ChainCommandService, createChainAdapter, systemClock, type Clock } from './services/chain.js';
import { createEvidenceStore, type PrivateEvidenceStore } from './services/evidence.js';
import { createIntentsAdapter, type IntentsAdapter, type IntentsCapabilities } from './services/intents.js';
import { createTriageAdapter, type TriageAdapter } from './services/triage.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAssetRoutes } from './routes/assets.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerWorkOrderRoutes } from './routes/work-orders.js';
import { registerEvidenceRoutes } from './routes/evidence.js';
import { registerAdminRoutes } from './routes/admin.js';

export interface BuildAppOptions {
  config?: AppConfig;
  repo?: Repository;
  evidenceStore?: PrivateEvidenceStore;
  commands?: ChainCommandService;
  triage?: TriageAdapter;
  intents?: IntentsAdapter;
  clock?: Clock;
  logger?: boolean;
}

export interface BuiltApp {
  app: FastifyInstance;
  deps: AppDeps;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<BuiltApp> {
  const config = options.config ?? loadConfig();
  const repo = options.repo
    ?? (config.databaseUrl ? PgRepository.fromConnectionString(config.databaseUrl) : new MemoryRepository());
  const evidenceStore = options.evidenceStore ?? createEvidenceStore(config.evidence);
  const commands = options.commands ?? new ChainCommandService(createChainAdapter(config), config, options.clock ?? systemClock);
  const triage = options.triage ?? createTriageAdapter(config.triage);
  const intents = options.intents ?? createIntentsAdapter(config.intents);
  const clock = options.clock ?? systemClock;

  const deps: AppDeps = {
    config,
    repo,
    evidenceStore,
    commands,
    triage,
    intents,
    clock,
    triageInfo: () => ({
      provider: triage.provider,
      available: triage.available,
      ...(triage.unavailableReason ? { reason: triage.unavailableReason } : {}),
    }),
    intentsCapabilities: (): IntentsCapabilities => ({
      provider: intents.provider,
      available: intents.available,
      mainnetOnly: true,
      ...(intents.unavailableReason ? { reason: intents.unavailableReason } : {}),
      disclaimer: 'NEAR Intents operates on mainnet only. This service exposes capability and status metadata; it does not initiate transfers.',
    }),
  };

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: config.evidence.maxBytes * 2,
    requestTimeout: 30_000,
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-mend-mode', config.mode);
    reply.header('x-mend-service', config.serviceName);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);
    if (normalized.internal) request.log.error({ err: error }, 'unhandled API error');
    return reply.status(normalized.status).send(normalized.body);
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(apiErrorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`));
  });

  await registerPublicRoutes(app, deps);
  await registerAssetRoutes(app, deps);
  await registerReportRoutes(app, deps);
  await registerWorkOrderRoutes(app, deps);
  await registerEvidenceRoutes(app, deps);
  await registerAdminRoutes(app, deps);

  app.addHook('onClose', async () => {
    await repo.close();
  });

  return { app, deps };
}
