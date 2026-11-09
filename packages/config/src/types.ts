import type { MainnetApproval } from './mainnet.js';
import type { MendMode } from './mode.js';

export type EvidenceAdapterKind = 'local' | 's3' | 'unavailable';

export interface EvidenceSettings {
  adapter: EvidenceAdapterKind;
  /** Private server-side directory. Never returned by `publicConfig`. */
  dir: string;
  maxBytes: number;
  signedUrlTtlSeconds: number;
  /** Server-only HMAC secret. Never logged, serialized or sent to a browser. */
  signingSecret?: string;
}

export interface FeatureFlags {
  intents: boolean;
  agentMarket: boolean;
  aiTriage: boolean;
  demoReset: boolean;
}

export interface MendConfig {
  mode: MendMode;
  nodeEnv: string;
  apiUrl: string;
  webUrl: string;
  workerUrl: string;
  evidence: EvidenceSettings;
  features: FeatureFlags;
  /** Approval inputs are evaluated by the mainnet guard; false is the default. */
  mainnet: MainnetApproval;
}

export interface PublicEvidenceSettings {
  adapter: EvidenceAdapterKind;
  maxBytes: number;
  signedUrlTtlSeconds: number;
}

/** Safe to serialize into a browser bundle or public config route. */
export interface PublicMendConfig {
  mode: MendMode;
  modeLabel: string;
  nodeEnv: string;
  apiUrl: string;
  webUrl: string;
  workerUrl: string;
  evidence: PublicEvidenceSettings;
  features: FeatureFlags;
}
