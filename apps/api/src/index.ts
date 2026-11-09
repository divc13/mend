import { createPostgresRepository, type Repository } from '@mend/db';
import { buildApp } from './app.js';
import { assertProductionGuards, loadConfig } from './config.js';

const config = loadConfig();
assertProductionGuards(config);

let repo: Repository | undefined;
if (config.databaseUrl) {
  const connected = await createPostgresRepository(config.databaseUrl);
  repo = connected.repo;
}

const { app } = await buildApp({ config, ...(repo ? { repo } : {}), logger: true });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    {
      mode: config.mode,
      repository: repo?.kind ?? 'memory',
      chainAdapter: config.chain.adapter,
      evidenceAdapter: config.evidence.adapter,
      intentsEnabled: config.intents.enabled,
    },
    'MEND API listening',
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
