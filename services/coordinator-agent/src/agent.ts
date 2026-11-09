import {
  AssetSchema,
  FIXTURE_POLICY,
  MendError,
  WorkOrderSchema,
  canonicalWorkOrderId,
  makeEvent,
  policyHash,
  sha256Hex,
  stableStringify,
} from '@mend/protocol';
import type { Asset, MendEvent, WorkOrder } from '@mend/protocol';
import { assertTrustedFieldsUnchanged, guardUntrustedText } from '@mend/near-client';
import { CoordinatorAuditLog } from './audit.js';
import { assertCoordinatorMethod } from './policy.js';
import { CoordinatorIntakeSchema, ScopeProposalSchema } from './schemas.js';
import type { CoordinatorIntake, ScopeProposal } from './schemas.js';

export interface CoordinatorAgentConfig {
  actor: string;
  fundingToken: string;
  /** Deterministic clock for fixtures/tests. */
  clock?: () => string;
}

export interface CoordinatorProposal {
  requestId: string;
  draftAsset: Asset;
  draftWorkOrder: WorkOrder;
  scope: ScopeProposal & { scopeHash: string };
  auditEvents: readonly MendEvent[];
  humanApprovalRequired: true;
}

export class CoordinatorAgent {
  readonly actor: string;
  readonly fundingToken: string;
  private readonly clock: () => string;
  private readonly audit = new CoordinatorAuditLog();

  constructor(config: CoordinatorAgentConfig) {
    this.actor = config.actor;
    this.fundingToken = config.fundingToken;
    this.clock = config.clock ?? (() => new Date().toISOString());
  }

  get auditLog(): readonly MendEvent[] {
    return this.audit.all();
  }

  /**
   * Intake is parsed strictly. Untrusted report text is scanned and retained
   * only as a log entry; the draft asset description comes from the trusted
   * steward scope, so injected instructions never become asset content.
   */
  propose(rawIntake: unknown): CoordinatorProposal {
    const intake = CoordinatorIntakeSchema.parse(rawIntake);
    if (intake.mode === 'MAINNET') {
      throw new MendError('FORBIDDEN_ROLE', 'the coordinator agent may not prepare mainnet drafts');
    }

    const now = this.clock();
    const reportScan = guardUntrustedText(intake.publicDescription, {
      source: 'report-description',
      actor: this.actor,
      assetId: intake.assetId,
      timestamp: now,
    });
    if (reportScan.blockedEvent) this.audit.append(reportScan.blockedEvent);

    const rationaleScan = guardUntrustedText(intake.cluster.rationale, {
      source: 'cluster-rationale',
      actor: this.actor,
      assetId: intake.assetId,
      timestamp: now,
    });
    if (rationaleScan.blockedEvent) this.audit.append(rationaleScan.blockedEvent);

    const scope = ScopeProposalSchema.parse(intake.scope);
    const scopeHash = sha256Hex(stableStringify(scope));
    const scopeWithHash = { ...scope, scopeHash };
    assertTrustedFieldsUnchanged(scopeWithHash, {
      scopeHash,
      role: 'COORDINATOR_AI',
      accepted: 'HUMAN_ONLY',
    });

    const assetCandidate = {
      id: intake.assetId,
      publicDescription: scope.summary,
      assetType: intake.assetType,
      publicLocation: intake.publicLocation,
      createdAt: now,
    };
    const draftAsset = AssetSchema.parse(assetCandidate);

    const workOrderCandidate = {
      id: canonicalWorkOrderId(intake.assetId, intake.sequence),
      assetId: intake.assetId,
      reportClusterId: intake.cluster.id,
      scopeHash,
      daoApprovalId: `dao-pending-${intake.requestId}`,
      policyHash: policyHash(FIXTURE_POLICY),
      budgetMicro: scope.budgetRecommendationMicro,
      status: 'DRAFT' as const,
      mode: intake.mode,
      fundingToken: this.fundingToken,
      reopenCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const draftWorkOrder = WorkOrderSchema.parse(workOrderCandidate);

    assertTrustedFieldsUnchanged(draftWorkOrder, {
      scopeHash,
      budgetMicro: scope.budgetRecommendationMicro,
      role: 'COORDINATOR_AI',
      accepted: 'HUMAN_ONLY',
    });

    this.audit.append(
      makeEvent(
        'work_order_created',
        {
          requestId: intake.requestId,
          workOrderId: draftWorkOrder.id,
          assetId: draftWorkOrder.assetId,
          status: draftWorkOrder.status,
          budgetMicro: draftWorkOrder.budgetMicro,
          scopeHash,
          requestedBy: intake.requestedBy,
          role: 'COORDINATOR_AI',
          authority: 'DRAFT_ONLY',
        },
        { actor: this.actor, workOrderId: draftWorkOrder.id, assetId: draftWorkOrder.assetId, timestamp: now },
      ),
    );

    return {
      requestId: intake.requestId,
      draftAsset,
      draftWorkOrder,
      scope: scopeWithHash,
      auditEvents: this.audit.all(),
      humanApprovalRequired: true,
    };
  }

  /**
   * Single dispatch point used by tests and future command adapters. Every
   * privilege-bearing method is rejected before any signing could occur.
   */
  performAction(method: string): { allowed: true; method: string; authority: 'DRAFT_ONLY' } {
    assertCoordinatorMethod(method);
    this.audit.append(
      makeEvent(
        'work_order_created',
        { method, role: 'COORDINATOR_AI', authority: 'DRAFT_ONLY', signed: false },
        { actor: this.actor, timestamp: this.clock() },
      ),
    );
    return { allowed: true, method, authority: 'DRAFT_ONLY' };
  }
}
