import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { MendError } from '@mend/protocol';
import type { AppConfig } from '../config.js';
import {
  MissingTestnetSignerError,
  type LiveChainExecutor,
  type LiveChainTx,
} from './testnet-chain.js';

export interface OnboardedTestnetWallet {
  accountId: string;
  publicKey: string;
  secretKey: string;
  seedPhrase?: string;
  network: 'testnet';
  warning: string;
  createdAt: string;
}

export interface FaucetResult {
  accountId: string;
  amountMicro: string;
  balanceMicro: string;
  storageRegistered: boolean;
  registrationTxHash?: string;
  txHash: string;
  explorerUrl: string;
  network: 'testnet';
  warning: string;
}

export interface TestnetWalletStatus {
  accountId: string;
  network: 'testnet';
  exists: boolean;
  balanceMicro: string;
  storageRegistered: boolean;
  publicKey?: string;
  registeredAt?: string;
  explorerUrl: string;
  warning: string;
}

export interface TestnetOnboarding {
  readonly available: boolean;
  readonly unavailableReason?: string;
  createWallet(): Promise<OnboardedTestnetWallet>;
  faucet(accountId: string): Promise<FaucetResult>;
  wallet(accountId: string): Promise<TestnetWalletStatus>;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CliRunner = (file: string, args: readonly string[], timeoutMs: number) => Promise<CliResult>;

export const TESTNET_WALLET_WARNING =
  'TESTNET ONLY — test value only, never mainnet money. The secret key/seed phrase are shown exactly once and are not stored or logged by MEND. Save them now and never reuse this key on mainnet.';

export const TESTNET_FAUCET_WARNING =
  'Testnet mUSDC has no real value. A 100 mUSDC faucet transfer is real only on NEAR testnet; it is not a payment and has no mainnet value.';

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const SECRET_KEY_PATTERN = /(?:SECRET KEYPAIR|Secret Key|secret key)\s*:\s*(ed25519:[A-Za-z0-9]+)/i;
const PUBLIC_KEY_PATTERN = /(?:Public Key|public key)\s*:\s*(ed25519:[A-Za-z0-9]+)/i;
const SEED_PATTERN = /(?:Master Seed Phrase|Seed Phrase|seed phrase)\s*:\s*([a-z]+(?:\s+[a-z]+){11,23})/i;
const RATE_LIMIT_PATTERN = /429|too many requests|rate.?limit|faucet.*limit/i;

function cleanOutput(value: string): string {
  return value.replace(ANSI, '').replace(/\r/g, '');
}

/** Never let a child-process error echo secret key material into a response. */
export function sanitizeCliOutput(value: string): string {
  return cleanOutput(value)
    .replace(/ed25519:[A-Za-z0-9]+/g, 'ed25519:[redacted]')
    .replace(/(seed phrase[^\n]*).*/gi, '$1 [redacted]')
    .slice(0, 800);
}

export interface ParsedWalletOutput {
  accountId: string;
  publicKey: string;
  secretKey: string;
  seedPhrase?: string;
}

export function parseWalletCliOutput(output: string, expectedAccountId: string): ParsedWalletOutput {
  const cleaned = cleanOutput(output);
  const publicKey = PUBLIC_KEY_PATTERN.exec(cleaned)?.[1];
  const secretKey = SECRET_KEY_PATTERN.exec(cleaned)?.[1];
  const seedPhrase = SEED_PATTERN.exec(cleaned)?.[1]?.trim();
  if (!publicKey || !secretKey) {
    throw new MendError('UPSTREAM_UNAVAILABLE', 'NEAR faucet output did not contain a testnet key pair; no secrets were returned', {
      accountCreated: false,
      secretReturned: false,
      guidance:
        'The NEAR CLI and faucet can change output formatting. Check `near --version` and retry; MEND will not guess or fabricate a wallet.',
    });
  }
  return {
    accountId: expectedAccountId,
    publicKey,
    secretKey,
    ...(seedPhrase ? { seedPhrase } : {}),
  };
}

function defaultCliRunner(file: string, args: readonly string[], timeoutMs: number): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], {
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new MendError('UPSTREAM_UNAVAILABLE', 'NEAR CLI is not installed on this host', {
          expectedExecutable: file,
          guidance:
            'Install near-cli-rs (https://github.com/near/near-cli-rs) or set MEND_NEAR_CLI_PATH to the executable. No account or secret was created.',
        }));
        return;
      }
      const exitCode = typeof (error as { code?: unknown } | null)?.code === 'number'
        ? Number((error as { code: number }).code)
        : error
          ? 1
          : 0;
      resolve({
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        exitCode,
      });
    });
  });
}

/**
 * Testnet wallet/faucet implementation. Account creation deliberately shells
 * out to the human-facing NEAR faucet flow so MEND never needs its own account
 * factory key. Role signing keys (deployer etc.) come from the external key
 * file through LiveChainExecutor.
 */
export class NearTestnetOnboarding implements TestnetOnboarding {
  readonly available: boolean;
  readonly unavailableReason?: string;
  private readonly cli: CliRunner;

  constructor(
    private readonly chain: LiveChainExecutor,
    private readonly config: AppConfig,
    private readonly cliRunner: CliRunner = defaultCliRunner,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.cli = cliRunner;
    const enabled = config.testnet.walletEnabled || config.testnet.faucetEnabled;
    this.available = config.mode === 'LIVE_TESTNET'
      && config.chain.network === 'testnet'
      && enabled
      && chain.available;
    this.unavailableReason = config.mode !== 'LIVE_TESTNET'
      ? 'Testnet onboarding is only available with MEND_MODE=LIVE_TESTNET.'
      : config.chain.network !== 'testnet'
        ? 'Mainnet is refused. Testnet onboarding never creates or funds a mainnet account.'
        : !enabled
          ? 'Testnet wallet and faucet endpoints are disabled (MEND_TESTNET_WALLET_ENABLED / MEND_TESTNET_FAUCET_ENABLED).'
          : chain.unavailableReason;
  }

  async createWallet(): Promise<OnboardedTestnetWallet> {
    if (!this.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason ?? 'Testnet onboarding is unavailable');
    }
    if (!this.config.testnet.walletEnabled) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet wallet creation is disabled', {
        enableWith: 'MEND_TESTNET_WALLET_ENABLED=true',
      });
    }
    const accountId = `mend-w${randomBytes(8).toString('hex')}.testnet`;
    let result: CliResult;
    try {
      result = await this.cli(this.config.testnet.cliPath, [
        'account',
        'create-account',
        'sponsor-by-faucet-service',
        accountId,
        'autogenerate-new-keypair',
        'print-to-terminal',
        'network-config',
        'testnet',
        'create',
      ], this.config.testnet.cliTimeoutMs);
    } catch (error) {
      if (error instanceof MendError) throw error;
      throw new MendError('UPSTREAM_UNAVAILABLE', 'NEAR CLI could not be executed; no wallet was created', {
        reason: error instanceof Error ? sanitizeCliOutput(error.message) : 'unknown CLI error',
      });
    }
    const combined = `${result.stdout}\n${result.stderr}`;
    if (result.exitCode !== 0 || /could not be created successfully/i.test(combined)) {
      if (RATE_LIMIT_PATTERN.test(combined)) {
        throw new MendError(
          'RELAYER_RATE_LIMITED',
          'The NEAR testnet faucet rate-limited this wallet creation request. No account was created and no secret was returned.',
          {
            retryAfterSeconds: 60,
            retryGuidance:
              'Wait for the NEAR faucet cooldown, then retry POST /v1/testnet/wallet. The public testnet faucet is shared and may return HTTP 429.',
            accountCreated: false,
            secretReturned: false,
          },
        );
      }
      throw new MendError('UPSTREAM_UNAVAILABLE', 'The NEAR testnet faucet did not create the account', {
        exitCode: result.exitCode,
        sanitizedOutput: sanitizeCliOutput(combined),
        accountCreated: false,
        secretReturned: false,
      });
    }
    const parsed = parseWalletCliOutput(result.stdout || result.stderr, accountId);
    // Do not return a secret unless the account is observably present on chain.
    let exists = await this.chain.accountExists(accountId);
    for (let attempt = 0; !exists && attempt < 3; attempt += 1) {
      await this.sleep(1000);
      exists = await this.chain.accountExists(accountId);
    }
    if (!exists) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Faucet reported success but the account is not confirmed on testnet', {
        accountId,
        accountCreated: false,
        secretReturned: false,
        retryGuidance: 'Retry later. MEND refuses to return keys for an account it cannot observe on testnet.',
      });
    }
    return {
      ...parsed,
      network: 'testnet',
      warning: TESTNET_WALLET_WARNING,
      createdAt: this.now().toISOString(),
    };
  }

  async faucet(accountId: string): Promise<FaucetResult> {
    if (!this.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason ?? 'Testnet faucet is unavailable');
    }
    if (!this.config.testnet.faucetEnabled) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet faucet is disabled', {
        enableWith: 'MEND_TESTNET_FAUCET_ENABLED=true',
      });
    }
    if (!accountId.endsWith('.testnet')) {
      throw new MendError('VALIDATION_ERROR', 'Only NEAR testnet accounts can receive testnet mUSDC', { accountId });
    }
    if (!(await this.chain.accountExists(accountId))) {
      throw new MendError('NOT_FOUND', 'Account does not exist on NEAR testnet', {
        accountId,
        guidance: 'Create it first with POST /v1/testnet/wallet, then retry the faucet.',
      });
    }
    const deployer = this.config.chain.roleAccounts.deployer;
    if (!this.chain.keys.has(deployer)) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `Faucet deployer signer ${deployer} is not present in MEND_TESTNET_KEYS_FILE`, {
        signer: deployer,
        missingSigner: true,
      });
    }
    const amountMicro = this.config.testnet.faucetAmountMicro;
    let deployerBalance: bigint;
    try {
      deployerBalance = BigInt(await this.chain.ftBalance(deployer));
    } catch (error) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Could not read the testnet faucet token balance', {
        reason: error instanceof Error ? sanitizeCliOutput(error.message) : 'unknown RPC error',
      });
    }
    if (deployerBalance < BigInt(amountMicro)) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'The testnet faucet account has insufficient mUSDC', {
        deployer,
        requiredMicro: amountMicro,
        availableMicro: deployerBalance.toString(),
      });
    }

    let storage = await this.chain.storageBalance(accountId);
    let registrationTxHash: string | undefined;
    if (!storage) {
      try {
        const registration: LiveChainTx = await this.chain.call(
          deployer,
          this.chain.tokenAccount,
          'storage_deposit',
          { account_id: accountId, registration_only: true },
          { deposit: 10_000_000_000_000_000_000_000n, gas: 30_000_000_000_000n },
        );
        registrationTxHash = registration.txHash;
        storage = await this.chain.storageBalance(accountId);
      } catch (error) {
        // The token may already be registered by another request; only report a
        // failure if storage is still absent.
        storage = await this.chain.storageBalance(accountId);
        if (!storage) {
          throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet faucet token storage registration failed; no funds were moved', {
            accountId,
            reason: error instanceof Error ? sanitizeCliOutput(error.message) : 'unknown RPC error',
          });
        }
      }
    }

    let transfer: LiveChainTx;
    try {
      transfer = await this.chain.call(
        deployer,
        this.chain.tokenAccount,
        'ft_transfer',
        {
          receiver_id: accountId,
          amount: amountMicro,
          memo: 'MEND testnet onboarding faucet (test value only)',
        },
        { deposit: 1n, gas: 30_000_000_000_000n },
      );
    } catch (error) {
      if (error instanceof MissingTestnetSignerError) {
        throw new MendError('UPSTREAM_UNAVAILABLE', 'Faucet deployer signer is missing from MEND_TESTNET_KEYS_FILE', {
          signer: deployer,
          missingSigner: true,
        });
      }
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet faucet transfer failed; no funds were moved', {
        reason: error instanceof Error ? sanitizeCliOutput(error.message) : 'unknown RPC error',
      });
    }
    const balanceMicro = await this.chain.ftBalance(accountId);
    return {
      accountId,
      amountMicro,
      balanceMicro,
      storageRegistered: Boolean(storage),
      ...(registrationTxHash ? { registrationTxHash } : {}),
      txHash: transfer.txHash,
      explorerUrl: transfer.explorerUrl,
      network: 'testnet',
      warning: TESTNET_FAUCET_WARNING,
    };
  }

  async wallet(accountId: string): Promise<TestnetWalletStatus> {
    if (!this.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason ?? 'Testnet wallet status is unavailable');
    }
    const exists = await this.chain.accountExists(accountId);
    if (!exists) {
      throw new MendError('NOT_FOUND', 'Account does not exist on NEAR testnet', { accountId });
    }
    const [balanceMicro, storage] = await Promise.all([
      this.chain.ftBalance(accountId),
      this.chain.storageBalance(accountId),
    ]);
    return {
      accountId,
      network: 'testnet',
      exists,
      balanceMicro,
      storageRegistered: Boolean(storage),
      explorerUrl: `https://explorer.testnet.near.org/accounts/${accountId}`,
      warning: TESTNET_FAUCET_WARNING,
    };
  }
}
