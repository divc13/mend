import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MendError, isNearAccount, sha256Hex } from '@mend/protocol';
import type { AppDeps } from '../context.js';
import { auditEvent } from '../services/audit.js';
import { SlidingWindowRateLimiter } from '../services/rate-limit.js';

const faucetInput = z.object({
  accountId: z.string().min(2).max(64),
});

function minute(ms: number): string {
  return `${Math.max(1, Math.ceil(ms / 60_000))} minute(s)`;
}

function requireTestnet(deps: AppDeps): void {
  if (deps.config.mode === 'MAINNET') {
    throw new MendError('FORBIDDEN_ROLE', 'Mainnet is refused. MEND testnet onboarding never touches mainnet.');
  }
  if (deps.config.mode !== 'LIVE_TESTNET') {
    throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet onboarding is only available with MEND_MODE=LIVE_TESTNET', {
      mode: deps.config.mode,
      enableWith: 'MEND_MODE=LIVE_TESTNET CHAIN_ADAPTER=live MEND_TESTNET_KEYS_FILE=/absolute/path/outside/repo/keys.json',
    });
  }
}

export async function registerTestnetRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const limiter = new SlidingWindowRateLimiter(deps.clock);

  app.post('/v1/testnet/wallet', async (request, reply) => {
    requireTestnet(deps);
    if (!deps.testnet) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet wallet service is not configured', {
        reason: deps.config.chain.unavailableReason ?? 'No live testnet chain transport is available.',
      });
    }
    const ip = request.ip || 'unknown';
    const ipHash = sha256Hex(ip);
    const limit = limiter.consume(`wallet:ip:${ipHash}`, deps.config.testnet.walletCreatesPerIpHour, 60 * 60_000);
    if (!limit.allowed) {
      throw new MendError('RELAYER_RATE_LIMITED', 'Too many testnet wallet creations from this IP', {
        retryAfterSeconds: limit.retryAfterSeconds,
        retryGuidance: `Retry after ${minute(limit.retryAfterSeconds * 1000)}.`,
      });
    }
    const wallet = await deps.testnet.createWallet();

    let serverSideStored = true;
    try {
      await deps.repo.createTestnetWallet({
        accountId: wallet.accountId,
        publicKey: wallet.publicKey,
        network: 'testnet',
        createdAt: wallet.createdAt,
        faucetCount: 0,
      });
    } catch {
      // The one-time secret must not be lost because the read model failed.
      serverSideStored = false;
    }

    await auditEvent(deps, 'testnet_wallet_created', wallet.accountId, {}, {
      accountId: wallet.accountId,
      publicKey: wallet.publicKey,
      network: 'testnet',
      serverSideStored,
      secretReturnedOnce: true,
      secretStored: false,
    });

    return reply.status(201).send({
      accountId: wallet.accountId,
      publicKey: wallet.publicKey,
      secretKey: wallet.secretKey,
      ...(wallet.seedPhrase ? { seedPhrase: wallet.seedPhrase } : {}),
      network: wallet.network,
      warning: wallet.warning,
      createdAt: wallet.createdAt,
      oneTimeSecret: true,
      serverSideStored,
      serverStores: ['accountId', 'publicKey', 'createdAt'],
      serverNeverStores: ['secretKey', 'seedPhrase'],
    });
  });

  app.post('/v1/testnet/faucet', async (request, reply) => {
    requireTestnet(deps);
    if (!deps.testnet) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet faucet service is not configured', {
        reason: deps.config.chain.unavailableReason ?? 'No live testnet chain transport is available.',
      });
    }
    const input = faucetInput.parse(request.body);
    if (!isNearAccount(input.accountId) || !input.accountId.endsWith('.testnet')) {
      throw new MendError('VALIDATION_ERROR', 'Faucet only accepts valid NEAR testnet account ids', {
        accountId: input.accountId,
      });
    }
    const ip = request.ip || 'unknown';
    const ipHash = sha256Hex(ip);
    const perIp = limiter.consume(`faucet:ip:${ipHash}`, deps.config.testnet.faucetsPerIpHour, 60 * 60_000);
    if (!perIp.allowed) {
      throw new MendError('RELAYER_RATE_LIMITED', 'Too many faucet requests from this IP', {
        retryAfterSeconds: perIp.retryAfterSeconds,
        retryGuidance: `Retry after ${minute(perIp.retryAfterSeconds * 1000)}.`,
      });
    }
    const perAccount = limiter.consume(
      `faucet:account:${input.accountId}`,
      1,
      deps.config.testnet.faucetCooldownSeconds * 1000,
    );
    if (!perAccount.allowed) {
      throw new MendError('RELAYER_RATE_LIMITED', 'This testnet account already received faucet funds recently', {
        accountId: input.accountId,
        retryAfterSeconds: perAccount.retryAfterSeconds,
        retryGuidance: `Retry after ${minute(perAccount.retryAfterSeconds * 1000)}.`,
      });
    }
    const existing = await deps.repo.getTestnetWallet(input.accountId);
    if (existing?.lastFaucetAt) {
      const elapsed = deps.clock.now().getTime() - Date.parse(existing.lastFaucetAt);
      if (elapsed < deps.config.testnet.faucetCooldownSeconds * 1000) {
        const retryAfterSeconds = Math.ceil(
          (deps.config.testnet.faucetCooldownSeconds * 1000 - elapsed) / 1000,
        );
        throw new MendError('RELAYER_RATE_LIMITED', 'This testnet account already received faucet funds recently', {
          accountId: input.accountId,
          lastFaucetAt: existing.lastFaucetAt,
          retryAfterSeconds,
        });
      }
    }

    const result = await deps.testnet.faucet(input.accountId);
    if (existing) {
      await deps.repo.updateTestnetWallet(input.accountId, {
        lastFaucetAt: deps.clock.now().toISOString(),
        lastFaucetIpHash: ipHash,
        faucetCount: existing.faucetCount + 1,
      });
    }
    await auditEvent(deps, 'testnet_faucet_granted', input.accountId, {}, {
      accountId: input.accountId,
      amountMicro: result.amountMicro,
      txHash: result.txHash,
      registrationTxHash: result.registrationTxHash ?? null,
      balanceMicro: result.balanceMicro,
      network: 'testnet',
      realTransaction: true,
    });
    return reply.status(200).send({
      ...result,
      oneTimeSecret: false,
      note: 'Real NEAR testnet transaction. This is test value only and is not a payment or mainnet money.',
    });
  });

  app.get<{ Params: { accountId: string } }>('/v1/testnet/wallet/:accountId', async (request) => {
    requireTestnet(deps);
    if (!deps.testnet) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Testnet wallet service is not configured', {
        reason: deps.config.chain.unavailableReason ?? 'No live testnet chain transport is available.',
      });
    }
    const accountId = request.params.accountId;
    if (!isNearAccount(accountId)) {
      throw new MendError('VALIDATION_ERROR', 'Invalid NEAR account id', { accountId });
    }
    const status = await deps.testnet.wallet(accountId);
    const record = await deps.repo.getTestnetWallet(accountId);
    return {
      accountId: status.accountId,
      network: status.network,
      exists: status.exists,
      balanceMicro: status.balanceMicro,
      storageRegistered: status.storageRegistered,
      explorerUrl: status.explorerUrl,
      ...(record?.publicKey ? { publicKey: record.publicKey } : {}),
      ...(record?.createdAt ? { registeredAt: record.createdAt } : {}),
      ...(record?.lastFaucetAt ? { lastFaucetAt: record.lastFaucetAt } : {}),
      faucetCount: record?.faucetCount ?? 0,
      warning: status.warning,
      secretStored: false,
    };
  });

  app.post('/v1/live/run-scenario', async (request, reply) => {
    if (deps.config.mode === 'MAINNET') {
      throw new MendError('FORBIDDEN_ROLE', 'Mainnet is refused. The live scenario runner only signs NEAR testnet.');
    }
    if (deps.config.mode !== 'LIVE_TESTNET') {
      throw new MendError('INVALID_STATE', 'Live scenarios require MEND_MODE=LIVE_TESTNET', {
        mode: deps.config.mode,
      });
    }
    if (!deps.config.liveScenario.enabled) {
      throw new MendError('NOT_FOUND', 'Live scenario runner is disabled');
    }
    if (!deps.liveScenario) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario runner is not configured', {
        reason: deps.config.chain.unavailableReason ?? 'No live testnet chain transport is available.',
        enableWith: 'MEND_LIVE_SCENARIO_ENABLED=true plus every role signer in MEND_TESTNET_KEYS_FILE',
      });
    }
    const result = await deps.liveScenario.run();
    await auditEvent(deps, 'live_scenario_completed', 'live-scenario-runner', {}, {
      scenario: result.scenario,
      assetId: result.assetId,
      workOrderId: result.workOrderId,
      stepCount: result.steps.length,
      finalStatus: result.verification.finalStatus,
      contractVerified: result.verification.contractVerified,
      txHashes: result.steps.map((step) => step.txHash),
      network: 'testnet',
    });
    return reply.status(200).send(result);
  });
}
