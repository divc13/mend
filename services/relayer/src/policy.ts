import { MendError, RELAYABLE_METHODS, TESTNET_HUB_ACCOUNT, isNearAccount } from '@mend/protocol';

export const GAS_PER_TGAS = 1_000_000_000_000n;
export const DEFAULT_MAX_GAS = '300000000000000'; // 300 Tgas
export const DEFAULT_MAX_TTL_BLOCKS = 120;
export const DEFAULT_MAX_NONCE_AHEAD = 1_000_000n;

export interface RelayerPolicy {
  hubAccount: string;
  allowedMethods: readonly string[];
  allowedSenders: readonly string[];
  maxGas: string;
  maxBlockTtl: number;
  maxNonceAhead: string;
  rateWindowMs: number;
  maxCallsPerSenderPerWindow: number;
  maxCallsPerDay: number;
  dailyCapMicro: string;
  perWorkOrderCapMicro: string;
  maxCallsPerWorkOrder: number;
  requireSignature: boolean;
  requireScopedKey: boolean;
  killSwitch: boolean;
}

export const DEFAULT_RELAYER_POLICY: Omit<RelayerPolicy, 'allowedSenders'> = {
  hubAccount: TESTNET_HUB_ACCOUNT,
  allowedMethods: [...RELAYABLE_METHODS],
  maxGas: DEFAULT_MAX_GAS,
  maxBlockTtl: DEFAULT_MAX_TTL_BLOCKS,
  maxNonceAhead: DEFAULT_MAX_NONCE_AHEAD.toString(),
  rateWindowMs: 60_000,
  maxCallsPerSenderPerWindow: 5,
  maxCallsPerDay: 100,
  dailyCapMicro: '500000000',
  perWorkOrderCapMicro: '100000000',
  maxCallsPerWorkOrder: 10,
  requireSignature: true,
  requireScopedKey: true,
  killSwitch: false,
};

function positiveDecimal(name: string, value: string): void {
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new MendError('VALIDATION_ERROR', `${name} must be a positive decimal integer`);
  }
}

export function createRelayerPolicy(overrides: Partial<RelayerPolicy> = {}): RelayerPolicy {
  const policy: RelayerPolicy = { ...DEFAULT_RELAYER_POLICY, allowedSenders: [], ...overrides };
  if (!isNearAccount(policy.hubAccount)) {
    throw new MendError('VALIDATION_ERROR', `invalid hub account: ${policy.hubAccount}`);
  }
  if (policy.allowedMethods.length === 0) {
    throw new MendError('VALIDATION_ERROR', 'relayer method allowlist cannot be empty');
  }
  for (const method of policy.allowedMethods) {
    if (!RELAYABLE_METHODS.includes(method)) {
      throw new MendError('RELAYER_METHOD_NOT_ALLOWED', `policy may not allow ${method}; only MEND gasless methods are relayable`);
    }
  }
  for (const sender of policy.allowedSenders) {
    if (!isNearAccount(sender)) {
      throw new MendError('VALIDATION_ERROR', `invalid allowed sender: ${sender}`);
    }
  }
  positiveDecimal('maxGas', policy.maxGas);
  positiveDecimal('maxNonceAhead', policy.maxNonceAhead);
  positiveDecimal('dailyCapMicro', policy.dailyCapMicro);
  positiveDecimal('perWorkOrderCapMicro', policy.perWorkOrderCapMicro);
  if (policy.maxBlockTtl < 1 || policy.maxBlockTtl > 10_000) {
    throw new MendError('VALIDATION_ERROR', 'maxBlockTtl must be between 1 and 10,000 blocks');
  }
  if (policy.rateWindowMs < 1 || policy.maxCallsPerSenderPerWindow < 1 || policy.maxCallsPerDay < 1) {
    throw new MendError('VALIDATION_ERROR', 'invalid rate-limit configuration');
  }
  if (policy.maxCallsPerWorkOrder < 1) {
    throw new MendError('VALIDATION_ERROR', 'maxCallsPerWorkOrder must be positive');
  }
  return policy;
}
