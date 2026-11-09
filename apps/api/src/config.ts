import path from 'node:path';
import { DEFAULT_SCORING_POLICY_BPS, SCORING_POLICY_VERSION, TESTNET_HUB_ACCOUNT, TESTNET_TOKEN_ACCOUNT } from '@mend/protocol';

export type ApiMode = 'LIVE_TESTNET' | 'MAINNET' | 'REPLAY';
export type ChainAdapterKind = 'replay' | 'live' | 'unavailable' | 'pending' | 'failing';
export type EvidenceAdapterKind = 'local' | 's3' | 'unavailable';

export interface AppConfig {
  nodeEnv: string;
  serviceName: string;
  host: string;
  port: number;
  mode: ApiMode;
  publicBaseUrl: string;
  databaseUrl?: string;
  scoring: {
    version: string;
    weightsBps: { price: number; warranty: number; duration: number; materials: number };
    policyHashSeed: string;
  };
  bidding: {
    commitWindowSeconds: number;
    revealWindowSeconds: number;
  };
  durabilityMinutes: number;
  evidence: {
    adapter: EvidenceAdapterKind;
    dir: string;
    maxBytes: number;
    signedUrlTtlSeconds: number;
    signingSecret: string;
    s3?: {
      endpoint?: string;
      bucket?: string;
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
  chain: {
    adapter: ChainAdapterKind;
    network: 'testnet' | 'mainnet';
    hubAccount: string;
    tokenAccount: string;
    rpcUrl?: string;
    /**
     * Absolute path to the human-managed testnet key file. The file is read at
     * runtime by the signer provider; its contents are never logged or
     * serialized into an API response.
     */
    keysFile?: string;
    roleAccounts: {
      deployer: string;
      steward: string;
      sponsor: string;
      dao: string;
      contractor: string;
      inspector: string;
      admin: string;
    };
    signerConfigured: boolean;
    unavailableReason?: string;
  };
  testnet: {
    walletEnabled: boolean;
    faucetEnabled: boolean;
    faucetAmountMicro: string;
    faucetCooldownSeconds: number;
    walletCreatesPerIpHour: number;
    faucetsPerIpHour: number;
    cliPath: string;
    cliTimeoutMs: number;
  };
  liveScenario: {
    enabled: boolean;
    timeoutMs: number;
    commitWindowSeconds: number;
    revealWindowSeconds: number;
    /**
     * auto reads the deployed hub code and uses the payload version it verifies.
     * v1/v2 are explicit overrides for operators who already know the deployment.
     */
    bidPayloadVersion: 'auto' | 'v1' | 'v2';
  };
  triage: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs: number;
  };
  intents: {
    enabled: boolean;
    baseUrl: string;
    allowLive: boolean;
    provider: string;
    /** Partner JWT for 1Click. Server-side only; never serialized. */
    apiKey?: string;
    unavailableReason?: string;
  };
  demo: {
    resetEnabled: boolean;
    account: string;
    defaultScenario: string;
  };
  /** Demo role headers. Production must replace them with signed JWT/signatures. */
  auth: {
    demoHeadersEnabled: boolean;
    defaultAccount: string;
  };
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mode(value: string | undefined): ApiMode {
  if (value === 'LIVE_TESTNET' || value === 'MAINNET' || value === 'REPLAY') return value;
  return 'REPLAY';
}

/**
 * Environment-driven configuration with safe defaults. The default mode is
 * REPLAY and the default chain adapter is a labelled replay adapter, so a
 * checkout with no credentials can never present a fake action as live.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const apiMode = mode(env.MEND_MODE);
  const chainAdapter = (env.CHAIN_ADAPTER as ChainAdapterKind | undefined)
    ?? (apiMode === 'REPLAY' ? 'replay' : 'unavailable');
  const evidenceAdapter = (env.EVIDENCE_ADAPTER as EvidenceAdapterKind | undefined) ?? 'local';
  const intentsEnabled = bool(env.INTENTS_ENABLED, false);
  const intentsUnavailable = !intentsEnabled
    ? 'NEAR Intents 1Click is disabled (INTENTS_ENABLED is not true). Dry previews are disabled until it is enabled; live execution additionally requires INTENTS_ALLOW_LIVE=true and explicit human confirmation.'
    : undefined;
  const keysFile = env.MEND_TESTNET_KEYS_FILE ?? env.NEAR_KEYS_FILE;
  const legacySignerConfigured = Boolean(env.NEAR_SIGNER_ACCOUNT && env.NEAR_SIGNER_SECRET);
  const signerConfigured = Boolean(keysFile) || legacySignerConfigured;
  const liveScenarioEnabled = bool(env.MEND_LIVE_SCENARIO_ENABLED, false);
  const testnetWalletEnabled = bool(env.MEND_TESTNET_WALLET_ENABLED, apiMode === 'LIVE_TESTNET');
  const testnetFaucetEnabled = bool(env.MEND_TESTNET_FAUCET_ENABLED, apiMode === 'LIVE_TESTNET');
  let chainUnavailable: string | undefined;
  if (apiMode === 'MAINNET') {
    chainUnavailable = 'MAINNET is refused by this build. The live adapter only signs NEAR testnet transactions; no mainnet key or transfer path exists.';
  } else if (!signerConfigured) {
    chainUnavailable = 'No NEAR testnet signer is configured (MEND_TESTNET_KEYS_FILE). Chain actions remain INTENT and are never reported as executed.';
  } else if (!keysFile && chainAdapter === 'live') {
    chainUnavailable = 'CHAIN_ADAPTER=live requires MEND_TESTNET_KEYS_FILE pointing outside the repository. NEAR_SIGNER_ACCOUNT/NEAR_SIGNER_SECRET alone are not used by the role signer provider.';
  }

  return {
    nodeEnv,
    serviceName: 'mend-api',
    host: env.HOST ?? '127.0.0.1',
    port: int(env.PORT, 4010),
    mode: apiMode,
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? `http://${env.HOST ?? '127.0.0.1'}:${int(env.PORT, 4010)}`).replace(/\/$/, ''),
    databaseUrl: env.DATABASE_URL,
    scoring: {
      version: SCORING_POLICY_VERSION,
      weightsBps: { ...DEFAULT_SCORING_POLICY_BPS },
      policyHashSeed: env.SCORING_POLICY_SEED ?? 'mend-bid-rules-local-v1',
    },
    bidding: {
      commitWindowSeconds: int(env.BID_COMMIT_WINDOW_SECONDS, 300),
      revealWindowSeconds: int(env.BID_REVEAL_WINDOW_SECONDS, 300),
    },
    durabilityMinutes: int(env.DEMO_DURABILITY_MINUTES, 2),
    evidence: {
      adapter: evidenceAdapter,
      dir: env.EVIDENCE_DIR ?? path.resolve(process.cwd(), '.evidence'),
      maxBytes: int(env.EVIDENCE_MAX_BYTES, 8 * 1024 * 1024),
      signedUrlTtlSeconds: int(env.EVIDENCE_URL_TTL_SECONDS, 300),
      signingSecret: env.EVIDENCE_URL_SECRET ?? 'mend-dev-only-evidence-signing-secret',
      s3: {
        endpoint: env.S3_ENDPOINT,
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    },
    chain: {
      adapter: chainAdapter,
      network: apiMode === 'MAINNET' ? 'mainnet' : 'testnet',
      hubAccount: env.MEND_HUB_ACCOUNT ?? env.HUB_ACCOUNT ?? TESTNET_HUB_ACCOUNT,
      tokenAccount: env.MEND_TOKEN_ACCOUNT ?? env.TOKEN_ACCOUNT ?? TESTNET_TOKEN_ACCOUNT,
      rpcUrl: env.MEND_RPC_URL ?? env.NEAR_RPC_URL ?? 'https://rpc.testnet.near.org',
      ...(keysFile ? { keysFile } : {}),
      roleAccounts: {
        deployer: env.MEND_DEPLOYER_ACCOUNT ?? 'mend-deployer.testnet',
        steward: env.MEND_STEWARD_ACCOUNT ?? 'mend-steward.testnet',
        sponsor: env.MEND_SPONSOR_ACCOUNT ?? 'mend-sponsor.testnet',
        dao: env.MEND_DAO_ACCOUNT ?? 'mend-dao.testnet',
        contractor: env.MEND_CONTRACTOR_ACCOUNT ?? 'mend-contractor-a.testnet',
        inspector: env.MEND_INSPECTOR_ACCOUNT ?? 'mend-inspector.testnet',
        admin: env.MEND_ADMIN_ACCOUNT ?? env.MEND_DEPLOYER_ACCOUNT ?? 'mend-deployer.testnet',
      },
      signerConfigured,
      ...(chainUnavailable ? { unavailableReason: chainUnavailable } : {}),
    },
    testnet: {
      walletEnabled: testnetWalletEnabled,
      faucetEnabled: testnetFaucetEnabled,
      faucetAmountMicro: env.MEND_TESTNET_FAUCET_AMOUNT_MICRO ?? '100000000',
      faucetCooldownSeconds: int(env.MEND_TESTNET_FAUCET_COOLDOWN_SECONDS, 3600),
      walletCreatesPerIpHour: int(env.MEND_TESTNET_WALLET_CREATES_PER_IP_HOUR, 3),
      faucetsPerIpHour: int(env.MEND_TESTNET_FAUCETS_PER_IP_HOUR, 10),
      cliPath: env.MEND_NEAR_CLI_PATH ?? 'near',
      cliTimeoutMs: int(env.MEND_NEAR_CLI_TIMEOUT_MS, 120_000),
    },
    liveScenario: {
      enabled: liveScenarioEnabled,
      timeoutMs: int(env.MEND_LIVE_SCENARIO_TIMEOUT_MS, 600_000),
      // Transaction finality on the public testnet RPC takes several seconds
      // per step. Keep a generous commit window; the runner waits for real
      // deadlines rather than shortening them.
      commitWindowSeconds: int(env.MEND_LIVE_SCENARIO_COMMIT_SECONDS, 90),
      revealWindowSeconds: int(env.MEND_LIVE_SCENARIO_REVEAL_SECONDS, 60),
      bidPayloadVersion: env.MEND_LIVE_BID_PAYLOAD_VERSION === 'v1' || env.MEND_LIVE_BID_PAYLOAD_VERSION === 'v2'
        ? env.MEND_LIVE_BID_PAYLOAD_VERSION
        : 'auto',
    },
    triage: {
      provider: 'NEAR AI Cloud',
      baseUrl: env.NEAR_AI_BASE_URL ?? 'https://cloud-api.near.ai/v1',
      model: env.NEAR_AI_MODEL ?? 'Qwen/Qwen3-235B-A22B-Instruct-2507',
      apiKey: env.NEAR_AI_API_KEY,
      timeoutMs: int(env.NEAR_AI_TIMEOUT_MS, 20_000),
    },
    intents: {
      enabled: intentsEnabled,
      baseUrl: env.INTENTS_API_URL ?? 'https://1click.chaindefuser.com',
      allowLive: intentsEnabled && bool(env.INTENTS_ALLOW_LIVE, false),
      provider: 'NEAR Intents / 1Click',
      apiKey: env.INTENTS_API_KEY,
      unavailableReason: intentsUnavailable,
    },
    demo: {
      resetEnabled: bool(env.DEMO_RESET_ENABLED, nodeEnv !== 'production'),
      account: env.DEMO_ADMIN_ACCOUNT ?? 'demo-admin.mend.testnet',
      defaultScenario: env.DEMO_SCENARIO ?? 'successfulRepair',
    },
    auth: {
      demoHeadersEnabled: bool(env.MEND_DEMO_HEADERS, true),
      defaultAccount: env.MEND_DEFAULT_ACCOUNT ?? 'anonymous.mend.testnet',
    },
  };
}

export function assertProductionGuards(config: AppConfig): void {
  if (config.nodeEnv !== 'production') return;
  if (config.evidence.signingSecret === 'mend-dev-only-evidence-signing-secret') {
    throw new Error('EVIDENCE_URL_SECRET must be set in production');
  }
  if (!config.evidence.dir || config.evidence.dir === path.resolve(process.cwd(), '.evidence')) {
    // Allowed but loudly documented in README; production should point at a
    // private volume or the S3-compatible adapter.
  }
}
