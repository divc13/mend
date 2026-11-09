import { randomBytes } from 'node:crypto';
import {
  DEFAULT_SCORE_POLICY,
  MendError,
  bidCommitmentHash,
  policyHash,
  sha256Hex,
} from '@mend/protocol';
import type { Repository } from '@mend/db';
import type { AppConfig } from '../config.js';
import { LiveChainTxFailure, MissingTestnetSignerError, type LiveChainExecutor, type TestnetRole } from './testnet-chain.js';

export interface LiveScenarioStep {
  index: number;
  label: string;
  action: string;
  method: string;
  signer: string;
  receiver: string;
  txHash: string;
  explorerUrl: string;
  status: 'SUCCESS';
  at: string;
}

export interface LiveScenarioResult {
  scenario: 'canonicalRepair';
  network: 'testnet';
  mode: 'LIVE_TESTNET';
  enabled: boolean;
  assetId: string;
  workOrderId: string;
  bidPayloadVersion: 'v1' | 'v2';
  steps: LiveScenarioStep[];
  verification: {
    finalStatus: string;
    contractVerified: boolean;
    note: string;
  };
  startedAt: string;
  finishedAt: string;
  warning: string;
}

interface HubConfigView {
  token?: string;
  dao?: string;
  paused?: boolean;
  durability_minutes?: number;
  durabilityMinutes?: number;
}

interface HubWorkOrderView {
  id?: string;
  status?: string;
  budget?: string;
  funded?: string;
}

const BUDGET_MICRO = '100000000'; // 100 mUSDC, test value only
const PRICE_MICRO = '80000000'; // 80 mUSDC
const DURATION_DAYS = 3;
const WARRANTY_DAYS = 30;
const MATERIALS_SCORE = 80;

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function safeMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/ed25519:[A-Za-z0-9]+/g, 'ed25519:[redacted]').slice(0, 500);
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.toUpperCase();
}

interface BidCommitmentInput {
  bidId: string;
  contractorId: string;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  materialsScore: number;
  availableInDays: number;
  evidenceChecklistAccepted: boolean;
  nonce: string;
}

/** Older testnet hub deployments verify the V1 payload (no availableInDays). */
function bidCommitmentHashV1(input: BidCommitmentInput): string {
  return sha256Hex([
    'MEND_BID_V1',
    input.bidId,
    input.contractorId,
    input.priceMicro,
    String(input.durationDays),
    String(input.warrantyDays),
    String(input.materialsScore),
    input.evidenceChecklistAccepted ? '1' : '0',
    input.nonce,
  ].join('|'));
}

/**
 * Runs the canonical repair lifecycle against the real testnet hub using the
 * role accounts from the external key file. Every returned step is a real
 * transaction; there is no replay hash in this path. A missing signer or a
 * failed chain call aborts the run and returns the already-confirmed steps in
 * the error details so nothing is presented as more complete than it is.
 */
export class LiveScenarioRunner {
  readonly available: boolean;
  readonly unavailableReason?: string;
  private steps: LiveScenarioStep[] = [];
  private bidPayloadVersion: 'v1' | 'v2' = 'v2';

  constructor(
    private readonly chain: LiveChainExecutor,
    private readonly config: AppConfig,
    private readonly repo?: Repository,
    private readonly sleep: (ms: number) => Promise<void> = sleepDefault,
    private readonly now: () => Date = () => new Date(),
  ) {
    const enabled = config.mode === 'LIVE_TESTNET' && config.chain.network === 'testnet' && config.liveScenario.enabled;
    this.available = enabled && chain.available;
    this.unavailableReason = config.mode !== 'LIVE_TESTNET'
      ? 'Live scenarios are only allowed in MEND_MODE=LIVE_TESTNET. Mainnet and replay are refused.'
      : config.chain.network !== 'testnet'
        ? 'Mainnet is refused. This runner only signs NEAR testnet transactions.'
        : !config.liveScenario.enabled
          ? 'Live scenarios are disabled (MEND_LIVE_SCENARIO_ENABLED is not true).'
          : chain.unavailableReason;
  }

  private roleAccount(role: TestnetRole): string {
    return this.config.chain.roleAccounts[role];
  }

  async run(): Promise<LiveScenarioResult> {
    if (!this.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason ?? 'Live scenario runner is unavailable');
    }
    if (this.config.mode === 'MAINNET' || this.config.chain.network !== 'testnet') {
      throw new MendError('FORBIDDEN_ROLE', 'Mainnet is refused. No live scenario can run against mainnet.');
    }
    this.steps = [];
    const startedAt = this.now().toISOString();
    await this.preflight();

    const assetId = `LIVE-${uniqueSuffix()}`;
    const suffix = uniqueSuffix();
    const workOrderId = `WO-LIVE-${suffix}`;
    const proposalId = `PROP-${suffix}`;
    const bidId = `BID-LIVE-${suffix}`;
    const nonce = randomBytes(8).toString('hex');
    const scopeHash = sha256Hex(`MEND_LIVE_SCOPE|${workOrderId}|${scopeSummary()}`);
    const policyDigest = policyHash(DEFAULT_SCORE_POLICY);
    const budgetMicro = BUDGET_MICRO;
    const priceMicro = PRICE_MICRO;
    const nowMs = this.now().getTime();
    const commitAt = nowMs + this.config.liveScenario.commitWindowSeconds * 1000;
    const revealAt = commitAt + this.config.liveScenario.revealWindowSeconds * 1000;
    const commitDeadline = BigInt(commitAt) * 1_000_000n;
    const revealDeadline = BigInt(revealAt) * 1_000_000n;
    const steward = this.roleAccount('steward');
    const sponsor = this.roleAccount('sponsor');
    const dao = this.roleAccount('dao');
    const contractor = this.roleAccount('contractor');
    const inspector = this.roleAccount('inspector');
    const contractorRoster = [contractor];
    const inspectorRoster = [inspector];

    try {
      await this.step('create_asset', 'create_asset', 'create_asset', 'steward', this.chain.hubAccount, {
        asset_id: assetId,
        description_hash: sha256Hex(`MEND_LIVE_ASSET|${assetId}|community bench repair`),
        location_hash: sha256Hex(`MEND_LIVE_LOCATION|${assetId}|public park`),
      });

      await this.step('create_work_order', 'create_work_order', 'create_work_order', 'steward', this.chain.hubAccount, {
        work_order_id: workOrderId,
        asset_id: assetId,
        cluster_hash: sha256Hex(`MEND_LIVE_CLUSTER|${workOrderId}`),
        scope_hash: scopeHash,
        dao_proposal_id: proposalId,
        policy_hash: policyDigest,
        budget: budgetMicro,
        sponsor,
        contractor_roster: contractorRoster,
        inspector_roster: inspectorRoster,
        commit_deadline: commitDeadline,
        reveal_deadline: revealDeadline,
      });

      await this.step('dao_authorize', 'dao_authorize', 'dao_authorize', 'dao', this.chain.hubAccount, {
        work_order_id: workOrderId,
        proposal_id: proposalId,
        scope_hash: scopeHash,
        policy_hash: policyDigest,
        budget: budgetMicro,
        contractor_roster: contractorRoster,
        inspector_roster: inspectorRoster,
        commit_deadline: commitDeadline,
        reveal_deadline: revealDeadline,
      });

      await this.step('fund_work_order', 'fund', 'ft_transfer_call', 'sponsor', this.chain.tokenAccount, {
        receiver_id: this.chain.hubAccount,
        amount: budgetMicro,
        memo: 'MEND live scenario funding (test value only)',
        msg: workOrderId,
      }, { deposit: 1n, gas: 100_000_000_000_000n });

      await this.step('open_bidding', 'open_bidding', 'open_bidding', 'steward', this.chain.hubAccount, {
        work_order_id: workOrderId,
      });

      const bidPayloadVersion = this.bidPayloadVersion;
      const bidInput: BidCommitmentInput = {
        bidId,
        contractorId: contractor,
        priceMicro,
        durationDays: DURATION_DAYS,
        warrantyDays: WARRANTY_DAYS,
        materialsScore: MATERIALS_SCORE,
        availableInDays: 0,
        evidenceChecklistAccepted: true,
        nonce,
      };
      const commitmentHash = bidPayloadVersion === 'v1'
        ? bidCommitmentHashV1(bidInput)
        : bidCommitmentHash(bidInput);

      await this.step('commit_bid', 'commit_bid', 'commit_bid', 'contractor', this.chain.hubAccount, {
        work_order_id: workOrderId,
        bid_id: bidId,
        commitment_hash: commitmentHash,
      });

      await this.waitUntil(commitAt + 3000);
      await this.step('reveal_bid', 'reveal_bid', 'reveal_bid', 'contractor', this.chain.hubAccount, {
        work_order_id: workOrderId,
        bid_id: bidId,
        price: priceMicro,
        duration_days: DURATION_DAYS,
        warranty_days: WARRANTY_DAYS,
        materials_score: MATERIALS_SCORE,
        available_in_days: 0,
        checklist_accepted: true,
        nonce,
      });

      await this.waitUntil(revealAt + 3000);
      await this.step('close_bidding', 'close_bidding', 'close_bidding', 'steward', this.chain.hubAccount, {
        work_order_id: workOrderId,
      });

      const ranking = [{
        rank: 1,
        bidId,
        contractorId: contractor,
        scoreBps: 9000,
      }];
      const executionId = `EXEC-${suffix}`;
      await this.step('record_score', 'record_score', 'record_score', 'steward', this.chain.hubAccount, {
        work_order_id: workOrderId,
        execution_id: executionId,
        policy_hash: policyDigest,
        wasm_hash: sha256Hex('MEND_LIVE_SCORE_WASM|local-deterministic'),
        input_hash: sha256Hex(`MEND_LIVE_SCORE_INPUT|${workOrderId}|${commitmentHash}`),
        output_hash: sha256Hex(`MEND_LIVE_SCORE_OUTPUT|${JSON.stringify(ranking)}`),
        ranking,
      });

      await this.step('award', 'award', 'award', 'steward', this.chain.hubAccount, {
        work_order_id: workOrderId,
        bid_id: bidId,
      });

      await this.step('start_work', 'start_work', 'start_work', 'contractor', this.chain.hubAccount, {
        work_order_id: workOrderId,
      });

      const evidenceId = `EVID-${suffix}`;
      const evidenceHash = sha256Hex(`MEND_LIVE_EVIDENCE|${workOrderId}|completion-photos`);
      await this.step('submit_completion', 'submit_completion', 'submit_completion', 'contractor', this.chain.hubAccount, {
        work_order_id: workOrderId,
        evidence_id: evidenceId,
        evidence_hash: evidenceHash,
      });

      const completionInspectionId = `INS-C-${suffix}`;
      await this.step('accept_completion', 'accept_completion', 'accept_completion', 'inspector', this.chain.hubAccount, {
        work_order_id: workOrderId,
        inspection_id: completionInspectionId,
        notes_hash: sha256Hex(`MEND_LIVE_COMPLETION_NOTES|${workOrderId}|approved`),
      });

      const durabilityMinutes = await this.durabilityMinutes();
      await this.waitUntil(this.now().getTime() + durabilityMinutes * 60_000 + 3000);
      const durabilityInspectionId = `INS-D-${suffix}`;
      await this.step('inspect_durability', 'inspect_durability', 'inspect_durability', 'inspector', this.chain.hubAccount, {
        work_order_id: workOrderId,
        passed: true,
        inspection_id: durabilityInspectionId,
        notes_hash: sha256Hex(`MEND_LIVE_DURABILITY_NOTES|${workOrderId}|passed`),
      });

      const final = await this.chain.view<HubWorkOrderView>(
        this.chain.hubAccount,
        'get_work_order',
        { work_order_id: workOrderId },
      );
      const finalStatus = String(final?.status ?? 'UNKNOWN');
      const contractVerified = finalStatus === 'CLOSED';
      return {
        scenario: 'canonicalRepair',
        network: 'testnet',
        mode: 'LIVE_TESTNET',
        enabled: true,
        assetId,
        workOrderId,
        bidPayloadVersion,
        steps: [...this.steps],
        verification: {
          finalStatus,
          contractVerified,
          note: contractVerified
            ? 'Hub contract reports CLOSED after the durability inspection. Every step above is a real testnet transaction.'
            : 'Hub contract did not report CLOSED; the scenario is not presented as fully successful.',
        },
        startedAt,
        finishedAt: this.now().toISOString(),
        warning: 'NEAR testnet only. All amounts are test mUSDC with no real-world value.',
      };
    } catch (error) {
      if (error instanceof MendError) throw error;
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live testnet scenario failed', {
        completedSteps: this.steps.length,
        steps: this.steps,
        reason: safeMessage(error),
        secretsReturned: false,
      });
    }
  }

  private async preflight(): Promise<void> {
    const required: TestnetRole[] = ['deployer', 'steward', 'sponsor', 'dao', 'contractor', 'inspector'];
    const configuredVersion = this.config.liveScenario.bidPayloadVersion;
    if (configuredVersion !== 'auto') {
      this.bidPayloadVersion = configuredVersion;
    } else if (this.chain.detectBidPayloadVersion) {
      const detected = await this.chain.detectBidPayloadVersion();
      if (!detected) {
        throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: could not detect the hub bid payload version', {
          guidance:
            'Set MEND_LIVE_BID_PAYLOAD_VERSION=v1 or v2 explicitly, or restore RPC contract-code inspection. No work order was created.',
        });
      }
      this.bidPayloadVersion = detected;
    }

    const missing = required
      .map((role) => ({ role, account: this.roleAccount(role) }))
      .filter(({ account }) => !this.chain.keys.has(account));
    if (missing.length > 0) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: missing testnet signer(s)', {
        missingSigners: missing,
        guidance:
          'Add every role account to MEND_TESTNET_KEYS_FILE outside the repository. The runner refuses to start rather than run a partial lifecycle.',
        secretsReturned: false,
      });
    }

    let hub: HubConfigView;
    try {
      hub = await this.chain.view<HubConfigView>(this.chain.hubAccount, 'get_config', {});
    } catch (error) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: hub contract is unreachable', {
        reason: safeMessage(error),
        hub: this.chain.hubAccount,
      });
    }
    if (hub?.paused) {
      throw new MendError('CONTRACT_PAUSED', 'Live scenario refused: the hub contract is paused');
    }
    if (hub?.token && hub.token !== this.chain.tokenAccount) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: hub token does not match MEND_TOKEN_ACCOUNT', {
        hubToken: hub.token,
        configuredToken: this.chain.tokenAccount,
      });
    }
    if (hub?.dao && hub.dao !== this.roleAccount('dao')) {
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: hub DAO does not match MEND_DAO_ACCOUNT', {
        hubDao: hub.dao,
        configuredDao: this.roleAccount('dao'),
      });
    }

    const roleChecks: Array<{ role: TestnetRole; required: string; account: string }> = [
      { role: 'steward', required: 'STEWARD', account: this.roleAccount('steward') },
      { role: 'contractor', required: 'CONTRACTOR', account: this.roleAccount('contractor') },
      { role: 'inspector', required: 'INSPECTOR', account: this.roleAccount('inspector') },
    ];
    const missingRoles: string[] = [];
    for (const check of roleChecks) {
      const roles = await this.chain.view<string[]>(
        this.chain.hubAccount,
        'get_role',
        { account: check.account },
      );
      if (!Array.isArray(roles) || !roles.includes(check.required)) {
        missingRoles.push(`${check.account}:${check.required}`);
      }
    }
    if (missingRoles.length > 0) {
      throw new MendError('FORBIDDEN_ROLE', 'Live scenario refused: hub roles are missing', {
        missingRoles,
        guidance: 'Grant the roles with hub.set_role from the owner/DAO before running the scenario.',
      });
    }

    const sponsor = this.roleAccount('sponsor');
    try {
      const storage = await this.chain.storageBalance(sponsor);
      if (!storage) {
        await this.step(
          'register_sponsor_storage',
          'register_sponsor_storage',
          'storage_deposit',
          'deployer',
          this.chain.tokenAccount,
          { account_id: sponsor, registration_only: true },
          { deposit: 10_000_000_000_000_000_000_000n, gas: 30_000_000_000_000n },
        );
      }
      const balance = BigInt(await this.chain.ftBalance(sponsor));
      if (balance < BigInt(BUDGET_MICRO)) {
        const need = BigInt(BUDGET_MICRO) - balance;
        const deployer = this.roleAccount('deployer');
        const deployerBalance = BigInt(await this.chain.ftBalance(deployer));
        if (deployerBalance < need) {
          throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario refused: sponsor and deployer lack test mUSDC', {
            sponsor,
            sponsorBalanceMicro: balance.toString(),
            requiredMicro: BUDGET_MICRO,
            deployer,
            deployerBalanceMicro: deployerBalance.toString(),
          });
        }
        await this.step(
          'fund_sponsor',
          'fund_sponsor',
          'ft_transfer',
          'deployer',
          this.chain.tokenAccount,
          {
            receiver_id: sponsor,
            amount: need.toString(),
            memo: 'MEND live scenario sponsor top-up (test value only)',
          },
          { deposit: 1n, gas: 30_000_000_000_000n },
        );
      }
    } catch (error) {
      if (error instanceof MendError) throw error;
      throw new MendError('UPSTREAM_UNAVAILABLE', 'Live scenario preflight failed while checking sponsor funding', {
        sponsor,
        reason: safeMessage(error),
        completedSteps: this.steps.length,
        steps: this.steps,
      });
    }
  }

  private async durabilityMinutes(): Promise<number> {
    try {
      const hub = await this.chain.view<HubConfigView>(this.chain.hubAccount, 'get_config', {});
      const minutes = Number(hub?.durabilityMinutes ?? hub?.durability_minutes ?? this.config.durabilityMinutes);
      return Number.isFinite(minutes) && minutes > 0 ? minutes : this.config.durabilityMinutes;
    } catch {
      return this.config.durabilityMinutes;
    }
  }

  private async waitUntil(targetMs: number): Promise<void> {
    const remaining = targetMs - this.now().getTime();
    if (remaining > 0) await this.sleep(remaining);
  }

  private async step(
    label: string,
    action: string,
    method: string,
    role: TestnetRole,
    receiver: string,
    args: Record<string, unknown>,
    options: { deposit?: bigint; gas?: bigint } = {},
  ): Promise<void> {
    const signer = this.roleAccount(role);
    try {
      const tx = await this.chain.call(signer, receiver, method, args, options);
      const at = this.now().toISOString();
      const step: LiveScenarioStep = {
        index: this.steps.length + 1,
        label,
        action,
        method,
        signer,
        receiver,
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        status: 'SUCCESS',
        at,
      };
      this.steps.push(step);
      if (this.repo) {
        const seq = await this.repo.nextSequence('chain-command');
        await this.repo.createChainCommand({
          id: `CMD-${String(seq).padStart(4, '0')}`,
          action,
          method,
          args: { liveScenario: true, label, receiver },
          state: 'SUCCESS',
          mode: 'LIVE_TESTNET',
          adapter: 'live',
          txHash: tx.txHash,
          realTransaction: true,
          createdAt: at,
          updatedAt: at,
          isDemo: false,
        });
      }
    } catch (error) {
      if (error instanceof MissingTestnetSignerError) {
        throw new MendError('UPSTREAM_UNAVAILABLE', `Live scenario stopped: missing signer for ${label}`, {
          completedSteps: this.steps.length,
          steps: this.steps,
          missingSigner: error.accountId,
        });
      }
      if (error instanceof LiveChainTxFailure) {
        throw new MendError('UPSTREAM_UNAVAILABLE', `Live scenario stopped at ${label}: transaction failed`, {
          completedSteps: this.steps.length,
          steps: this.steps,
          failedStep: label,
          txHash: error.txHash ?? null,
          reason: safeMessage(error),
        });
      }
      throw new MendError('UPSTREAM_UNAVAILABLE', `Live scenario stopped at ${label}`, {
        completedSteps: this.steps.length,
        steps: this.steps,
        failedStep: label,
        reason: safeMessage(error),
      });
    }
  }
}

function scopeSummary(): string {
  return 'Canonical testnet repair: DAO-authorized, sealed bid, deterministic score, completion + durability holdback.';
}
