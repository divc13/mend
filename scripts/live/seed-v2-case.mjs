#!/usr/bin/env node
/**
 * Seed the real, recorded NEAR testnet V2 case into Postgres.
 *
 * Source of truth:
 *   infra/testnet-v2/live-state.json
 *   infra/testnet-v2/evidence/WO-BENCH-V2-001-0002-*.json
 *   infra/testnet-v2/score/WO-BENCH-V2-001-0002.score.json
 *   infra/testnet-v2/scope/WO-BENCH-V2-001-0002.scope.json
 *
 * The script is idempotent: every row has a stable primary key and is upserted.
 * It never invents transaction hashes or amounts. Payment tx hashes are left
 * NULL because the recorded payments are PENDING by contract design.
 *
 * Usage:
 *   node scripts/live/seed-v2-case.mjs --dry-run
 *   node scripts/live/seed-v2-case.mjs
 *
 * DATABASE_URL is read from the process environment, then from
 * apps/web/.env.local and .env.local. The value is never printed.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MIGRATIONS_DIR = path.join(ROOT, 'packages/db/migrations');
const DRY_RUN = process.argv.includes('--dry-run');

const WORK_ORDER_ID = 'WO-BENCH-V2-001-0002';
const REPORT_ID = 'R-001';
const DAO_APPROVAL_ID = 'DAO-V2-0001';

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileMeta(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  const bytes = readFileSync(absolute);
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: statSync(absolute).size,
  };
}

function nsToIso(value) {
  return new Date(Number(BigInt(String(value)) / 1_000_000n)).toISOString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnvironment() {
  if (process.env.DATABASE_URL) return;
  for (const relative of ['apps/web/.env.local', '.env.local']) {
    const file = path.join(ROOT, relative);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
  }
}

function buildSeed() {
  const live = readJson('infra/testnet-v2/live-state.json');
  const scope = readJson(`infra/testnet-v2/scope/${WORK_ORDER_ID}.scope.json`);
  const score = readJson(`infra/testnet-v2/score/${WORK_ORDER_ID}.score.json`);
  const completionEvidence = readJson(
    `infra/testnet-v2/evidence/${WORK_ORDER_ID}-completion.json`,
  );
  const completionInspection = readJson(
    `infra/testnet-v2/evidence/${WORK_ORDER_ID}-inspection-completion.json`,
  );
  const durabilityInspection = readJson(
    `infra/testnet-v2/evidence/${WORK_ORDER_ID}-inspection-durability.json`,
  );

  const assetId = live.asset?.assetId;
  const assetDocument = readJson(`infra/testnet-v2/asset/${assetId}.json`);
  assert(assetDocument.assetId === assetId, 'asset document id differs from live-state');
  assert(
    assetDocument.publicDescription === live.asset.description,
    'asset document description differs from live-state',
  );
  const workOrder = live.workOrder;
  assert(assetId === scope.assetId, 'asset id differs between live-state and scope');
  assert(workOrder.workOrderId === WORK_ORDER_ID, 'unexpected work order id in live-state');
  assert(workOrder.assetId === assetId, 'work order asset id differs from live-state asset');
  assert(scope.reportClusterId, 'scope is missing reportClusterId');
  assert(scope.daoProposalId === '1', 'scope DAO proposal id is not 1');
  assert(workOrder.daoProposalId === '1', 'live-state DAO proposal id is not 1');

  const policyHash = workOrder.policyHash;
  assert(score.policyHash === policyHash, 'score policy hash differs from live-state');
  assert(score.winnerBidId === workOrder.awardedBidId, 'score winner differs from awarded bid');
  assert(live.lifecycle?.score?.inputHash === score.inputHash, 'score input hash differs');
  assert(live.lifecycle?.score?.outputHash, 'score output hash is missing from live-state');

  const transcript = live.transactions ?? [];
  const txByStep = new Map(transcript.map((tx) => [tx.step, tx]));

  const tx = (step) => {
    const found = txByStep.get(step);
    assert(found?.hash, `recorded transaction missing: ${step}`);
    return found;
  };

  const history = (workOrder.history ?? []).filter(
    (event) => event.workOrderId === WORK_ORDER_ID,
  );
  const historyAt = (action, predicate = () => true) => {
    const found = history.find((event) => event.action === action && predicate(event));
    assert(found, `recorded history event missing: ${action}`);
    return found;
  };

  const escrow = workOrder.escrow;
  const funded = BigInt(escrow.funding);
  const expensed =
    BigInt(escrow.refunded) +
    BigInt(escrow.completionPaid) +
    BigInt(escrow.holdbackHeld) +
    BigInt(escrow.holdbackReleased);
  assert(funded === expensed, 'escrow does not reconcile');
  assert(escrow.escrowed === '0', 'recorded escrow is not fully settled');

  const payments = workOrder.payments ?? [];
  assert(payments.length === 3, 'expected exactly three recorded payments');
  const paymentAmount = (kind) =>
    payments.find((payment) => payment.kind === kind)?.amount;
  assert(paymentAmount('REFUND') === '20000000', 'refund amount is not 20 mUSDC');
  assert(paymentAmount('COMPLETION') === '72000000', 'completion amount is not 72 mUSDC');
  assert(paymentAmount('HOLDBACK') === '8000000', 'holdback amount is not 8 mUSDC');
  const paymentTotal = payments.reduce((sum, payment) => sum + BigInt(payment.amount), 0n);
  assert(paymentTotal === funded, 'payment amounts do not equal the funded budget');

  const commitments = workOrder.bids?.commitments ?? [];
  const reveals = workOrder.bids?.reveals ?? [];
  assert(commitments.length === 3, 'expected three bid commitments');
  assert(reveals.length === 3, 'expected three bid reveals');
  for (const reveal of reveals) {
    const commitment = commitments.find((item) => item.bidId === reveal.bidId);
    assert(commitment, `missing commitment for ${reveal.bidId}`);
    assert(commitment.commitmentHash === reveal.commitmentHash, `hash mismatch for ${reveal.bidId}`);
  }

  const evidenceFiles = [
    {
      id: 'EVOBJ-V2-0001',
      file: `infra/testnet-v2/evidence/${WORK_ORDER_ID}-completion.json`,
      createdAt: nsToIso(historyAt('completion_submitted').at),
    },
    {
      id: 'EVOBJ-V2-0002',
      file: `infra/testnet-v2/evidence/${WORK_ORDER_ID}-inspection-completion.json`,
      createdAt: nsToIso(historyAt('completion_accepted').at),
    },
    {
      id: 'EVOBJ-V2-0003',
      file: `infra/testnet-v2/evidence/${WORK_ORDER_ID}-inspection-durability.json`,
      createdAt: nsToIso(historyAt('durability_passed').at),
    },
  ].map((entry) => ({ ...entry, ...fileMeta(entry.file) }));

  assert(
    evidenceFiles[0].sha256 === live.lifecycle.evidence[0].hash,
    'completion evidence file hash does not match the recorded completion hash',
  );

  const workOrderCreated = historyAt('work_order_created');
  const lastEvent = history[history.length - 1];
  const authorized = tx('dao_vote_2_mend-steward');
  const daoVote1 = tx('dao_vote_1_mend-deployer');
  const daoAddProposal = tx('dao_add_proposal_authorize');
  const passportMint = tx(`passport_mint_${assetId}`);
  const assetCreate = tx(`asset_create_${assetId}`);

  // The recorded live-state names the public location as a text label only.
  // The read model requires coarse coordinates, so use the matching coarse pin
  // from the canonical bench fixture. This is flagged in missingFields.
  const publicLocation = {
    label: live.asset.location,
    coarseLat: 52.52,
    coarseLng: 13.405,
    area: live.asset.location.split(',')[0].trim(),
  };

  const scoreCreatedAt = nsToIso(historyAt('score_recorded').at);
  const completionSubmittedAt = nsToIso(historyAt('completion_submitted').at);
  const completionAcceptedAt = nsToIso(historyAt('completion_accepted').at);
  const durabilityPassedAt = nsToIso(historyAt('durability_passed').at);

  const asset = {
    id: assetId,
    public_description: live.asset.description,
    asset_type: assetDocument.assetType,
    public_location: publicLocation,
    passport_token_id: live.asset.passportTokenId,
    created_at: nsToIso(live.asset.createdAt),
    is_demo: false,
  };

  const cluster = {
    id: scope.reportClusterId,
    report_ids: [REPORT_ID],
    confidence_bps: 0,
    rationale:
      'Report-level cluster data was not recorded in the V2 live-state. The confirmed cluster id is preserved from the work-order scope; no confidence figure is claimed.',
    status: 'CONFIRMED',
    confirmed_by: workOrderCreated.actor,
    created_at: nsToIso(workOrderCreated.at),
    is_demo: false,
  };

  // There is no report body in the recorded live-state. Keep the minimum
  // read-model report that the scope's cluster requires, derived verbatim from
  // the recorded asset description and location. It is not presented as a new
  // on-chain report.
  const report = {
    id: REPORT_ID,
    asset_id: assetId,
    description: live.asset.description,
    public_location: publicLocation,
    redacted_media_hash: null,
    perceptual_hash: null,
    exif_stripped: false,
    status: 'CLUSTERED',
    cluster_id: scope.reportClusterId,
    source: 'WALLETLESS',
    created_at: nsToIso(live.asset.createdAt),
    is_demo: false,
  };

  const daoApproval = {
    id: DAO_APPROVAL_ID,
    dao_account: live.dao.accountId,
    proposal_id: scope.daoProposalId,
    budget_micro: scope.budgetMicro,
    contractor_roster: scope.contractorRoster,
    inspector_roster: scope.inspectorRoster,
    policy_hash: policyHash,
    state: 'APPROVED',
    approved_at: authorized.at,
    is_demo: false,
  };

  const workOrderRecord = {
    id: WORK_ORDER_ID,
    asset_id: assetId,
    report_cluster_id: scope.reportClusterId,
    scope_hash: workOrder.scopeHash,
    dao_approval_id: DAO_APPROVAL_ID,
    policy_hash: policyHash,
    budget_micro: workOrder.budgetMicro,
    status: workOrder.status,
    mode: 'LIVE_TESTNET',
    awarded_bid_id: workOrder.awardedBidId,
    contractor_id: workOrder.awardedContractor,
    inspector_id: workOrder.inspector,
    sponsor_id: workOrder.sponsor,
    funding_token: live.token.accountId,
    funding_tx_hash: workOrder.fundTx,
    durability_due_at: workOrder.durabilityDueAt,
    commit_deadline: workOrder.commitDeadline,
    reveal_deadline: workOrder.revealDeadline,
    paused_from: null,
    reopen_count: live.workOrder.warranty?.reopenCount ?? 0,
    created_at: nsToIso(workOrderCreated.at),
    updated_at: nsToIso(lastEvent.at),
    is_demo: false,
  };

  const bidCommitments = commitments.map((commitment) => ({
    work_order_id: WORK_ORDER_ID,
    bid_id: commitment.bidId,
    contractor_id: commitment.contractorId,
    commitment_hash: commitment.commitmentHash,
    committed_at: nsToIso(commitment.committedAt),
    is_demo: false,
  }));

  const bidReveals = reveals.map((reveal) => ({
    work_order_id: WORK_ORDER_ID,
    bid_id: reveal.bidId,
    contractor_id: reveal.contractorId,
    price_micro: reveal.price,
    duration_days: reveal.durationDays,
    warranty_days: reveal.warrantyDays,
    available_in_days: reveal.availableInDays,
    materials: '',
    materials_score: reveal.materialsScore,
    evidence_checklist_accepted: reveal.checklistAccepted,
    nonce: reveal.nonce,
    revealed_at: nsToIso(reveal.revealedAt),
    commitment_hash: reveal.commitmentHash,
    is_demo: false,
  }));

  const scoreRecord = {
    id: live.lifecycle.score.executionId,
    work_order_id: WORK_ORDER_ID,
    policy_hash: score.policyHash,
    wasm_hash: live.lifecycle.score.wasmHash,
    input_hash: score.inputHash,
    output_hash: live.lifecycle.score.outputHash,
    ranking: score.ranking,
    execution_ref: live.lifecycle.score.recordTx,
    verified: false,
    unavailable_reason: live.lifecycle.score.outlayerReason,
    created_at: scoreCreatedAt,
    is_demo: false,
  };

  const evidenceHashes = [
    completionEvidence.afterPhotoHash,
    completionEvidence.materialsReceiptHash,
    evidenceFiles[0].sha256,
    evidenceFiles[1].sha256,
    evidenceFiles[2].sha256,
  ];
  assert(new Set(evidenceHashes).size === evidenceHashes.length, 'duplicate evidence hash');

  const checklist = Object.fromEntries(
    (scope.evidenceChecklist ?? []).map((label) => [label, true]),
  );
  assert(Object.keys(checklist).length >= 4, 'scope evidence checklist is missing');

  const evidencePackage = {
    id: live.lifecycle.evidence[0].evidenceId,
    work_order_id: WORK_ORDER_ID,
    kind: 'COMPLETION',
    evidence_hashes: evidenceHashes,
    checklist,
    redacted: true,
    submitted_by: completionEvidence.contractorId,
    submitted_at: completionSubmittedAt,
    is_demo: false,
  };

  const evidenceObjects = evidenceFiles.map((entry) => ({
    id: entry.id,
    evidence_package_id: evidencePackage.id,
    storage_key: entry.file,
    sha256: entry.sha256,
    content_type: 'application/json',
    size_bytes: entry.sizeBytes,
    redacted: true,
    created_at: entry.createdAt,
  }));

  const inspections = [
    {
      id: completionInspection.inspectionId,
      work_order_id: WORK_ORDER_ID,
      kind: 'COMPLETION',
      inspector_id: completionInspection.inspectorId,
      decision: completionInspection.decision,
      evidence_package_id: evidencePackage.id,
      notes_hash: live.lifecycle.inspections.find(
        (item) => item.inspectionId === completionInspection.inspectionId,
      ).hash,
      signed_at: completionAcceptedAt,
      tx_hash: tx('completion_accept_INS-V2-0001').hash,
      is_demo: false,
    },
    {
      id: durabilityInspection.inspectionId,
      work_order_id: WORK_ORDER_ID,
      kind: 'DURABILITY',
      inspector_id: durabilityInspection.inspectorId,
      decision: durabilityInspection.decision,
      evidence_package_id: evidencePackage.id,
      notes_hash: live.lifecycle.inspections.find(
        (item) => item.inspectionId === durabilityInspection.inspectionId,
      ).hash,
      signed_at: durabilityPassedAt,
      tx_hash: tx('durability_pass_INS-V2-0002').hash,
      is_demo: false,
    },
  ];

  const escrowRecord = {
    work_order_id: WORK_ORDER_ID,
    token: live.token.accountId,
    funded_micro: escrow.funding,
    refunded_micro: escrow.refunded,
    completion_paid_micro: escrow.completionPaid,
    holdback_held_micro: escrow.holdbackHeld,
    holdback_released_micro: escrow.holdbackReleased,
    is_demo: false,
  };

  const paymentRecords = payments.map((payment) => ({
    id: payment.id,
    work_order_id: WORK_ORDER_ID,
    kind: payment.kind,
    amount_micro: payment.amount,
    recipient: payment.recipient,
    status: payment.status,
    tx_hash: null,
    released_at: null,
    label:
      'PENDING by contract design: the hub issued the NEP-141 transfer but did not observe the token receipt synchronously. No payment tx hash is claimed.',
    created_at: nsToIso(payment.createdAt),
    is_demo: false,
  }));

  const workOrderTransactions = transcript.filter(
    (entry) => entry.workOrderId === WORK_ORDER_ID,
  );
  assert(workOrderTransactions.length === 19, 'expected 19 final work-order transactions');

  const chainCommands = workOrderTransactions.map((entry) => {
    const args = Object.fromEntries(
      Object.entries(entry).filter(
        ([key]) =>
          !['hash', 'explorerUrl', 'finalStatus', 'at', 'step', 'method'].includes(key),
      ),
    );
    return {
      id: `CC-V2-${entry.step.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
      work_order_id: WORK_ORDER_ID,
      action: entry.step,
      method: entry.method,
      args,
      state: 'SUCCESS',
      mode: 'LIVE_TESTNET',
      adapter: 'near-testnet-recorded',
      tx_hash: entry.hash,
      error_code: null,
      error_message: null,
      real_transaction: true,
      created_at: entry.at,
      updated_at: entry.at,
      is_demo: false,
    };
  });

  const auditEvents = [];
  auditEvents.push({
    id: 'A-V2-0001',
    name: 'asset_created',
    actor: live.asset.createdBy,
    work_order_id: null,
    asset_id: assetId,
    at: assetCreate.at,
    data: {
      descriptionHash: live.asset.descriptionHash,
      locationHash: live.asset.locationHash,
      passportTokenId: live.asset.passportTokenId,
      txHash: assetCreate.hash,
      explorerUrl: assetCreate.explorerUrl,
    },
  });
  auditEvents.push({
    id: 'A-V2-0002',
    name: 'passport_minted',
    actor: live.asset.createdBy,
    work_order_id: null,
    asset_id: assetId,
    at: nsToIso(
      live.workOrder.history.find((event) => event.action === 'passport_minted').at,
    ),
    data: {
      tokenId: live.asset.passportTokenId,
      owner: live.asset.passportOwner,
      transferable: live.asset.transferable,
      legalOwnership: live.asset.legalOwnership,
      txHash: passportMint.hash,
      explorerUrl: passportMint.explorerUrl,
    },
  });

  const revealByActor = new Map(reveals.map((reveal) => [reveal.contractorId, reveal]));
  const commitmentByActor = new Map(
    commitments.map((commitment) => [commitment.contractorId, commitment]),
  );
  const paymentAt = (at) => payments.find((payment) => payment.createdAt === at);

  history.forEach((event) => {
    const data = { detailHash: event.detailHash ?? null };
    if (event.action === 'work_order_created') {
      Object.assign(data, {
        scopeHash: workOrder.scopeHash,
        daoProposalId: scope.daoProposalId,
        policyHash,
        budgetMicro: workOrder.budgetMicro,
        txHash: tx('work_order_create').hash,
      });
    } else if (event.action === 'policy_approved') {
      Object.assign(data, {
        proposalId: scope.daoProposalId,
        policyHash,
        addProposalTx: daoAddProposal.hash,
        authorizeTx: authorized.hash,
        votes: [
          { voter: daoVote1.signer, txHash: daoVote1.hash },
          { voter: authorized.signer, txHash: authorized.hash },
        ],
      });
    } else if (event.action === 'work_order_funded') {
      Object.assign(data, {
        amountMicro: workOrder.fundedMicro,
        token: live.token.accountId,
        txHash: tx('work_order_fund_100_musdc').hash,
      });
    } else if (event.action === 'bidding_opened') {
      Object.assign(data, {
        commitDeadline: workOrder.commitDeadline,
        revealDeadline: workOrder.revealDeadline,
        txHash: tx('work_order_open_bidding').hash,
      });
    } else if (event.action === 'bid_committed' || event.action === 'bid_revealed') {
      const commitment = commitmentByActor.get(event.actor);
      const reveal = revealByActor.get(event.actor);
      if (commitment) {
        Object.assign(data, {
          bidId: commitment.bidId,
          contractorId: commitment.contractorId,
          commitmentHash: commitment.commitmentHash,
        });
      }
      if (event.action === 'bid_revealed' && reveal) {
        Object.assign(data, {
          priceMicro: reveal.price,
          durationDays: reveal.durationDays,
          warrantyDays: reveal.warrantyDays,
          materialsScore: reveal.materialsScore,
          availableInDays: reveal.availableInDays,
        });
      }
      const commitTx = transcript.find(
        (entry) => entry.step === `bid_commit_${commitment?.bidId?.split('-')[1]}`,
      );
      const revealTx = transcript.find(
        (entry) => entry.step === `bid_reveal_${commitment?.bidId?.split('-')[1]}`,
      );
      if (event.action === 'bid_committed' && commitTx) data.txHash = commitTx.hash;
      if (event.action === 'bid_revealed' && revealTx) data.txHash = revealTx.hash;
    } else if (event.action === 'bidding_closed') {
      data.txHash = tx('bidding_close').hash;
    } else if (event.action === 'score_recorded') {
      Object.assign(data, {
        executionId: live.lifecycle.score.executionId,
        mode: live.lifecycle.score.mode,
        policyHash,
        inputHash: score.inputHash,
        outputHash: live.lifecycle.score.outputHash,
        winnerBidId: score.winnerBidId,
        txHash: tx('score_record_LOCAL_DETERMINISTIC').hash,
      });
    } else if (event.action === 'payment_released') {
      const payment = paymentAt(event.at);
      if (payment) {
        Object.assign(data, {
          paymentId: payment.id,
          kind: payment.kind,
          amountMicro: payment.amount,
          recipient: payment.recipient,
          status: payment.status,
        });
      }
    } else if (event.action === 'work_order_awarded') {
      Object.assign(data, {
        awardedBidId: workOrder.awardedBidId,
        contractorId: workOrder.awardedContractor,
        txHash: tx('award_winner').hash,
      });
    } else if (event.action === 'work_started') {
      Object.assign(data, {
        contractorId: workOrder.awardedContractor,
        txHash: tx('work_start').hash,
      });
    } else if (event.action === 'completion_submitted') {
      Object.assign(data, {
        evidenceId: evidencePackage.id,
        evidenceHash: evidenceFiles[0].sha256,
        txHash: tx('completion_submit_EV-V2-0001').hash,
      });
    } else if (event.action === 'completion_accepted') {
      Object.assign(data, {
        inspectionId: completionInspection.inspectionId,
        decision: completionInspection.decision,
        notesHash: evidenceFiles[1].sha256,
        txHash: tx('completion_accept_INS-V2-0001').hash,
      });
    } else if (event.action === 'durability_passed') {
      Object.assign(data, {
        inspectionId: durabilityInspection.inspectionId,
        decision: durabilityInspection.decision,
        notesHash: evidenceFiles[2].sha256,
        txHash: tx('durability_pass_INS-V2-0002').hash,
      });
    }

    auditEvents.push({
      id: `A-V2-${String(auditEvents.length + 1).padStart(4, '0')}`,
      name: event.action,
      actor: event.actor,
      work_order_id: WORK_ORDER_ID,
      asset_id: assetId,
      at: nsToIso(event.at),
      data,
    });
  });

  const missingFields = [
    'Report and cluster detail: live-state records only the scope cluster id (CL-V2-0001); no report body, report id, confidence or cluster rationale was recorded. A minimal read-model report R-001 is derived from the asset description, with confidence_bps=0.',
    'Public location coordinates: live-state records the text label only. The coarse pin 52.52, 13.405 (Riverside Park) is taken from the canonical bench fixture, not from the V2 live-state.',
    'Asset transferable/legal-ownership flags: recorded in live-state and enforced on-chain, but the assets table has no columns for them. Only passport_token_id is stored.',
    'Passport metadata and owner: no read-model columns. The on-chain token id is stored; owner/transferability live in the hub contract.',
    'Bid materials text: not recorded in live-state; stored as an empty string. All numeric bid fields are exact.',
    'Bid availability in the score ranking: recorded on-chain and in bid_reveals, but not part of the score JSON ranking. The ranking array is stored exactly as recorded.',
    'Payment tx hashes and released_at: not recorded; the three payments are PENDING by contract design, so tx_hash and released_at are NULL. No hash is guessed.',
    'DAO approval tx hashes: the dao_approvals table has no tx columns. add_proposal, both votes and authorization are stored in chain_commands and audit_events.',
    'Evidence bytes for the after-photo and materials receipt: only their hashes were recorded. Evidence objects exist for the three JSON files that are actually in the repository.',
    'Report private case link and private media: not recorded; no report_private row is created.',
    'Warranty case: live-state records warranty state NONE; no warranty_cases row is created.',
    'Work-order scope text: the read model stores only scope_hash; there is no scope-text column. The approved text remains in infra/testnet-v2/scope/WO-BENCH-V2-001-0002.scope.json and the case view marks scope unavailable.',
    'Local read-model identifiers: DAO-V2-0001 (proposal 1 is the recorded external key), R-001 (no report id was recorded), and CC-V2-*/A-V2-* (stable import ids for real transactions and history events).',
    'Aborted work order WO-BENCH-V2-001-0001 and the failed factory attempt: real history, but excluded from this final-case seed and final accounting.',
  ];

  return {
    asset,
    cluster,
    report,
    daoApproval,
    workOrder: workOrderRecord,
    bidCommitments,
    bidReveals,
    score: scoreRecord,
    evidencePackage,
    evidenceObjects,
    inspections,
    escrow: escrowRecord,
    payments: paymentRecords,
    chainCommands,
    auditEvents,
    missingFields,
    ids: {
      asset: assetId,
      workOrder: WORK_ORDER_ID,
      cluster: scope.reportClusterId,
      report: REPORT_ID,
      daoApproval: DAO_APPROVAL_ID,
      proposalId: scope.daoProposalId,
      commitments: bidCommitments.map((row) => row.bid_id),
      reveals: bidReveals.map((row) => row.bid_id),
      score: scoreRecord.id,
      evidencePackage: evidencePackage.id,
      evidenceObjects: evidenceObjects.map((row) => row.id),
      inspections: inspections.map((row) => row.id),
      payments: paymentRecords.map((row) => row.id),
      chainCommands: chainCommands.map((row) => row.id),
      auditEvents: auditEvents.map((row) => row.id),
    },
  };
}

function recordCounts(seed) {
  return {
    assets: 1,
    report_clusters: 1,
    reports: 1,
    dao_approvals: 1,
    work_orders: 1,
    bid_commitments: seed.bidCommitments.length,
    bid_reveals: seed.bidReveals.length,
    score_executions: 1,
    evidence_packages: 1,
    evidence_objects: seed.evidenceObjects.length,
    inspections: seed.inspections.length,
    escrow_accounts: 1,
    payments: seed.payments.length,
    chain_commands: seed.chainCommands.length,
    audit_events: seed.auditEvents.length,
  };
}

function totalCount(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

/** Mirrors packages/db/src/migrate.ts so this script runs with plain `node` (no tsx). */
async function runMigrations(pool) {
  const entries = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && !name.endsWith('.down.sql'))
    .sort();
  const client = await pool.connect();
  const applied = [];
  const skipped = [];
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    for (const entry of entries) {
      const existing = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [entry],
      );
      if (existing.rows.length > 0) {
        skipped.push(entry);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, entry), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [entry]);
        await client.query('COMMIT');
        applied.push(entry);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${entry} failed: ${error.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
  return { applied, skipped };
}

const JSON_COLUMNS = new Set(['public_location', 'ranking', 'checklist', 'args']);

async function upsert(client, table, columns, conflictColumns, row) {
  const values = columns.map((column) => {
    const value = row[column];
    if (value === undefined) return null;
    if (JSON_COLUMNS.has(column) && value !== null) return JSON.stringify(value);
    return value;
  });
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`);
  const sql =
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updates.join(', ')}`;
  await client.query(sql, values);
}

async function applySeed(client, seed) {
  await upsert(
    client,
    'assets',
    [
      'id',
      'public_description',
      'asset_type',
      'public_location',
      'passport_token_id',
      'created_at',
      'is_demo',
    ],
    ['id'],
    seed.asset,
  );

  await upsert(
    client,
    'report_clusters',
    [
      'id',
      'report_ids',
      'confidence_bps',
      'rationale',
      'status',
      'confirmed_by',
      'created_at',
      'is_demo',
    ],
    ['id'],
    seed.cluster,
  );

  const existingReport = await client.query('SELECT asset_id FROM reports WHERE id = $1', [
    seed.report.id,
  ]);
  if (
    existingReport.rows.length > 0 &&
    existingReport.rows[0].asset_id !== seed.report.asset_id
  ) {
    throw new Error(
      `report id ${seed.report.id} already belongs to asset ${existingReport.rows[0].asset_id}`,
    );
  }
  await upsert(
    client,
    'reports',
    [
      'id',
      'asset_id',
      'description',
      'public_location',
      'redacted_media_hash',
      'perceptual_hash',
      'exif_stripped',
      'status',
      'cluster_id',
      'source',
      'created_at',
      'is_demo',
    ],
    ['id'],
    seed.report,
  );

  await upsert(
    client,
    'dao_approvals',
    [
      'id',
      'dao_account',
      'proposal_id',
      'budget_micro',
      'contractor_roster',
      'inspector_roster',
      'policy_hash',
      'state',
      'approved_at',
      'is_demo',
    ],
    ['id'],
    seed.daoApproval,
  );

  await upsert(
    client,
    'work_orders',
    [
      'id',
      'asset_id',
      'report_cluster_id',
      'scope_hash',
      'dao_approval_id',
      'policy_hash',
      'budget_micro',
      'status',
      'mode',
      'awarded_bid_id',
      'contractor_id',
      'inspector_id',
      'sponsor_id',
      'funding_token',
      'funding_tx_hash',
      'durability_due_at',
      'commit_deadline',
      'reveal_deadline',
      'paused_from',
      'reopen_count',
      'created_at',
      'updated_at',
      'is_demo',
    ],
    ['id'],
    seed.workOrder,
  );

  for (const row of seed.bidCommitments) {
    await upsert(
      client,
      'bid_commitments',
      [
        'work_order_id',
        'bid_id',
        'contractor_id',
        'commitment_hash',
        'committed_at',
        'is_demo',
      ],
      ['work_order_id', 'bid_id'],
      row,
    );
  }

  for (const row of seed.bidReveals) {
    await upsert(
      client,
      'bid_reveals',
      [
        'work_order_id',
        'bid_id',
        'contractor_id',
        'price_micro',
        'duration_days',
        'warranty_days',
        'available_in_days',
        'materials',
        'materials_score',
        'evidence_checklist_accepted',
        'nonce',
        'revealed_at',
        'commitment_hash',
        'is_demo',
      ],
      ['work_order_id', 'bid_id'],
      row,
    );
  }

  await upsert(
    client,
    'score_executions',
    [
      'id',
      'work_order_id',
      'policy_hash',
      'wasm_hash',
      'input_hash',
      'output_hash',
      'ranking',
      'execution_ref',
      'verified',
      'unavailable_reason',
      'created_at',
      'is_demo',
    ],
    ['id'],
    seed.score,
  );

  await upsert(
    client,
    'evidence_packages',
    [
      'id',
      'work_order_id',
      'kind',
      'evidence_hashes',
      'checklist',
      'redacted',
      'submitted_by',
      'submitted_at',
      'is_demo',
    ],
    ['id'],
    seed.evidencePackage,
  );

  for (const row of seed.evidenceObjects) {
    await upsert(
      client,
      'evidence_objects',
      [
        'id',
        'evidence_package_id',
        'storage_key',
        'sha256',
        'content_type',
        'size_bytes',
        'redacted',
        'created_at',
      ],
      ['id'],
      row,
    );
  }

  for (const row of seed.inspections) {
    await upsert(
      client,
      'inspections',
      [
        'id',
        'work_order_id',
        'kind',
        'inspector_id',
        'decision',
        'evidence_package_id',
        'notes_hash',
        'signed_at',
        'tx_hash',
        'is_demo',
      ],
      ['id'],
      row,
    );
  }

  await upsert(
    client,
    'escrow_accounts',
    [
      'work_order_id',
      'token',
      'funded_micro',
      'refunded_micro',
      'completion_paid_micro',
      'holdback_held_micro',
      'holdback_released_micro',
      'is_demo',
    ],
    ['work_order_id'],
    seed.escrow,
  );

  for (const row of seed.payments) {
    await upsert(
      client,
      'payments',
      [
        'id',
        'work_order_id',
        'kind',
        'amount_micro',
        'recipient',
        'status',
        'tx_hash',
        'released_at',
        'label',
        'created_at',
        'is_demo',
      ],
      ['id'],
      row,
    );
  }

  for (const row of seed.chainCommands) {
    await upsert(
      client,
      'chain_commands',
      [
        'id',
        'work_order_id',
        'action',
        'method',
        'args',
        'state',
        'mode',
        'adapter',
        'tx_hash',
        'error_code',
        'error_message',
        'real_transaction',
        'created_at',
        'updated_at',
        'is_demo',
      ],
      ['id'],
      row,
    );
  }

  for (const row of seed.auditEvents) {
    await client.query(
      `INSERT INTO audit_events (id, name, actor, work_order_id, asset_id, at, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.name,
        row.actor,
        row.work_order_id,
        row.asset_id,
        row.at,
        row.data,
      ],
    );
  }
}

async function verify(client, seed) {
  const count = async (sql, params = []) => {
    const result = await client.query(sql, params);
    return Number(result.rows[0]?.count ?? 0);
  };
  const counts = {
    assets: await count('SELECT count(*) FROM assets WHERE id = $1', [seed.ids.asset]),
    report_clusters: await count('SELECT count(*) FROM report_clusters WHERE id = $1', [
      seed.ids.cluster,
    ]),
    reports: await count('SELECT count(*) FROM reports WHERE id = $1', [seed.ids.report]),
    dao_approvals: await count('SELECT count(*) FROM dao_approvals WHERE id = $1', [
      seed.ids.daoApproval,
    ]),
    work_orders: await count('SELECT count(*) FROM work_orders WHERE id = $1', [
      seed.ids.workOrder,
    ]),
    bid_commitments: await count(
      'SELECT count(*) FROM bid_commitments WHERE work_order_id = $1',
      [seed.ids.workOrder],
    ),
    bid_reveals: await count('SELECT count(*) FROM bid_reveals WHERE work_order_id = $1', [
      seed.ids.workOrder,
    ]),
    score_executions: await count('SELECT count(*) FROM score_executions WHERE id = $1', [
      seed.ids.score,
    ]),
    evidence_packages: await count(
      'SELECT count(*) FROM evidence_packages WHERE id = $1',
      [seed.ids.evidencePackage],
    ),
    evidence_objects: await count(
      'SELECT count(*) FROM evidence_objects WHERE evidence_package_id = $1',
      [seed.ids.evidencePackage],
    ),
    inspections: await count('SELECT count(*) FROM inspections WHERE work_order_id = $1', [
      seed.ids.workOrder,
    ]),
    escrow_accounts: await count(
      'SELECT count(*) FROM escrow_accounts WHERE work_order_id = $1',
      [seed.ids.workOrder],
    ),
    payments: await count('SELECT count(*) FROM payments WHERE work_order_id = $1', [
      seed.ids.workOrder,
    ]),
    chain_commands: await count(
      "SELECT count(*) FROM chain_commands WHERE work_order_id = $1 AND id LIKE 'CC-V2-%'",
      [seed.ids.workOrder],
    ),
    audit_events: await count(
      "SELECT count(*) FROM audit_events WHERE asset_id = $1 AND id LIKE 'A-V2-%'",
      [seed.ids.asset],
    ),
  };

  const escrow = await client.query(
    `SELECT funded_micro, refunded_micro, completion_paid_micro,
            holdback_held_micro, holdback_released_micro
     FROM escrow_accounts WHERE work_order_id = $1`,
    [seed.ids.workOrder],
  );
  const paymentSums = await client.query(
    `SELECT coalesce(sum(amount_micro::numeric), 0)::text AS total,
            count(*)::int AS rows
     FROM payments WHERE work_order_id = $1`,
    [seed.ids.workOrder],
  );

  return {
    counts,
    escrow: escrow.rows[0] ?? null,
    payments: paymentSums.rows[0] ?? null,
  };
}

async function main() {
  const seed = buildSeed();
  const counts = recordCounts(seed);

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          records: counts,
          total: totalCount(counts),
        },
        null,
        2,
      ),
    );
    return;
  }

  loadEnvironment();
  assert(process.env.DATABASE_URL, 'DATABASE_URL is not set (process env or apps/web/.env.local)');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  let migrations;
  try {
    migrations = await runMigrations(pool);
    const client = await pool.connect();
    let verification;
    try {
      await client.query('BEGIN');
      await applySeed(client, seed);
      verification = await verify(client, seed);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    console.log(
      JSON.stringify(
        {
          mode: 'seed',
          migrations,
          records: counts,
          total: totalCount(counts),
          ids: seed.ids,
          verification,
          missingFields: seed.missingFields,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[seed-v2-case] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
