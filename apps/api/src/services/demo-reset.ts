import {
  FIXTURE_ACCOUNTS,
  FIXTURE_ASSET_BENCH,
  FIXTURE_ASSET_RACK,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_CLUSTER,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_RANKING,
  FIXTURE_EXPECTED_MONEY,
  FIXTURE_IDS,
  FIXTURE_POLICY,
  FIXTURE_REPORT_1,
  FIXTURE_REPORT_2,
  FIXTURE_TIMESTAMPS,
  MendError,
  REPLAY_LABEL,
  bidCommitmentHash,
  computeSplit,
  policyHash,
  sha256Hex,
  stableStringify,
} from '@mend/protocol';
import type { Repository, WorkOrderRecord } from '@mend/db';
import { stripUndefined } from '@mend/db';

export const DEMO_SCENARIOS = ['successfulRepair', 'duplicateReport', 'failedDurability', 'closed'] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export function isDemoScenario(value: string): value is DemoScenario {
  return (DEMO_SCENARIOS as readonly string[]).includes(value);
}

const H = (c: string) => c.repeat(64);
const COMPLETION_HASH = H('e');
const DURABILITY_HASH = H('f');

async function addAudit(
  repo: Repository,
  name: string,
  actor: string,
  at: string,
  meta: { workOrderId?: string; assetId?: string },
  data: Record<string, unknown> = {},
): Promise<void> {
  await repo.appendAudit({
    id: `A-${String(await repo.nextSequence('audit')).padStart(5, '0')}`,
    name,
    actor,
    at,
    ...meta,
    data,
  });
}

/** Keep generated IDs clear of canonical fixture IDs after a seed. */
async function advanceSequence(repo: Repository, name: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await repo.nextSequence(name);
}

async function seedAgents(repo: Repository): Promise<void> {
  const agents = [
    { account: FIXTURE_ACCOUNTS.steward, role: 'STEWARD' as const, methods: ['create_asset', 'create_work_order', 'open_bidding', 'close_bidding', 'award', 'cancel_work_order'], label: 'Human steward scope/budget approver' },
    { account: FIXTURE_ACCOUNTS.dao, role: 'DAO' as const, methods: ['dao_authorize', 'resolve_dispute', 'refund', 'set_role'], label: 'Sputnik DAO policy authority' },
    { account: FIXTURE_ACCOUNTS.sponsor, role: 'SPONSOR' as const, methods: ['ft_transfer_call'], label: 'Sponsor funding account' },
    { account: FIXTURE_ACCOUNTS.contractorA, role: 'CONTRACTOR' as const, methods: ['commit_bid', 'reveal_bid', 'start_work', 'submit_completion'], label: 'Contractor A scoped function-call key' },
    { account: FIXTURE_ACCOUNTS.contractorB, role: 'CONTRACTOR' as const, methods: ['commit_bid', 'reveal_bid', 'start_work', 'submit_completion'], label: 'Contractor B scoped function-call key' },
    { account: FIXTURE_ACCOUNTS.contractorC, role: 'CONTRACTOR' as const, methods: ['commit_bid', 'reveal_bid', 'start_work', 'submit_completion'], label: 'Contractor C scoped function-call key' },
    { account: FIXTURE_ACCOUNTS.inspector, role: 'INSPECTOR' as const, methods: ['accept_completion', 'inspect_durability'], label: 'Human inspector' },
    { account: FIXTURE_ACCOUNTS.inspector2, role: 'INSPECTOR' as const, methods: ['accept_completion', 'inspect_durability'], label: 'Second human inspector' },
    { account: FIXTURE_ACCOUNTS.coordinatorAi, role: 'COORDINATOR_AI' as const, methods: ['create_asset', 'create_work_order'], label: 'Coordinator AI (draft-only authority)' },
    { account: FIXTURE_ACCOUNTS.reviewerAi, role: 'REVIEWER_AI' as const, methods: ['review_evidence'], label: 'Evidence-completeness reviewer AI' },
    { account: FIXTURE_ACCOUNTS.relayer, role: 'RELAYER' as const, methods: ['create_work_order', 'commit_bid', 'reveal_bid', 'submit_completion'], label: 'Meta-transaction relayer (allowlisted methods only)' },
    { account: 'demo-admin.mend.testnet', role: 'ADMIN' as const, methods: ['demo_reset'], label: 'Demo administrator (never a production signer)' },
  ];
  for (const agent of agents) {
    await repo.upsertAgent({
      account: agent.account,
      role: agent.role,
      keyKind: 'FUNCTION_CALL',
      allowedReceiver: FIXTURE_ACCOUNTS.hub,
      allowedMethods: agent.methods,
      canReleaseEscrow: false,
      label: agent.label,
      isDemo: true,
    });
  }
}

async function seedBase(repo: Repository): Promise<WorkOrderRecord> {
  await repo.createAsset({ ...FIXTURE_ASSET_BENCH, isDemo: true });
  await repo.createAsset({ ...FIXTURE_ASSET_RACK, isDemo: true });

  await repo.createCluster({ ...FIXTURE_CLUSTER, isDemo: true });
  const reportRecord = (report: typeof FIXTURE_REPORT_1) => ({
    id: report.id,
    assetId: report.assetId,
    description: report.description,
    publicLocation: report.publicLocation,
    redactedMediaHash: report.redactedMediaHash,
    perceptualHash: report.perceptualHash,
    exifStripped: report.exifStripped,
    status: report.status,
    clusterId: report.clusterId,
    createdAt: report.createdAt,
    source: 'WALLETLESS' as const,
    isDemo: true,
  });
  await repo.createReport(reportRecord(FIXTURE_REPORT_1));
  await repo.createReport(reportRecord(FIXTURE_REPORT_2));
  for (const [report, link] of [
    [FIXTURE_REPORT_1, FIXTURE_REPORT_1.reporterCaseLink],
    [FIXTURE_REPORT_2, FIXTURE_REPORT_2.reporterCaseLink],
  ] as const) {
    await repo.createReportPrivate({
      reportId: report.id,
      preciseLocation: { lat: 52.520001, lng: 13.405001 },
      reporterCaseLink: link!,
      caseLinkHash: sha256Hex(link!),
      retentionUntil: '2027-11-10T08:00:00.000Z',
    });
  }

  await repo.createDaoApproval({ ...FIXTURE_DAO_APPROVAL, isDemo: true });

  const workOrder: WorkOrderRecord = {
    ...{
      id: FIXTURE_IDS.workOrder,
      assetId: FIXTURE_IDS.assetBench,
      reportClusterId: FIXTURE_IDS.cluster,
      scopeHash: 'c'.repeat(64),
      daoApprovalId: FIXTURE_DAO_APPROVAL.id,
      policyHash: FIXTURE_DAO_APPROVAL.policyHash,
      budgetMicro: FIXTURE_EXPECTED_MONEY.sponsorBudgetMicro,
      status: 'AWARDED' as const,
      mode: 'REPLAY' as const,
      awardedBidId: FIXTURE_IDS.bidB,
      contractorId: FIXTURE_ACCOUNTS.contractorB,
      inspectorId: FIXTURE_ACCOUNTS.inspector,
      sponsorId: FIXTURE_ACCOUNTS.sponsor,
      fundingToken: FIXTURE_ACCOUNTS.token,
      fundingTxHash: 'replay:demo-funding',
      durabilityDueAt: FIXTURE_TIMESTAMPS.durabilityDue,
      commitDeadline: FIXTURE_TIMESTAMPS.revealStart,
      revealDeadline: FIXTURE_TIMESTAMPS.revealEnd,
      reopenCount: 0,
      createdAt: FIXTURE_TIMESTAMPS.assetCreated,
      updatedAt: FIXTURE_TIMESTAMPS.awarded,
      isDemo: true,
    },
  };
  await repo.createWorkOrder(workOrder);

  for (const commitment of FIXTURE_BID_COMMITMENTS) {
    await repo.createBidCommitment({
      workOrderId: workOrder.id,
      bidId: commitment.bidId,
      contractorId: commitment.contractorId,
      commitmentHash: commitment.commitmentHash,
      committedAt: FIXTURE_TIMESTAMPS.biddingOpen,
      isDemo: true,
    });
  }
  for (const key of ['A', 'B', 'C'] as const) {
    const bid = FIXTURE_BID_INPUTS[key];
    await repo.createBidReveal({
      workOrderId: workOrder.id,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      priceMicro: bid.priceMicro,
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materials: key === 'A' ? 'Standard galvanised bolts' : key === 'B' ? 'Marine-grade stainless hardware and sealed timber' : 'Recycled composite plank',
      materialsScore: bid.materialsScore,
      evidenceChecklistAccepted: bid.evidenceChecklistAccepted,
      nonce: bid.nonce,
      revealedAt: FIXTURE_TIMESTAMPS.revealStart,
      commitmentHash: bidCommitmentHash(bid),
      isDemo: true,
    });
  }

  const outputHash = sha256Hex(stableStringify(FIXTURE_EXPECTED_RANKING));
  await repo.createScoreExecution({
    id: FIXTURE_IDS.scoreExecution,
    workOrderId: workOrder.id,
    policyHash: policyHash(FIXTURE_POLICY),
    wasmHash: sha256Hex('MEND_BID_RULES_LOCAL_V1|demo'),
    inputHash: sha256Hex('MEND_SCORE_INPUT_V1|demo'),
    outputHash,
    ranking: [...FIXTURE_EXPECTED_RANKING],
    executionRef: 'local-replay:demo',
    verified: false,
    unavailableReason: 'OutLayer execution unavailable in this wave; local deterministic integer replay.',
    createdAt: FIXTURE_TIMESTAMPS.scored,
    isDemo: true,
  });
  await repo.createAttestation({
    id: 'ATT-0001',
    kind: 'LOCAL_REPLAY',
    subjectHash: outputHash,
    artifact: { kind: 'LOCAL_DETERMINISTIC_SCORE', ranking: FIXTURE_EXPECTED_RANKING, outlayerExecuted: false },
    artifactHash: outputHash,
    verified: true,
    unavailableReason: 'Not an OutLayer execution.',
    createdAt: FIXTURE_TIMESTAMPS.scored,
    isDemo: true,
  });

  await repo.upsertEscrow({
    workOrderId: workOrder.id,
    token: FIXTURE_ACCOUNTS.token,
    fundedMicro: FIXTURE_EXPECTED_MONEY.sponsorBudgetMicro,
    refundedMicro: FIXTURE_EXPECTED_MONEY.refundMicro,
    completionPaidMicro: '0',
    holdbackHeldMicro: '0',
    holdbackReleasedMicro: '0',
    isDemo: true,
  });
  await repo.createPayment({
    id: 'PMT-0001',
    workOrderId: workOrder.id,
    kind: 'REFUND',
    amountMicro: FIXTURE_EXPECTED_MONEY.refundMicro,
    recipient: FIXTURE_ACCOUNTS.sponsor,
    status: 'SUCCESS',
    txHash: 'replay:demo-refund',
    releasedAt: FIXTURE_TIMESTAMPS.awarded,
    label: REPLAY_LABEL,
    createdAt: FIXTURE_TIMESTAMPS.awarded,
    isDemo: true,
  });

  await repo.createChainCommand({
    id: 'CMD-DEMO-0001',
    workOrderId: workOrder.id,
    action: 'award',
    method: 'award',
    args: { bidId: FIXTURE_IDS.bidB },
    state: 'SUCCESS',
    mode: 'REPLAY',
    adapter: 'replay',
    txHash: 'replay:demo-award',
    realTransaction: false,
    createdAt: FIXTURE_TIMESTAMPS.awarded,
    updatedAt: FIXTURE_TIMESTAMPS.awarded,
    isDemo: true,
  });

  await repo.createTriageSuggestion({
    id: 'TRG-0001',
    reportId: FIXTURE_IDS.report1,
    provider: 'NEAR AI Cloud',
    available: false,
    duplicateCandidates: [
      { reportId: FIXTURE_IDS.report2, scoreBps: 9_500, reasons: ['identical perceptual hash', 'same asset'] },
    ],
    rationale: 'Private AI inference is unavailable; deterministic duplicate heuristic only.',
    unavailableReason: 'NEAR_AI_API_KEY is not configured',
    createdAt: FIXTURE_TIMESTAMPS.report1,
    isDemo: true,
  });

  await seedAgents(repo);

  const meta = { workOrderId: workOrder.id, assetId: FIXTURE_IDS.assetBench };
  await addAudit(repo, 'work_order_created', FIXTURE_ACCOUNTS.steward, FIXTURE_TIMESTAMPS.assetCreated, meta, {
    scopeHash: workOrder.scopeHash,
    budgetMicro: workOrder.budgetMicro,
  });
  await addAudit(repo, 'policy_approved', FIXTURE_ACCOUNTS.dao, FIXTURE_TIMESTAMPS.policyApproved, meta, {
    daoProposalId: FIXTURE_IDS.daoProposal,
    policyHash: workOrder.policyHash,
  });
  await addAudit(repo, 'work_order_funded', FIXTURE_ACCOUNTS.sponsor, FIXTURE_TIMESTAMPS.funded, meta, {
    amountMicro: workOrder.budgetMicro,
    realTransaction: false,
  });
  await addAudit(repo, 'bidding_opened', FIXTURE_ACCOUNTS.steward, FIXTURE_TIMESTAMPS.biddingOpen, meta, {});
  for (const commitment of FIXTURE_BID_COMMITMENTS) {
    await addAudit(repo, 'bid_committed', commitment.contractorId, FIXTURE_TIMESTAMPS.biddingOpen, meta, {
      bidId: commitment.bidId,
    });
  }
  for (const bid of Object.values(FIXTURE_BID_INPUTS)) {
    await addAudit(repo, 'bid_revealed', bid.contractorId, FIXTURE_TIMESTAMPS.revealStart, meta, { bidId: bid.bidId });
  }
  await addAudit(repo, 'score_recorded', FIXTURE_ACCOUNTS.steward, FIXTURE_TIMESTAMPS.scored, meta, {
    executionId: FIXTURE_IDS.scoreExecution,
    winnerBidId: FIXTURE_IDS.bidB,
    verified: false,
  });
  await addAudit(repo, 'work_order_awarded', FIXTURE_ACCOUNTS.steward, FIXTURE_TIMESTAMPS.awarded, meta, {
    bidId: FIXTURE_IDS.bidB,
    contractorId: FIXTURE_ACCOUNTS.contractorB,
    refundMicro: FIXTURE_EXPECTED_MONEY.refundMicro,
  });

  await advanceSequence(repo, 'report', 2);
  await advanceSequence(repo, 'cluster', 1);
  await advanceSequence(repo, 'payment', 1);
  await advanceSequence(repo, 'score-execution', 1);
  await advanceSequence(repo, 'attestation', 1);
  await advanceSequence(repo, 'triage', 1);
  await advanceSequence(repo, `work-order:${FIXTURE_IDS.assetBench}`, 1);

  return workOrder;
}

async function seedCompletion(repo: Repository, workOrder: WorkOrderRecord): Promise<void> {
  await repo.createEvidencePackage({
    id: FIXTURE_IDS.evidenceCompletion,
    workOrderId: workOrder.id,
    kind: 'COMPLETION',
    evidenceHashes: [COMPLETION_HASH],
    checklist: { beforePhoto: true, afterPhoto: true, materialsReceipt: true, safety: true },
    redacted: true,
    submittedBy: FIXTURE_ACCOUNTS.contractorB,
    submittedAt: FIXTURE_TIMESTAMPS.completionSubmitted,
    isDemo: true,
  });
  await repo.createInspection({
    id: FIXTURE_IDS.inspectionCompletion,
    workOrderId: workOrder.id,
    kind: 'COMPLETION',
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    decision: 'APPROVED',
    evidencePackageId: FIXTURE_IDS.evidenceCompletion,
    notesHash: H('1'),
    signedAt: FIXTURE_TIMESTAMPS.completionAccepted,
    isDemo: true,
  });
  const reveal = await repo.getBidReveal(workOrder.id, FIXTURE_IDS.bidB);
  if (!reveal) throw new Error('demo seed: winning bid reveal missing');
  const split = computeSplit(BigInt(reveal.priceMicro));
  await repo.upsertEscrow({
    workOrderId: workOrder.id,
    token: FIXTURE_ACCOUNTS.token,
    fundedMicro: FIXTURE_EXPECTED_MONEY.sponsorBudgetMicro,
    refundedMicro: FIXTURE_EXPECTED_MONEY.refundMicro,
    completionPaidMicro: split.completion.toString(),
    holdbackHeldMicro: split.holdback.toString(),
    holdbackReleasedMicro: '0',
    isDemo: true,
  });
  await repo.createPayment({
    id: 'PMT-0002',
    workOrderId: workOrder.id,
    kind: 'COMPLETION',
    amountMicro: split.completion.toString(),
    recipient: FIXTURE_ACCOUNTS.contractorB,
    status: 'SUCCESS',
    txHash: 'replay:demo-completion',
    releasedAt: FIXTURE_TIMESTAMPS.completionAccepted,
    label: REPLAY_LABEL,
    createdAt: FIXTURE_TIMESTAMPS.completionAccepted,
    isDemo: true,
  });
  await addAudit(repo, 'completion_submitted', FIXTURE_ACCOUNTS.contractorB, FIXTURE_TIMESTAMPS.completionSubmitted, {
    workOrderId: workOrder.id,
    assetId: workOrder.assetId,
  }, { evidenceId: FIXTURE_IDS.evidenceCompletion, evidenceHash: COMPLETION_HASH });
  await addAudit(repo, 'completion_accepted', FIXTURE_ACCOUNTS.inspector, FIXTURE_TIMESTAMPS.completionAccepted, {
    workOrderId: workOrder.id,
    assetId: workOrder.assetId,
  }, { inspectionId: FIXTURE_IDS.inspectionCompletion, firstAcceptance: true });
  await advanceSequence(repo, 'evidence', 1);
  await advanceSequence(repo, 'inspection', 1);
  await advanceSequence(repo, 'payment', 1);
}

async function seedClosed(repo: Repository, workOrder: WorkOrderRecord): Promise<void> {
  await seedCompletion(repo, workOrder);
  await repo.createInspection({
    id: FIXTURE_IDS.inspectionDurability,
    workOrderId: workOrder.id,
    kind: 'DURABILITY',
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    decision: 'APPROVED',
    evidencePackageId: FIXTURE_IDS.evidenceCompletion,
    notesHash: H('2'),
    signedAt: FIXTURE_TIMESTAMPS.durabilityPassed,
    isDemo: true,
  });
  const escrow = await repo.getEscrow(workOrder.id);
  if (!escrow) throw new Error('demo seed: escrow missing');
  await repo.upsertEscrow({
    ...escrow,
    holdbackHeldMicro: '0',
    holdbackReleasedMicro: escrow.holdbackHeldMicro,
  });
  await repo.createPayment({
    id: 'PMT-0003',
    workOrderId: workOrder.id,
    kind: 'HOLDBACK',
    amountMicro: escrow.holdbackHeldMicro,
    recipient: FIXTURE_ACCOUNTS.contractorB,
    status: 'SUCCESS',
    txHash: 'replay:demo-holdback',
    releasedAt: FIXTURE_TIMESTAMPS.durabilityPassed,
    label: REPLAY_LABEL,
    createdAt: FIXTURE_TIMESTAMPS.durabilityPassed,
    isDemo: true,
  });
  await repo.updateWorkOrder(workOrder.id, { status: 'CLOSED', updatedAt: FIXTURE_TIMESTAMPS.durabilityPassed });
  await addAudit(repo, 'durability_passed', FIXTURE_ACCOUNTS.inspector, FIXTURE_TIMESTAMPS.durabilityPassed, {
    workOrderId: workOrder.id,
    assetId: workOrder.assetId,
  }, { inspectionId: FIXTURE_IDS.inspectionDurability });
  await advanceSequence(repo, 'inspection', 1);
  await advanceSequence(repo, 'payment', 1);
}

async function seedFailedDurability(repo: Repository, workOrder: WorkOrderRecord): Promise<void> {
  await seedCompletion(repo, workOrder);
  await repo.createInspection({
    id: FIXTURE_IDS.inspectionDurability,
    workOrderId: workOrder.id,
    kind: 'DURABILITY',
    inspectorId: FIXTURE_ACCOUNTS.inspector,
    decision: 'REJECTED',
    evidencePackageId: FIXTURE_IDS.evidenceCompletion,
    notesHash: H('3'),
    signedAt: FIXTURE_TIMESTAMPS.warrantyFailed,
    isDemo: true,
  });
  await repo.updateWorkOrder(workOrder.id, {
    status: 'WARRANTY_REOPENED',
    reopenCount: 1,
    updatedAt: FIXTURE_TIMESTAMPS.warrantyFailed,
  });
  await repo.createWarrantyCase({
    id: FIXTURE_IDS.warrantyCase,
    workOrderId: workOrder.id,
    failedInspectionId: FIXTURE_IDS.inspectionDurability,
    state: 'OPEN',
    openedAt: FIXTURE_TIMESTAMPS.warrantyFailed,
    isDemo: true,
  });
  await addAudit(repo, 'durability_inspection_recorded', FIXTURE_ACCOUNTS.inspector, FIXTURE_TIMESTAMPS.warrantyFailed, {
    workOrderId: workOrder.id,
    assetId: workOrder.assetId,
  }, { passed: false, inspectionId: FIXTURE_IDS.inspectionDurability });
  await addAudit(repo, 'warranty_reopened', FIXTURE_ACCOUNTS.inspector, FIXTURE_TIMESTAMPS.warrantyFailed, {
    workOrderId: workOrder.id,
    assetId: workOrder.assetId,
  }, { newFundingMicro: '0', reopenCount: 1 });
  await advanceSequence(repo, 'inspection', 1);
  await advanceSequence(repo, 'warranty', 1);
}

/**
 * Resets only rows marked `isDemo` and reseeds a deterministic canonical state.
 * Audit events deliberately survive because they are append-only; the public
 * state fingerprint excludes them and must be identical across repeated resets.
 */
export async function resetDemoState(
  repo: Repository,
  scenario: DemoScenario = 'successfulRepair',
): Promise<{ scenario: DemoScenario; fingerprint: string }> {
  if (!isDemoScenario(scenario)) {
    throw new MendError('VALIDATION_ERROR', 'Unknown demo scenario', { supported: DEMO_SCENARIOS });
  }
  await repo.transaction(async (tx) => {
    await tx.clearDemoData();
    const workOrder = await seedBase(tx);
    if (scenario === 'closed') await seedClosed(tx, workOrder);
    if (scenario === 'failedDurability') await seedFailedDurability(tx, workOrder);
    // successfulRepair and duplicateReport start at the canonical AWARDED state.
  });
  return { scenario, fingerprint: await demoStateFingerprint(repo) };
}

/**
 * Deterministic fingerprint of the demo public state. It includes all public
 * records and excludes private report data, audit history and id sequences.
 */
export async function demoStateFingerprint(repo: Repository): Promise<string> {
  const assets = (await repo.listAssets()).filter((a) => a.isDemo).sort((a, b) => a.id.localeCompare(b.id));
  const reports = (await repo.listReports()).filter((r) => r.isDemo).sort((a, b) => a.id.localeCompare(b.id));
  const clusters = (await repo.listClusters()).filter((c) => c.isDemo).sort((a, b) => a.id.localeCompare(b.id));
  const approvals = (await repo.listDaoApprovals()).filter((a) => a.isDemo).sort((a, b) => a.id.localeCompare(b.id));
  const workOrders = (await repo.listWorkOrders()).filter((w) => w.isDemo).sort((a, b) => a.id.localeCompare(b.id));
  const agents = (await repo.listAgents()).filter((a) => a.isDemo).sort((a, b) => `${a.account}:${a.role}`.localeCompare(`${b.account}:${b.role}`));

  const workOrderState = [];
  for (const workOrder of workOrders) {
    const [commitments, reveals, scores, evidence, inspections, escrow, payments, warranties, commands] = await Promise.all([
      repo.listBidCommitments(workOrder.id),
      repo.listBidReveals(workOrder.id),
      repo.listScoreExecutions(workOrder.id),
      repo.listEvidencePackages(workOrder.id),
      repo.listInspections(workOrder.id),
      repo.getEscrow(workOrder.id),
      repo.listPayments(workOrder.id),
      repo.listWarrantyCases(workOrder.id),
      repo.listChainCommands(workOrder.id),
    ]);
    const attestations = [];
    for (const score of scores) {
      attestations.push(...(await repo.listAttestationsBySubject(score.outputHash)));
    }
    workOrderState.push({
      workOrder,
      commitments,
      reveals,
      scores,
      evidence,
      inspections,
      escrow,
      payments,
      warranties,
      commands,
      attestations,
    });
  }

  const triage = [];
  for (const report of reports) {
    triage.push(...(await repo.listTriageSuggestions(report.id)));
  }
  const sortedTriage = triage.sort((a, b) => a.id.localeCompare(b.id));

  return sha256Hex(stableStringify(stripUndefined({
    assets,
    reports,
    clusters,
    approvals,
    workOrderState,
    agents,
    triage: sortedTriage,
  })));
}
