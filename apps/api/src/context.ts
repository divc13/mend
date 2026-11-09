import type { Repository } from '@mend/db';
import type { AppConfig } from './config.js';
import type { ChainCommandService, Clock } from './services/chain.js';
import type { PrivateEvidenceStore } from './services/evidence.js';
import type { IntentsAdapter, IntentsCapabilities } from './services/intents.js';
import type { TriageAdapter } from './services/triage.js';
import type { KillSwitchService } from './services/kill-switch.js';

export interface AppDeps {
  config: AppConfig;
  repo: Repository;
  evidenceStore: PrivateEvidenceStore;
  commands: ChainCommandService;
  triage: TriageAdapter;
  intents: IntentsAdapter;
  clock: Clock;
  killSwitch: KillSwitchService;
  triageInfo(): {
    provider: string;
    available: boolean;
    model?: string;
    apiKeyConfigured: boolean;
    verificationPolicy: string;
    reason?: string;
  };
  intentsCapabilities(): IntentsCapabilities;
}
