import { MemoryRepository, createPostgresRepository, type Repository } from '@mend/db';
import { MendError } from '@mend/protocol';
import { createEventSource } from './events.js';
import { HubIndexer } from './indexer.js';

const source = createEventSource();
let repo: Repository;
if (process.env.DATABASE_URL) {
  const connected = await createPostgresRepository(process.env.DATABASE_URL);
  repo = connected.repo;
} else {
  repo = new MemoryRepository();
}

const indexer = new HubIndexer(repo, source);
const rebuild = ['1', 'true', 'yes'].includes((process.env.INDEXER_REBUILD ?? '').toLowerCase());

try {
  const result = rebuild ? await indexer.rebuild() : await indexer.sync();
  console.log(JSON.stringify({
    status: 'ok',
    repository: repo.kind,
    sourceInfo: indexer.sourceInfo,
    rebuild,
    ...result,
  }, null, 2));
} catch (error) {
  const known = error instanceof MendError;
  console.log(JSON.stringify({
    status: 'unavailable',
    repository: repo.kind,
    source: indexer.sourceInfo,
    reason: known ? error.message : (error as Error).message,
    honestState: 'No events were invented and no public state was changed by an unavailable source.',
  }, null, 2));
  process.exitCode = 2;
} finally {
  await repo.close();
}
