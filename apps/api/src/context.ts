import type { Repository } from '@mend/db';
import type { AppConfig } from './config.js';
import type { ChainCommandService, Clock } from './services/chain.js';
import type { PrivateEvidenceStore } from './services/evidence.js';
import type { IntentsAdapter, IntentsCapabilities } from './services/intents.js';
import type { TriageAdapter } from './services/triage.js';

export interface AppDeps {
  config: AppConfig;
  repo: Repository;
  evidenceStore: PrivateEvidenceStore;
  commands: ChainCommandService;
  triage: TriageAdapter;
  intents: IntentsAdapter;
  clock: Clock;
  triageInfo(): { provider: string; available: boolean; reason?: string };
  intentsCapabilities(): IntentsCapabilities;
}
