import { TESTNET_HUB_ACCOUNT, TESTNET_TOKEN_ACCOUNT, isNearAccount } from '@mend/protocol';
import { NearClientError } from './errors.js';

export type NearNetwork = 'testnet' | 'mainnet';

export interface NearClientConfig {
  network: NearNetwork;
  rpcUrl: string;
  hubAccount: string;
  tokenAccount: string;
  daoAccount: string;
  /**
   * Live RPC/transaction calls are disabled unless an operator explicitly sets
   * MEND_LIVE_CALLS=1. Default unit tests never touch the network.
   */
  liveCalls: boolean;
  /**
   * Mainnet is additionally gated. MEND_MAINNET_APPROVED=1 must be present and
   * the caller must never receive a default mainnet config.
   */
  mainnetApproved: boolean;
  timeoutMs: number;
}

export type EnvLike = Record<string, string | undefined>;

const TESTNET_RPC = 'https://rpc.testnet.near.org';
const MAINNET_RPC = 'https://free.rpc.fastnear.com';

export function loadNearClientConfig(env: EnvLike = process.env): NearClientConfig {
  const network = (env.MEND_NEAR_NETWORK ?? 'testnet') as NearNetwork;
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new NearClientError('INVALID_CONFIG', `unsupported network: ${String(network)}`);
  }

  const mainnetApproved = env.MEND_MAINNET_APPROVED === '1';
  if (network === 'mainnet' && !mainnetApproved) {
    throw new NearClientError('MAINNET_NOT_ALLOWED', 'mainnet config requires MEND_MAINNET_APPROVED=1');
  }

  const hubAccount = env.MEND_HUB_ACCOUNT ?? TESTNET_HUB_ACCOUNT;
  const tokenAccount = env.MEND_TOKEN_ACCOUNT ?? TESTNET_TOKEN_ACCOUNT;
  const daoAccount = env.MEND_DAO_ACCOUNT ?? 'mend-dao.sputnikv2.testnet';
  for (const [name, account] of [
    ['hub', hubAccount],
    ['token', tokenAccount],
    ['dao', daoAccount],
  ] as const) {
    if (!isNearAccount(account)) {
      throw new NearClientError('INVALID_CONFIG', `invalid ${name} account: ${account}`);
    }
  }

  const timeoutMs = Number(env.MEND_RPC_TIMEOUT_MS ?? 15_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500) {
    throw new NearClientError('INVALID_CONFIG', 'MEND_RPC_TIMEOUT_MS must be an integer >= 500');
  }

  return {
    network,
    rpcUrl: env.MEND_RPC_URL ?? (network === 'testnet' ? TESTNET_RPC : MAINNET_RPC),
    hubAccount,
    tokenAccount,
    daoAccount,
    liveCalls: env.MEND_LIVE_CALLS === '1',
    mainnetApproved,
    timeoutMs,
  };
}

/** Throws unless live outbound calls were explicitly enabled for a testnet profile. */
export function assertLiveCallsAllowed(config: NearClientConfig): void {
  if (!config.liveCalls) {
    throw new NearClientError(
      'LIVE_CALLS_DISABLED',
      'live NEAR calls are disabled; set MEND_LIVE_CALLS=1 for a labelled testnet run',
    );
  }
  if (config.network === 'mainnet' && !config.mainnetApproved) {
    throw new NearClientError('MAINNET_NOT_ALLOWED', 'mainnet calls require explicit human approval');
  }
}
