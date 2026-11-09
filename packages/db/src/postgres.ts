import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import type {
  AgentRecord,
  AssetPatch,
  AssetRecord,
  AttestationRecord,
  AuditEventRecord,
  AuditFilter,
  BidCommitmentRecord,
  BidRevealRecord,
  ChainCommandPatch,
  ChainCommandRecord,
  ClusterPatch,
  DaoApprovalPatch,
  DaoApprovalRecord,
  EscrowRecord,
  EvidenceObjectRecord,
  EvidencePackageRecord,
  InspectionRecord,
  IntentExecutionPatch,
  IntentExecutionRecord,
  IntentQuotePatch,
  IntentQuoteRecord,
  ListFilter,
  PaymentPatch,
  PaymentRecord,
  ReportClusterRecord,
  ReportFilter,
  ReportPatch,
  ReportPrivateRecord,
  ReportRecord,
  Repository,
  ScoreExecutionRecord,
  TestnetWalletPatch,
  TestnetWalletRecord,
  TriageSuggestionRecord,
  WarrantyCaseRecord,
  WarrantyPatch,
  WorkOrderFilter,
  WorkOrderPatch,
  WorkOrderRecord,
} from './types.js';

type Row = Record<string, any>;

interface QueryExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
}

function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function requiredIso(value: unknown): string {
  const result = iso(value);
  if (!result) throw new Error('expected non-null timestamp');
  return result;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as T;
}

function opt<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function limitClause(filter: ListFilter | undefined, params: unknown[]): string {
  let sql = '';
  if (filter?.limit !== undefined) {
    params.push(filter.limit);
    sql += ` LIMIT $${params.length}`;
  }
  if (filter?.offset !== undefined) {
    params.push(filter.offset);
    sql += ` OFFSET $${params.length}`;
  }
  return sql;
}

function assetFromRow(row: Row): AssetRecord {
  return {
    id: row.id,
    publicDescription: row.public_description,
    assetType: row.asset_type,
    publicLocation: json(row.public_location, {} as AssetRecord['publicLocation']),
    passportTokenId: opt(row.passport_token_id),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function reportFromRow(row: Row): ReportRecord {
  return {
    id: row.id,
    assetId: row.asset_id,
    description: row.description,
    publicLocation: json(row.public_location, {} as ReportRecord['publicLocation']),
    redactedMediaHash: opt(row.redacted_media_hash),
    perceptualHash: opt(row.perceptual_hash),
    exifStripped: Boolean(row.exif_stripped),
    status: row.status,
    clusterId: opt(row.cluster_id),
    createdAt: requiredIso(row.created_at),
    source: row.source,
    isDemo: Boolean(row.is_demo),
  };
}

function clusterFromRow(row: Row): ReportClusterRecord {
  return {
    id: row.id,
    reportIds: row.report_ids ?? [],
    confidenceBps: num(row.confidence_bps),
    rationale: row.rationale,
    status: row.status,
    confirmedBy: opt(row.confirmed_by),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function daoApprovalFromRow(row: Row): DaoApprovalRecord {
  return {
    id: row.id,
    daoAccount: row.dao_account,
    proposalId: row.proposal_id,
    budgetMicro: row.budget_micro,
    contractorRoster: row.contractor_roster ?? [],
    inspectorRoster: row.inspector_roster ?? [],
    policyHash: row.policy_hash,
    state: row.state,
    approvedAt: iso(row.approved_at),
    isDemo: Boolean(row.is_demo),
  };
}

function workOrderFromRow(row: Row): WorkOrderRecord {
  return {
    id: row.id,
    assetId: row.asset_id,
    reportClusterId: row.report_cluster_id,
    scopeHash: row.scope_hash,
    daoApprovalId: row.dao_approval_id,
    policyHash: row.policy_hash,
    budgetMicro: row.budget_micro,
    status: row.status,
    mode: row.mode,
    awardedBidId: opt(row.awarded_bid_id),
    contractorId: opt(row.contractor_id),
    inspectorId: opt(row.inspector_id),
    sponsorId: opt(row.sponsor_id),
    fundingToken: row.funding_token,
    fundingTxHash: opt(row.funding_tx_hash),
    durabilityDueAt: iso(row.durability_due_at),
    commitDeadline: iso(row.commit_deadline),
    revealDeadline: iso(row.reveal_deadline),
    pausedFrom: opt(row.paused_from),
    reopenCount: num(row.reopen_count ?? 0),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    isDemo: Boolean(row.is_demo),
  };
}

function commitFromRow(row: Row): BidCommitmentRecord {
  return {
    workOrderId: row.work_order_id,
    bidId: row.bid_id,
    contractorId: row.contractor_id,
    commitmentHash: row.commitment_hash,
    committedAt: requiredIso(row.committed_at),
    isDemo: Boolean(row.is_demo),
  };
}

function revealFromRow(row: Row): BidRevealRecord {
  return {
    workOrderId: row.work_order_id,
    bidId: row.bid_id,
    contractorId: row.contractor_id,
    priceMicro: row.price_micro,
    durationDays: num(row.duration_days),
    warrantyDays: num(row.warranty_days),
    availableInDays: num(row.available_in_days),
    materials: row.materials ?? '',
    materialsScore: num(row.materials_score),
    evidenceChecklistAccepted: Boolean(row.evidence_checklist_accepted),
    nonce: row.nonce,
    revealedAt: requiredIso(row.revealed_at),
    commitmentHash: row.commitment_hash,
    isDemo: Boolean(row.is_demo),
  };
}

function scoreFromRow(row: Row): ScoreExecutionRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    policyHash: row.policy_hash,
    wasmHash: row.wasm_hash,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    ranking: json(row.ranking, []),
    executionRef: opt(row.execution_ref),
    verified: Boolean(row.verified),
    unavailableReason: opt(row.unavailable_reason),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function evidencePackageFromRow(row: Row): EvidencePackageRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    kind: row.kind,
    evidenceHashes: row.evidence_hashes ?? [],
    checklist: json(row.checklist, {}),
    redacted: true,
    submittedBy: row.submitted_by,
    submittedAt: requiredIso(row.submitted_at),
    isDemo: Boolean(row.is_demo),
  };
}

function evidenceObjectFromRow(row: Row): EvidenceObjectRecord {
  return {
    id: row.id,
    evidencePackageId: row.evidence_package_id,
    storageKey: row.storage_key,
    sha256: row.sha256,
    contentType: row.content_type,
    sizeBytes: num(row.size_bytes),
    redacted: Boolean(row.redacted),
    createdAt: requiredIso(row.created_at),
  };
}

function inspectionFromRow(row: Row): InspectionRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    kind: row.kind,
    inspectorId: row.inspector_id,
    decision: row.decision,
    evidencePackageId: row.evidence_package_id,
    notesHash: opt(row.notes_hash),
    signedAt: requiredIso(row.signed_at),
    txHash: opt(row.tx_hash),
    isDemo: Boolean(row.is_demo),
  };
}

function escrowFromRow(row: Row): EscrowRecord {
  return {
    workOrderId: row.work_order_id,
    token: row.token,
    fundedMicro: row.funded_micro,
    refundedMicro: row.refunded_micro,
    completionPaidMicro: row.completion_paid_micro,
    holdbackHeldMicro: row.holdback_held_micro,
    holdbackReleasedMicro: row.holdback_released_micro,
    isDemo: Boolean(row.is_demo),
  };
}

function paymentFromRow(row: Row): PaymentRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    kind: row.kind,
    amountMicro: row.amount_micro,
    recipient: row.recipient,
    status: row.status,
    txHash: opt(row.tx_hash),
    releasedAt: iso(row.released_at),
    createdAt: requiredIso(row.created_at),
    label: opt(row.label),
    isDemo: Boolean(row.is_demo),
  };
}

function warrantyFromRow(row: Row): WarrantyCaseRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    failedInspectionId: row.failed_inspection_id,
    state: row.state,
    openedAt: requiredIso(row.opened_at),
    closedAt: iso(row.closed_at),
    isDemo: Boolean(row.is_demo),
  };
}

function agentFromRow(row: Row): AgentRecord {
  return {
    account: row.account,
    role: row.role,
    keyKind: row.key_kind,
    allowedReceiver: row.allowed_receiver,
    allowedMethods: row.allowed_methods ?? [],
    allowanceMicro: opt(row.allowance_micro),
    canReleaseEscrow: false,
    label: row.label,
    isDemo: Boolean(row.is_demo),
  };
}

function attestationFromRow(row: Row): AttestationRecord {
  return {
    id: row.id,
    kind: row.kind,
    subjectHash: row.subject_hash,
    artifact: json(row.artifact, {}),
    artifactHash: row.artifact_hash,
    signature: opt(row.signature),
    verified: Boolean(row.verified),
    unavailableReason: opt(row.unavailable_reason),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function intentQuoteFromRow(row: Row): IntentQuoteRecord {
  return {
    id: row.id,
    dry: Boolean(row.dry),
    srcChain: row.src_chain,
    srcAsset: row.src_asset,
    dstChain: 'near',
    dstAsset: row.dst_asset,
    amountIn: row.amount_in,
    amountOut: row.amount_out,
    feesUsd: row.fees_usd === null || row.fees_usd === undefined ? undefined : num(row.fees_usd),
    recipient: row.recipient,
    depositAddress: opt(row.deposit_address),
    depositMemo: opt(row.deposit_memo),
    deadline: iso(row.deadline),
    status: row.status,
    workOrderId: opt(row.work_order_id),
    raw: row.raw === null || row.raw === undefined ? undefined : json(row.raw, {}),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function intentExecutionFromRow(row: Row): IntentExecutionRecord {
  return {
    id: row.id,
    quoteId: row.quote_id,
    workOrderId: row.work_order_id,
    status: row.status,
    destinationTxHash: opt(row.destination_tx_hash),
    explorerUrl: opt(row.explorer_url),
    updatedAt: requiredIso(row.updated_at),
    isDemo: Boolean(row.is_demo),
  };
}

function triageFromRow(row: Row): TriageSuggestionRecord {
  return {
    id: row.id,
    reportId: row.report_id,
    provider: row.provider,
    model: opt(row.model),
    available: Boolean(row.available),
    confidenceBps: row.confidence_bps === null || row.confidence_bps === undefined ? undefined : num(row.confidence_bps),
    rationale: opt(row.rationale),
    duplicateCandidates: json(row.duplicate_candidates, []),
    scope: opt(row.scope),
    attestationId: opt(row.attestation_id),
    unavailableReason: opt(row.unavailable_reason),
    createdAt: requiredIso(row.created_at),
    isDemo: Boolean(row.is_demo),
  };
}

function testnetWalletFromRow(row: Row): TestnetWalletRecord {
  return {
    accountId: row.account_id,
    publicKey: row.public_key,
    network: 'testnet',
    createdAt: requiredIso(row.created_at),
    ...(opt(iso(row.last_faucet_at)) ? { lastFaucetAt: iso(row.last_faucet_at) } : {}),
    ...(opt(row.last_faucet_ip_hash) ? { lastFaucetIpHash: row.last_faucet_ip_hash } : {}),
    faucetCount: num(row.faucet_count),
  };
}

function chainCommandFromRow(row: Row): ChainCommandRecord {
  return {
    id: row.id,
    workOrderId: opt(row.work_order_id),
    action: row.action,
    method: row.method,
    args: json(row.args, {}),
    state: row.state,
    mode: row.mode,
    adapter: row.adapter,
    txHash: opt(row.tx_hash),
    errorCode: opt(row.error_code),
    errorMessage: opt(row.error_message),
    realTransaction: Boolean(row.real_transaction),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    isDemo: Boolean(row.is_demo),
  };
}

function auditFromRow(row: Row): AuditEventRecord {
  return {
    id: row.id,
    name: row.name,
    actor: row.actor,
    workOrderId: opt(row.work_order_id),
    assetId: opt(row.asset_id),
    at: requiredIso(row.at),
    data: json(row.data, {}),
  };
}

/**
 * Postgres repository. All values are parameterised; dynamic SET clauses use
 * positional parameters built from a fixed field allow-list.
 */
export class PgRepository implements Repository {
  readonly kind = 'postgres' as const;
  private readonly pool?: Pool;

  constructor(private readonly executor: QueryExecutor, pool?: Pool) {
    this.pool = pool;
  }

  static fromPool(pool: Pool): PgRepository {
    return new PgRepository(pool, pool);
  }

  static fromConnectionString(connectionString: string): PgRepository {
    return PgRepository.fromPool(new Pool({ connectionString }));
  }

  async ping(): Promise<boolean> {
    try {
      await this.executor.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  async transaction<T>(fn: (repo: Repository) => Promise<T>): Promise<T> {
    if (!this.pool) return fn(this);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repo = new PgRepository(client, undefined);
      const result = await fn(repo);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // keep the original error
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async nextSequence(name: string): Promise<number> {
    const result = await this.executor.query(
      `INSERT INTO id_sequences (name, next_value) VALUES ($1, 2)
       ON CONFLICT (name) DO UPDATE SET next_value = id_sequences.next_value + 1
       RETURNING next_value - 1 AS value`,
      [name],
    );
    return num(result.rows[0]?.value);
  }

  async createAsset(asset: AssetRecord): Promise<AssetRecord> {
    const result = await this.executor.query(
      `INSERT INTO assets (id, public_description, asset_type, public_location, passport_token_id, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [asset.id, asset.publicDescription, asset.assetType, asset.publicLocation,
        asset.passportTokenId ?? null, asset.createdAt, asset.isDemo],
    );
    return assetFromRow(result.rows[0] as Row);
  }

  async getAsset(id: string): Promise<AssetRecord | null> {
    const result = await this.executor.query('SELECT * FROM assets WHERE id = $1', [id]);
    return result.rows[0] ? assetFromRow(result.rows[0] as Row) : null;
  }

  async listAssets(filter?: ListFilter): Promise<AssetRecord[]> {
    const params: unknown[] = [];
    const result = await this.executor.query(
      `SELECT * FROM assets ORDER BY created_at ASC, id ASC${limitClause(filter, params)}`,
      params,
    );
    return result.rows.map((row) => assetFromRow(row as Row));
  }

  async updateAsset(id: string, patch: AssetPatch): Promise<AssetRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.publicDescription !== undefined) add('public_description', patch.publicDescription);
    if (patch.assetType !== undefined) add('asset_type', patch.assetType);
    if (patch.publicLocation !== undefined) add('public_location', patch.publicLocation);
    if (patch.passportTokenId !== undefined) add('passport_token_id', patch.passportTokenId);
    if (sets.length === 0) return this.getAsset(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE assets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? assetFromRow(result.rows[0] as Row) : null;
  }

  async deleteAsset(id: string): Promise<boolean> {
    const result = await this.executor.query('DELETE FROM assets WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createReport(report: ReportRecord): Promise<ReportRecord> {
    const result = await this.executor.query(
      `INSERT INTO reports (id, asset_id, description, public_location, redacted_media_hash, perceptual_hash,
         exif_stripped, status, cluster_id, source, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [report.id, report.assetId, report.description, report.publicLocation,
        report.redactedMediaHash ?? null, report.perceptualHash ?? null, report.exifStripped,
        report.status, report.clusterId ?? null, report.source, report.createdAt, report.isDemo],
    );
    return reportFromRow(result.rows[0] as Row);
  }

  async getReport(id: string): Promise<ReportRecord | null> {
    const result = await this.executor.query('SELECT * FROM reports WHERE id = $1', [id]);
    return result.rows[0] ? reportFromRow(result.rows[0] as Row) : null;
  }

  async listReports(filter?: ReportFilter): Promise<ReportRecord[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.assetId) {
      params.push(filter.assetId);
      where.push(`asset_id = $${params.length}`);
    }
    if (filter?.clusterId) {
      params.push(filter.clusterId);
      where.push(`cluster_id = $${params.length}`);
    }
    const sql = `SELECT * FROM reports${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC, id ASC${limitClause(filter, params)}`;
    const result = await this.executor.query(sql, params);
    return result.rows.map((row) => reportFromRow(row as Row));
  }

  async updateReport(id: string, patch: ReportPatch): Promise<ReportRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.clusterId !== undefined) add('cluster_id', patch.clusterId);
    if (sets.length === 0) return this.getReport(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE reports SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? reportFromRow(result.rows[0] as Row) : null;
  }

  async createReportPrivate(record: ReportPrivateRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO report_private (report_id, precise_location, reporter_case_link, case_link_hash,
         private_media_key, private_media_hash, retention_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [record.reportId, record.preciseLocation ?? null, record.reporterCaseLink, record.caseLinkHash,
        record.privateMediaKey ?? null, record.privateMediaHash ?? null, record.retentionUntil ?? null],
    );
  }

  async getReportPrivate(reportId: string): Promise<ReportPrivateRecord | null> {
    const result = await this.executor.query('SELECT * FROM report_private WHERE report_id = $1', [reportId]);
    if (!result.rows[0]) return null;
    const row = result.rows[0] as Row;
    return {
      reportId: row.report_id,
      preciseLocation: opt(row.precise_location),
      reporterCaseLink: row.reporter_case_link,
      caseLinkHash: row.case_link_hash,
      privateMediaKey: opt(row.private_media_key),
      privateMediaHash: opt(row.private_media_hash),
      retentionUntil: iso(row.retention_until),
    };
  }

  async findReportByCaseLinkHash(hash: string): Promise<ReportRecord | null> {
    const result = await this.executor.query(
      `SELECT r.* FROM reports r
       JOIN report_private p ON p.report_id = r.id
       WHERE p.case_link_hash = $1`,
      [hash],
    );
    return result.rows[0] ? reportFromRow(result.rows[0] as Row) : null;
  }

  async createCluster(cluster: ReportClusterRecord): Promise<ReportClusterRecord> {
    const result = await this.executor.query(
      `INSERT INTO report_clusters (id, report_ids, confidence_bps, rationale, status, confirmed_by, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [cluster.id, cluster.reportIds, cluster.confidenceBps, cluster.rationale, cluster.status,
        cluster.confirmedBy ?? null, cluster.createdAt, cluster.isDemo],
    );
    return clusterFromRow(result.rows[0] as Row);
  }

  async getCluster(id: string): Promise<ReportClusterRecord | null> {
    const result = await this.executor.query('SELECT * FROM report_clusters WHERE id = $1', [id]);
    return result.rows[0] ? clusterFromRow(result.rows[0] as Row) : null;
  }

  async listClusters(filter?: ListFilter): Promise<ReportClusterRecord[]> {
    const params: unknown[] = [];
    const result = await this.executor.query(
      `SELECT * FROM report_clusters ORDER BY created_at ASC, id ASC${limitClause(filter, params)}`,
      params,
    );
    return result.rows.map((row) => clusterFromRow(row as Row));
  }

  async updateCluster(id: string, patch: ClusterPatch): Promise<ReportClusterRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.reportIds !== undefined) add('report_ids', patch.reportIds);
    if (patch.confidenceBps !== undefined) add('confidence_bps', patch.confidenceBps);
    if (patch.rationale !== undefined) add('rationale', patch.rationale);
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.confirmedBy !== undefined) add('confirmed_by', patch.confirmedBy);
    if (sets.length === 0) return this.getCluster(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE report_clusters SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? clusterFromRow(result.rows[0] as Row) : null;
  }

  async createDaoApproval(approval: DaoApprovalRecord): Promise<DaoApprovalRecord> {
    const result = await this.executor.query(
      `INSERT INTO dao_approvals (id, dao_account, proposal_id, budget_micro, contractor_roster,
         inspector_roster, policy_hash, state, approved_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [approval.id, approval.daoAccount, approval.proposalId, approval.budgetMicro,
        approval.contractorRoster, approval.inspectorRoster, approval.policyHash, approval.state,
        approval.approvedAt ?? null, approval.isDemo],
    );
    return daoApprovalFromRow(result.rows[0] as Row);
  }

  async getDaoApproval(id: string): Promise<DaoApprovalRecord | null> {
    const result = await this.executor.query('SELECT * FROM dao_approvals WHERE id = $1', [id]);
    return result.rows[0] ? daoApprovalFromRow(result.rows[0] as Row) : null;
  }

  async listDaoApprovals(filter?: ListFilter): Promise<DaoApprovalRecord[]> {
    const params: unknown[] = [];
    const result = await this.executor.query(
      `SELECT * FROM dao_approvals ORDER BY id ASC${limitClause(filter, params)}`,
      params,
    );
    return result.rows.map((row) => daoApprovalFromRow(row as Row));
  }

  async updateDaoApproval(id: string, patch: DaoApprovalPatch): Promise<DaoApprovalRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.state !== undefined) add('state', patch.state);
    if (patch.approvedAt !== undefined) add('approved_at', patch.approvedAt);
    if (sets.length === 0) return this.getDaoApproval(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE dao_approvals SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? daoApprovalFromRow(result.rows[0] as Row) : null;
  }

  async createWorkOrder(workOrder: WorkOrderRecord): Promise<WorkOrderRecord> {
    const result = await this.executor.query(
      `INSERT INTO work_orders (id, asset_id, report_cluster_id, scope_hash, dao_approval_id, policy_hash,
         budget_micro, status, mode, awarded_bid_id, contractor_id, inspector_id, sponsor_id, funding_token,
         funding_tx_hash, durability_due_at, commit_deadline, reveal_deadline, paused_from, reopen_count,
         created_at, updated_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [workOrder.id, workOrder.assetId, workOrder.reportClusterId, workOrder.scopeHash,
        workOrder.daoApprovalId, workOrder.policyHash, workOrder.budgetMicro, workOrder.status,
        workOrder.mode, workOrder.awardedBidId ?? null, workOrder.contractorId ?? null,
        workOrder.inspectorId ?? null, workOrder.sponsorId ?? null, workOrder.fundingToken,
        workOrder.fundingTxHash ?? null, workOrder.durabilityDueAt ?? null,
        workOrder.commitDeadline ?? null, workOrder.revealDeadline ?? null,
        workOrder.pausedFrom ?? null, workOrder.reopenCount, workOrder.createdAt,
        workOrder.updatedAt, workOrder.isDemo],
    );
    return workOrderFromRow(result.rows[0] as Row);
  }

  async getWorkOrder(id: string): Promise<WorkOrderRecord | null> {
    const result = await this.executor.query('SELECT * FROM work_orders WHERE id = $1', [id]);
    return result.rows[0] ? workOrderFromRow(result.rows[0] as Row) : null;
  }

  async listWorkOrders(filter?: WorkOrderFilter): Promise<WorkOrderRecord[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.assetId) {
      params.push(filter.assetId);
      where.push(`asset_id = $${params.length}`);
    }
    if (filter?.contractorId) {
      params.push(filter.contractorId);
      where.push(`contractor_id = $${params.length}`);
    }
    const sql = `SELECT * FROM work_orders${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC, id ASC${limitClause(filter, params)}`;
    const result = await this.executor.query(sql, params);
    return result.rows.map((row) => workOrderFromRow(row as Row));
  }

  async updateWorkOrder(id: string, patch: WorkOrderPatch): Promise<WorkOrderRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.scopeHash !== undefined) add('scope_hash', patch.scopeHash);
    if (patch.daoApprovalId !== undefined) add('dao_approval_id', patch.daoApprovalId);
    if (patch.policyHash !== undefined) add('policy_hash', patch.policyHash);
    if (patch.budgetMicro !== undefined) add('budget_micro', patch.budgetMicro);
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.awardedBidId !== undefined) add('awarded_bid_id', patch.awardedBidId);
    if (patch.contractorId !== undefined) add('contractor_id', patch.contractorId);
    if (patch.inspectorId !== undefined) add('inspector_id', patch.inspectorId);
    if (patch.sponsorId !== undefined) add('sponsor_id', patch.sponsorId);
    if (patch.fundingTxHash !== undefined) add('funding_tx_hash', patch.fundingTxHash);
    if (patch.durabilityDueAt !== undefined) add('durability_due_at', patch.durabilityDueAt);
    if (patch.commitDeadline !== undefined) add('commit_deadline', patch.commitDeadline);
    if (patch.revealDeadline !== undefined) add('reveal_deadline', patch.revealDeadline);
    if (patch.pausedFrom !== undefined) add('paused_from', patch.pausedFrom);
    if (patch.reopenCount !== undefined) add('reopen_count', patch.reopenCount);
    if (patch.updatedAt !== undefined) add('updated_at', patch.updatedAt);
    if (sets.length === 0) return this.getWorkOrder(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE work_orders SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? workOrderFromRow(result.rows[0] as Row) : null;
  }

  async createBidCommitment(commitment: BidCommitmentRecord): Promise<BidCommitmentRecord> {
    const result = await this.executor.query(
      `INSERT INTO bid_commitments (work_order_id, bid_id, contractor_id, commitment_hash, committed_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [commitment.workOrderId, commitment.bidId, commitment.contractorId,
        commitment.commitmentHash, commitment.committedAt, commitment.isDemo],
    );
    return commitFromRow(result.rows[0] as Row);
  }

  async getBidCommitment(workOrderId: string, bidId: string): Promise<BidCommitmentRecord | null> {
    const result = await this.executor.query(
      'SELECT * FROM bid_commitments WHERE work_order_id = $1 AND bid_id = $2',
      [workOrderId, bidId],
    );
    return result.rows[0] ? commitFromRow(result.rows[0] as Row) : null;
  }

  async listBidCommitments(workOrderId: string): Promise<BidCommitmentRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM bid_commitments WHERE work_order_id = $1 ORDER BY bid_id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => commitFromRow(row as Row));
  }

  async createBidReveal(reveal: BidRevealRecord): Promise<BidRevealRecord> {
    const result = await this.executor.query(
      `INSERT INTO bid_reveals (work_order_id, bid_id, contractor_id, price_micro, duration_days,
         warranty_days, available_in_days, materials, materials_score, evidence_checklist_accepted, nonce,
         revealed_at, commitment_hash, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [reveal.workOrderId, reveal.bidId, reveal.contractorId, reveal.priceMicro,
        reveal.durationDays, reveal.warrantyDays, reveal.availableInDays, reveal.materials,
        reveal.materialsScore, reveal.evidenceChecklistAccepted, reveal.nonce, reveal.revealedAt,
        reveal.commitmentHash, reveal.isDemo],
    );
    return revealFromRow(result.rows[0] as Row);
  }

  async getBidReveal(workOrderId: string, bidId: string): Promise<BidRevealRecord | null> {
    const result = await this.executor.query(
      'SELECT * FROM bid_reveals WHERE work_order_id = $1 AND bid_id = $2',
      [workOrderId, bidId],
    );
    return result.rows[0] ? revealFromRow(result.rows[0] as Row) : null;
  }

  async listBidReveals(workOrderId: string): Promise<BidRevealRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM bid_reveals WHERE work_order_id = $1 ORDER BY bid_id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => revealFromRow(row as Row));
  }

  async createScoreExecution(score: ScoreExecutionRecord): Promise<ScoreExecutionRecord> {
    const result = await this.executor.query(
      `INSERT INTO score_executions (id, work_order_id, policy_hash, wasm_hash, input_hash, output_hash,
         ranking, execution_ref, verified, unavailable_reason, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [score.id, score.workOrderId, score.policyHash, score.wasmHash, score.inputHash,
        score.outputHash, JSON.stringify(score.ranking), score.executionRef ?? null,
        score.verified, score.unavailableReason ?? null, score.createdAt, score.isDemo],
    );
    return scoreFromRow(result.rows[0] as Row);
  }

  async getScoreExecution(id: string): Promise<ScoreExecutionRecord | null> {
    const result = await this.executor.query('SELECT * FROM score_executions WHERE id = $1', [id]);
    return result.rows[0] ? scoreFromRow(result.rows[0] as Row) : null;
  }

  async listScoreExecutions(workOrderId: string): Promise<ScoreExecutionRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM score_executions WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => scoreFromRow(row as Row));
  }

  async getLatestScoreExecution(workOrderId: string): Promise<ScoreExecutionRecord | null> {
    const result = await this.executor.query(
      'SELECT * FROM score_executions WHERE work_order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
      [workOrderId],
    );
    return result.rows[0] ? scoreFromRow(result.rows[0] as Row) : null;
  }

  async createEvidencePackage(pkg: EvidencePackageRecord): Promise<EvidencePackageRecord> {
    const result = await this.executor.query(
      `INSERT INTO evidence_packages (id, work_order_id, kind, evidence_hashes, checklist, redacted,
         submitted_by, submitted_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8) RETURNING *`,
      [pkg.id, pkg.workOrderId, pkg.kind, pkg.evidenceHashes, JSON.stringify(pkg.checklist),
        pkg.submittedBy, pkg.submittedAt, pkg.isDemo],
    );
    return evidencePackageFromRow(result.rows[0] as Row);
  }

  async getEvidencePackage(id: string): Promise<EvidencePackageRecord | null> {
    const result = await this.executor.query('SELECT * FROM evidence_packages WHERE id = $1', [id]);
    return result.rows[0] ? evidencePackageFromRow(result.rows[0] as Row) : null;
  }

  async listEvidencePackages(workOrderId: string): Promise<EvidencePackageRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM evidence_packages WHERE work_order_id = $1 ORDER BY submitted_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => evidencePackageFromRow(row as Row));
  }

  async createEvidenceObject(object: EvidenceObjectRecord): Promise<EvidenceObjectRecord> {
    const result = await this.executor.query(
      `INSERT INTO evidence_objects (id, evidence_package_id, storage_key, sha256, content_type,
         size_bytes, redacted, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [object.id, object.evidencePackageId, object.storageKey, object.sha256,
        object.contentType, object.sizeBytes, object.redacted, object.createdAt],
    );
    return evidenceObjectFromRow(result.rows[0] as Row);
  }

  async getEvidenceObject(id: string): Promise<EvidenceObjectRecord | null> {
    const result = await this.executor.query('SELECT * FROM evidence_objects WHERE id = $1', [id]);
    return result.rows[0] ? evidenceObjectFromRow(result.rows[0] as Row) : null;
  }

  async listEvidenceObjects(evidencePackageId: string): Promise<EvidenceObjectRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM evidence_objects WHERE evidence_package_id = $1 ORDER BY created_at ASC, id ASC',
      [evidencePackageId],
    );
    return result.rows.map((row) => evidenceObjectFromRow(row as Row));
  }

  async createInspection(inspection: InspectionRecord): Promise<InspectionRecord> {
    const result = await this.executor.query(
      `INSERT INTO inspections (id, work_order_id, kind, inspector_id, decision, evidence_package_id,
         notes_hash, signed_at, tx_hash, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [inspection.id, inspection.workOrderId, inspection.kind, inspection.inspectorId,
        inspection.decision, inspection.evidencePackageId, inspection.notesHash ?? null,
        inspection.signedAt, inspection.txHash ?? null, inspection.isDemo],
    );
    return inspectionFromRow(result.rows[0] as Row);
  }

  async getInspection(id: string): Promise<InspectionRecord | null> {
    const result = await this.executor.query('SELECT * FROM inspections WHERE id = $1', [id]);
    return result.rows[0] ? inspectionFromRow(result.rows[0] as Row) : null;
  }

  async listInspections(workOrderId: string): Promise<InspectionRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM inspections WHERE work_order_id = $1 ORDER BY signed_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => inspectionFromRow(row as Row));
  }

  async upsertEscrow(escrow: EscrowRecord): Promise<EscrowRecord> {
    const result = await this.executor.query(
      `INSERT INTO escrow_accounts (work_order_id, token, funded_micro, refunded_micro,
         completion_paid_micro, holdback_held_micro, holdback_released_micro, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (work_order_id) DO UPDATE SET
         token = EXCLUDED.token,
         funded_micro = EXCLUDED.funded_micro,
         refunded_micro = EXCLUDED.refunded_micro,
         completion_paid_micro = EXCLUDED.completion_paid_micro,
         holdback_held_micro = EXCLUDED.holdback_held_micro,
         holdback_released_micro = EXCLUDED.holdback_released_micro,
         is_demo = EXCLUDED.is_demo
       RETURNING *`,
      [escrow.workOrderId, escrow.token, escrow.fundedMicro, escrow.refundedMicro,
        escrow.completionPaidMicro, escrow.holdbackHeldMicro, escrow.holdbackReleasedMicro,
        escrow.isDemo],
    );
    return escrowFromRow(result.rows[0] as Row);
  }

  async getEscrow(workOrderId: string): Promise<EscrowRecord | null> {
    const result = await this.executor.query('SELECT * FROM escrow_accounts WHERE work_order_id = $1', [workOrderId]);
    return result.rows[0] ? escrowFromRow(result.rows[0] as Row) : null;
  }

  async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    const result = await this.executor.query(
      `INSERT INTO payments (id, work_order_id, kind, amount_micro, recipient, status, tx_hash,
         released_at, label, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [payment.id, payment.workOrderId, payment.kind, payment.amountMicro, payment.recipient,
        payment.status, payment.txHash ?? null, payment.releasedAt ?? null, payment.label ?? null,
        payment.createdAt, payment.isDemo],
    );
    return paymentFromRow(result.rows[0] as Row);
  }

  async getPayment(id: string): Promise<PaymentRecord | null> {
    const result = await this.executor.query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0] ? paymentFromRow(result.rows[0] as Row) : null;
  }

  async listPayments(workOrderId: string): Promise<PaymentRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM payments WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => paymentFromRow(row as Row));
  }

  async updatePayment(id: string, patch: PaymentPatch): Promise<PaymentRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.txHash !== undefined) add('tx_hash', patch.txHash);
    if (patch.releasedAt !== undefined) add('released_at', patch.releasedAt);
    if (sets.length === 0) return this.getPayment(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE payments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? paymentFromRow(result.rows[0] as Row) : null;
  }

  async createWarrantyCase(warranty: WarrantyCaseRecord): Promise<WarrantyCaseRecord> {
    const result = await this.executor.query(
      `INSERT INTO warranty_cases (id, work_order_id, failed_inspection_id, state, opened_at, closed_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [warranty.id, warranty.workOrderId, warranty.failedInspectionId, warranty.state,
        warranty.openedAt, warranty.closedAt ?? null, warranty.isDemo],
    );
    return warrantyFromRow(result.rows[0] as Row);
  }

  async getWarrantyCase(id: string): Promise<WarrantyCaseRecord | null> {
    const result = await this.executor.query('SELECT * FROM warranty_cases WHERE id = $1', [id]);
    return result.rows[0] ? warrantyFromRow(result.rows[0] as Row) : null;
  }

  async listWarrantyCases(workOrderId: string): Promise<WarrantyCaseRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM warranty_cases WHERE work_order_id = $1 ORDER BY opened_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => warrantyFromRow(row as Row));
  }

  async updateWarrantyCase(id: string, patch: WarrantyPatch): Promise<WarrantyCaseRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.state !== undefined) add('state', patch.state);
    if (patch.closedAt !== undefined) add('closed_at', patch.closedAt);
    if (patch.failedInspectionId !== undefined) add('failed_inspection_id', patch.failedInspectionId);
    if (sets.length === 0) return this.getWarrantyCase(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE warranty_cases SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? warrantyFromRow(result.rows[0] as Row) : null;
  }

  async upsertAgent(agent: AgentRecord): Promise<AgentRecord> {
    const result = await this.executor.query(
      `INSERT INTO agent_identities (account, role, key_kind, allowed_receiver, allowed_methods,
         allowance_micro, can_release_escrow, label, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8)
       ON CONFLICT (account, role) DO UPDATE SET
         key_kind = EXCLUDED.key_kind,
         allowed_receiver = EXCLUDED.allowed_receiver,
         allowed_methods = EXCLUDED.allowed_methods,
         allowance_micro = EXCLUDED.allowance_micro,
         label = EXCLUDED.label,
         is_demo = EXCLUDED.is_demo
       RETURNING *`,
      [agent.account, agent.role, agent.keyKind, agent.allowedReceiver, agent.allowedMethods,
        agent.allowanceMicro ?? null, agent.label, agent.isDemo],
    );
    return agentFromRow(result.rows[0] as Row);
  }

  async getAgent(account: string, role: AgentRecord['role']): Promise<AgentRecord | null> {
    const result = await this.executor.query(
      'SELECT * FROM agent_identities WHERE account = $1 AND role = $2',
      [account, role],
    );
    return result.rows[0] ? agentFromRow(result.rows[0] as Row) : null;
  }

  async listAgents(filter?: ListFilter): Promise<AgentRecord[]> {
    const params: unknown[] = [];
    const result = await this.executor.query(
      `SELECT * FROM agent_identities ORDER BY account ASC, role ASC${limitClause(filter, params)}`,
      params,
    );
    return result.rows.map((row) => agentFromRow(row as Row));
  }

  async createTestnetWallet(wallet: TestnetWalletRecord): Promise<TestnetWalletRecord> {
    const result = await this.executor.query(
      `INSERT INTO testnet_wallets (account_id, public_key, network, created_at, last_faucet_at,
         last_faucet_ip_hash, faucet_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (account_id) DO UPDATE SET
         public_key = EXCLUDED.public_key,
         network = EXCLUDED.network,
         last_faucet_at = COALESCE(EXCLUDED.last_faucet_at, testnet_wallets.last_faucet_at),
         last_faucet_ip_hash = COALESCE(EXCLUDED.last_faucet_ip_hash, testnet_wallets.last_faucet_ip_hash),
         faucet_count = GREATEST(EXCLUDED.faucet_count, testnet_wallets.faucet_count)
       RETURNING *`,
      [wallet.accountId, wallet.publicKey, wallet.network, wallet.createdAt,
        wallet.lastFaucetAt ?? null, wallet.lastFaucetIpHash ?? null, wallet.faucetCount],
    );
    return testnetWalletFromRow(result.rows[0] as Row);
  }

  async getTestnetWallet(accountId: string): Promise<TestnetWalletRecord | null> {
    const result = await this.executor.query(
      'SELECT * FROM testnet_wallets WHERE account_id = $1',
      [accountId],
    );
    return result.rows[0] ? testnetWalletFromRow(result.rows[0] as Row) : null;
  }

  async updateTestnetWallet(accountId: string, patch: TestnetWalletPatch): Promise<TestnetWalletRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.lastFaucetAt !== undefined) add('last_faucet_at', patch.lastFaucetAt);
    if (patch.lastFaucetIpHash !== undefined) add('last_faucet_ip_hash', patch.lastFaucetIpHash);
    if (patch.faucetCount !== undefined) add('faucet_count', patch.faucetCount);
    if (sets.length === 0) return this.getTestnetWallet(accountId);
    params.push(accountId);
    const result = await this.executor.query(
      `UPDATE testnet_wallets SET ${sets.join(', ')} WHERE account_id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? testnetWalletFromRow(result.rows[0] as Row) : null;
  }

  async createAttestation(attestation: AttestationRecord): Promise<AttestationRecord> {
    const result = await this.executor.query(
      `INSERT INTO attestations (id, kind, subject_hash, artifact, artifact_hash, signature,
         verified, unavailable_reason, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [attestation.id, attestation.kind, attestation.subjectHash, JSON.stringify(attestation.artifact),
        attestation.artifactHash, attestation.signature ?? null, attestation.verified,
        attestation.unavailableReason ?? null, attestation.createdAt, attestation.isDemo],
    );
    return attestationFromRow(result.rows[0] as Row);
  }

  async getAttestation(id: string): Promise<AttestationRecord | null> {
    const result = await this.executor.query('SELECT * FROM attestations WHERE id = $1', [id]);
    return result.rows[0] ? attestationFromRow(result.rows[0] as Row) : null;
  }

  async listAttestationsBySubject(subjectHash: string): Promise<AttestationRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM attestations WHERE subject_hash = $1 ORDER BY created_at ASC, id ASC',
      [subjectHash],
    );
    return result.rows.map((row) => attestationFromRow(row as Row));
  }

  async createIntentQuote(quote: IntentQuoteRecord): Promise<IntentQuoteRecord> {
    const result = await this.executor.query(
      `INSERT INTO intent_quotes (id, dry, src_chain, src_asset, dst_chain, dst_asset, amount_in,
         amount_out, fees_usd, recipient, deposit_address, deposit_memo, deadline, status,
         work_order_id, raw, created_at, is_demo)
       VALUES ($1,$2,$3,$4,'near',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [quote.id, quote.dry, quote.srcChain, quote.srcAsset, quote.dstAsset, quote.amountIn,
        quote.amountOut, quote.feesUsd ?? null, quote.recipient, quote.depositAddress ?? null,
        quote.depositMemo ?? null, quote.deadline ?? null, quote.status, quote.workOrderId ?? null,
        quote.raw === undefined ? null : JSON.stringify(quote.raw), quote.createdAt, quote.isDemo],
    );
    return intentQuoteFromRow(result.rows[0] as Row);
  }

  async getIntentQuote(id: string): Promise<IntentQuoteRecord | null> {
    const result = await this.executor.query('SELECT * FROM intent_quotes WHERE id = $1', [id]);
    return result.rows[0] ? intentQuoteFromRow(result.rows[0] as Row) : null;
  }

  async listIntentQuotes(filter?: ListFilter): Promise<IntentQuoteRecord[]> {
    const params: unknown[] = [];
    const result = await this.executor.query(
      `SELECT * FROM intent_quotes ORDER BY created_at ASC, id ASC${limitClause(filter, params)}`,
      params,
    );
    return result.rows.map((row) => intentQuoteFromRow(row as Row));
  }

  async updateIntentQuote(id: string, patch: IntentQuotePatch): Promise<IntentQuoteRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.amountOut !== undefined) add('amount_out', patch.amountOut);
    if (patch.feesUsd !== undefined) add('fees_usd', patch.feesUsd);
    if (patch.depositAddress !== undefined) add('deposit_address', patch.depositAddress);
    if (patch.depositMemo !== undefined) add('deposit_memo', patch.depositMemo);
    if (patch.deadline !== undefined) add('deadline', patch.deadline);
    if (patch.raw !== undefined) add('raw', JSON.stringify(patch.raw));
    if (sets.length === 0) return this.getIntentQuote(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE intent_quotes SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? intentQuoteFromRow(result.rows[0] as Row) : null;
  }

  async createIntentExecution(execution: IntentExecutionRecord): Promise<IntentExecutionRecord> {
    const result = await this.executor.query(
      `INSERT INTO intent_executions (id, quote_id, work_order_id, status, destination_tx_hash,
         explorer_url, updated_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [execution.id, execution.quoteId, execution.workOrderId, execution.status,
        execution.destinationTxHash ?? null, execution.explorerUrl ?? null,
        execution.updatedAt, execution.isDemo],
    );
    return intentExecutionFromRow(result.rows[0] as Row);
  }

  async getIntentExecution(id: string): Promise<IntentExecutionRecord | null> {
    const result = await this.executor.query('SELECT * FROM intent_executions WHERE id = $1', [id]);
    return result.rows[0] ? intentExecutionFromRow(result.rows[0] as Row) : null;
  }

  async listIntentExecutions(workOrderId: string): Promise<IntentExecutionRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM intent_executions WHERE work_order_id = $1 ORDER BY updated_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => intentExecutionFromRow(row as Row));
  }

  async updateIntentExecution(id: string, patch: IntentExecutionPatch): Promise<IntentExecutionRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.destinationTxHash !== undefined) add('destination_tx_hash', patch.destinationTxHash);
    if (patch.explorerUrl !== undefined) add('explorer_url', patch.explorerUrl);
    if (patch.updatedAt !== undefined) add('updated_at', patch.updatedAt);
    if (sets.length === 0) return this.getIntentExecution(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE intent_executions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? intentExecutionFromRow(result.rows[0] as Row) : null;
  }

  async createTriageSuggestion(suggestion: TriageSuggestionRecord): Promise<TriageSuggestionRecord> {
    const result = await this.executor.query(
      `INSERT INTO triage_suggestions (id, report_id, provider, model, available, confidence_bps,
         rationale, duplicate_candidates, scope, attestation_id, unavailable_reason, created_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [suggestion.id, suggestion.reportId, suggestion.provider, suggestion.model ?? null,
        suggestion.available, suggestion.confidenceBps ?? null, suggestion.rationale ?? null,
        JSON.stringify(suggestion.duplicateCandidates), suggestion.scope ?? null,
        suggestion.attestationId ?? null, suggestion.unavailableReason ?? null,
        suggestion.createdAt, suggestion.isDemo],
    );
    return triageFromRow(result.rows[0] as Row);
  }

  async getTriageSuggestion(id: string): Promise<TriageSuggestionRecord | null> {
    const result = await this.executor.query('SELECT * FROM triage_suggestions WHERE id = $1', [id]);
    return result.rows[0] ? triageFromRow(result.rows[0] as Row) : null;
  }

  async listTriageSuggestions(reportId: string): Promise<TriageSuggestionRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM triage_suggestions WHERE report_id = $1 ORDER BY created_at ASC, id ASC',
      [reportId],
    );
    return result.rows.map((row) => triageFromRow(row as Row));
  }

  async createChainCommand(command: ChainCommandRecord): Promise<ChainCommandRecord> {
    const result = await this.executor.query(
      `INSERT INTO chain_commands (id, work_order_id, action, method, args, state, mode, adapter,
         tx_hash, error_code, error_message, real_transaction, created_at, updated_at, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [command.id, command.workOrderId ?? null, command.action, command.method,
        JSON.stringify(command.args), command.state, command.mode, command.adapter,
        command.txHash ?? null, command.errorCode ?? null, command.errorMessage ?? null,
        command.realTransaction, command.createdAt, command.updatedAt, command.isDemo],
    );
    return chainCommandFromRow(result.rows[0] as Row);
  }

  async getChainCommand(id: string): Promise<ChainCommandRecord | null> {
    const result = await this.executor.query('SELECT * FROM chain_commands WHERE id = $1', [id]);
    return result.rows[0] ? chainCommandFromRow(result.rows[0] as Row) : null;
  }

  async listChainCommands(workOrderId: string): Promise<ChainCommandRecord[]> {
    const result = await this.executor.query(
      'SELECT * FROM chain_commands WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC',
      [workOrderId],
    );
    return result.rows.map((row) => chainCommandFromRow(row as Row));
  }

  async updateChainCommand(id: string, patch: ChainCommandPatch): Promise<ChainCommandRecord | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (patch.state !== undefined) add('state', patch.state);
    if (patch.txHash !== undefined) add('tx_hash', patch.txHash);
    if (patch.errorCode !== undefined) add('error_code', patch.errorCode);
    if (patch.errorMessage !== undefined) add('error_message', patch.errorMessage);
    if (patch.realTransaction !== undefined) add('real_transaction', patch.realTransaction);
    if (patch.updatedAt !== undefined) add('updated_at', patch.updatedAt);
    if (sets.length === 0) return this.getChainCommand(id);
    params.push(id);
    const result = await this.executor.query(
      `UPDATE chain_commands SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? chainCommandFromRow(result.rows[0] as Row) : null;
  }

  async appendAudit(event: AuditEventRecord): Promise<AuditEventRecord> {
    const result = await this.executor.query(
      `INSERT INTO audit_events (id, name, actor, work_order_id, asset_id, at, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [event.id, event.name, event.actor, event.workOrderId ?? null, event.assetId ?? null,
        event.at, JSON.stringify(event.data)],
    );
    return auditFromRow(result.rows[0] as Row);
  }

  async listAudit(filter?: AuditFilter): Promise<AuditEventRecord[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter?.workOrderId) {
      params.push(filter.workOrderId);
      where.push(`work_order_id = $${params.length}`);
    }
    if (filter?.assetId) {
      params.push(filter.assetId);
      where.push(`asset_id = $${params.length}`);
    }
    if (filter?.name) {
      params.push(filter.name);
      where.push(`name = $${params.length}`);
    }
    const sql = `SELECT * FROM audit_events${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY at ASC, seq ASC${limitClause(filter, params)}`;
    const result = await this.executor.query(sql, params);
    return result.rows.map((row) => auditFromRow(row as Row));
  }

  async markEventProcessed(eventKey: string, source: string): Promise<boolean> {
    const result = await this.executor.query(
      `INSERT INTO processed_events (event_key, source) VALUES ($1,$2)
       ON CONFLICT (event_key) DO NOTHING RETURNING event_key`,
      [eventKey, source],
    );
    return result.rows.length === 1;
  }

  async getIndexerCursor(source: string): Promise<string | null> {
    const result = await this.executor.query('SELECT cursor FROM indexer_cursors WHERE source = $1', [source]);
    return result.rows[0] ? String((result.rows[0] as Row).cursor) : null;
  }

  async setIndexerCursor(source: string, cursor: string): Promise<void> {
    await this.executor.query(
      `INSERT INTO indexer_cursors (source, cursor, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (source) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`,
      [source, cursor],
    );
  }

  async resetIndexerState(source?: string): Promise<void> {
    if (source) {
      await this.executor.query('DELETE FROM processed_events WHERE source = $1', [source]);
      await this.executor.query('DELETE FROM indexer_cursors WHERE source = $1', [source]);
      return;
    }
    await this.executor.query('DELETE FROM processed_events');
    await this.executor.query('DELETE FROM indexer_cursors');
  }

  async clearDemoData(): Promise<void> {
    await this.transaction(async (repo) => {
      const executor = (repo as PgRepository).executor;
      await executor.query('DELETE FROM chain_commands WHERE is_demo = true');
      await executor.query('DELETE FROM intent_quotes WHERE is_demo = true');
      await executor.query('DELETE FROM attestations WHERE is_demo = true');
      await executor.query('DELETE FROM agent_identities WHERE is_demo = true');
      await executor.query('DELETE FROM work_orders WHERE is_demo = true');
      await executor.query('DELETE FROM reports WHERE is_demo = true');
      await executor.query('DELETE FROM report_clusters WHERE is_demo = true');
      await executor.query('DELETE FROM dao_approvals WHERE is_demo = true');
      await executor.query('DELETE FROM assets WHERE is_demo = true');
      // Audit events are append-only and intentionally survive a demo reset.
    });
  }

  async listTablesForDiagnostics(): Promise<string[]> {
    const result = await this.executor.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name`,
    );
    return result.rows.map((row) => String((row as Row).table_name));
  }

  async clearReadModel(): Promise<void> {
    await this.transaction(async (repo) => {
      const executor = (repo as PgRepository).executor;
      for (const table of [
        'chain_commands',
        'intent_executions',
        'intent_quotes',
        'triage_suggestions',
        'attestations',
        'agent_identities',
        'warranty_cases',
        'payments',
        'escrow_accounts',
        'inspections',
        'evidence_objects',
        'evidence_packages',
        'score_executions',
        'bid_reveals',
        'bid_commitments',
        'work_orders',
        'dao_approvals',
        'report_private',
        'reports',
        'report_clusters',
        'assets',
        'processed_events',
        'indexer_cursors',
        'id_sequences',
      ]) {
        await executor.query(`DELETE FROM ${table}`);
      }
      // audit_events is append-only and survives a read-model rebuild.
    });
  }
}
