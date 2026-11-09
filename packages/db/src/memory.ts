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

function byCreatedAt<T extends { createdAt?: string; id?: string; at?: string }>(a: T, b: T): number {
  const at = a.createdAt ?? a.at ?? '';
  const bt = b.createdAt ?? b.at ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

function page<T>(items: T[], filter?: ListFilter): T[] {
  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? items.length;
  return items.slice(offset, offset + limit);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * In-memory repository used by tests and the REPLAY demo mode. Values are
 * deep-cloned on write and read so callers cannot mutate stored state by
 * accident. Transactions snapshot and restore the whole store.
 */
export class MemoryRepository implements Repository {
  readonly kind = 'memory' as const;

  private assets = new Map<string, AssetRecord>();
  private reports = new Map<string, ReportRecord>();
  private reportPrivate = new Map<string, ReportPrivateRecord>();
  private clusters = new Map<string, ReportClusterRecord>();
  private daoApprovals = new Map<string, DaoApprovalRecord>();
  private workOrders = new Map<string, WorkOrderRecord>();
  private bidCommitments = new Map<string, BidCommitmentRecord>();
  private bidReveals = new Map<string, BidRevealRecord>();
  private scores = new Map<string, ScoreExecutionRecord>();
  private evidencePackages = new Map<string, EvidencePackageRecord>();
  private evidenceObjects = new Map<string, EvidenceObjectRecord>();
  private inspections = new Map<string, InspectionRecord>();
  private escrows = new Map<string, EscrowRecord>();
  private payments = new Map<string, PaymentRecord>();
  private warranties = new Map<string, WarrantyCaseRecord>();
  private agents = new Map<string, AgentRecord>();
  private attestations = new Map<string, AttestationRecord>();
  private intentQuotes = new Map<string, IntentQuoteRecord>();
  private intentExecutions = new Map<string, IntentExecutionRecord>();
  private triage = new Map<string, TriageSuggestionRecord>();
  private testnetWallets = new Map<string, TestnetWalletRecord>();
  private chainCommands = new Map<string, ChainCommandRecord>();
  private audits: AuditEventRecord[] = [];
  private sequences = new Map<string, number>();
  private processedEvents = new Map<string, string>();
  private cursors = new Map<string, string>();

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    // nothing to close
  }

  async transaction<T>(fn: (repo: Repository) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await fn(this);
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  async nextSequence(name: string): Promise<number> {
    const next = (this.sequences.get(name) ?? 0) + 1;
    this.sequences.set(name, next);
    return next;
  }

  createAsset(asset: AssetRecord): Promise<AssetRecord> {
    const record = clone(asset);
    this.assets.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getAsset(id: string): Promise<AssetRecord | null> {
    const value = this.assets.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listAssets(filter?: ListFilter): Promise<AssetRecord[]> {
    return Promise.resolve(page([...this.assets.values()].sort(byCreatedAt), filter).map(clone));
  }

  updateAsset(id: string, patch: AssetPatch): Promise<AssetRecord | null> {
    const current = this.assets.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.assets.set(id, next);
    return Promise.resolve(clone(next));
  }

  deleteAsset(id: string): Promise<boolean> {
    return Promise.resolve(this.assets.delete(id));
  }

  createReport(report: ReportRecord): Promise<ReportRecord> {
    const record = clone(report);
    this.reports.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getReport(id: string): Promise<ReportRecord | null> {
    const value = this.reports.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listReports(filter?: ReportFilter): Promise<ReportRecord[]> {
    let items = [...this.reports.values()];
    if (filter?.status) items = items.filter((r) => r.status === filter.status);
    if (filter?.assetId) items = items.filter((r) => r.assetId === filter.assetId);
    if (filter?.clusterId) items = items.filter((r) => r.clusterId === filter.clusterId);
    return Promise.resolve(page(items.sort(byCreatedAt), filter).map(clone));
  }

  updateReport(id: string, patch: ReportPatch): Promise<ReportRecord | null> {
    const current = this.reports.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current };
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.clusterId !== undefined) next.clusterId = patch.clusterId ?? undefined;
    this.reports.set(id, next);
    return Promise.resolve(clone(next));
  }

  createReportPrivate(record: ReportPrivateRecord): Promise<void> {
    this.reportPrivate.set(record.reportId, clone(record));
    return Promise.resolve();
  }

  getReportPrivate(reportId: string): Promise<ReportPrivateRecord | null> {
    const value = this.reportPrivate.get(reportId);
    return Promise.resolve(value ? clone(value) : null);
  }

  findReportByCaseLinkHash(hash: string): Promise<ReportRecord | null> {
    for (const record of this.reportPrivate.values()) {
      if (record.caseLinkHash === hash) {
        const report = this.reports.get(record.reportId);
        return Promise.resolve(report ? clone(report) : null);
      }
    }
    return Promise.resolve(null);
  }

  createCluster(cluster: ReportClusterRecord): Promise<ReportClusterRecord> {
    const record = clone(cluster);
    this.clusters.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getCluster(id: string): Promise<ReportClusterRecord | null> {
    const value = this.clusters.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listClusters(filter?: ListFilter): Promise<ReportClusterRecord[]> {
    return Promise.resolve(page([...this.clusters.values()].sort(byCreatedAt), filter).map(clone));
  }

  updateCluster(id: string, patch: ClusterPatch): Promise<ReportClusterRecord | null> {
    const current = this.clusters.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.clusters.set(id, next);
    return Promise.resolve(clone(next));
  }

  createDaoApproval(approval: DaoApprovalRecord): Promise<DaoApprovalRecord> {
    const record = clone(approval);
    this.daoApprovals.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getDaoApproval(id: string): Promise<DaoApprovalRecord | null> {
    const value = this.daoApprovals.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listDaoApprovals(filter?: ListFilter): Promise<DaoApprovalRecord[]> {
    const items = [...this.daoApprovals.values()].sort((a, b) => a.id.localeCompare(b.id));
    return Promise.resolve(page(items, filter).map(clone));
  }

  updateDaoApproval(id: string, patch: DaoApprovalPatch): Promise<DaoApprovalRecord | null> {
    const current = this.daoApprovals.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.daoApprovals.set(id, next);
    return Promise.resolve(clone(next));
  }

  createWorkOrder(workOrder: WorkOrderRecord): Promise<WorkOrderRecord> {
    const record = clone(workOrder);
    this.workOrders.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getWorkOrder(id: string): Promise<WorkOrderRecord | null> {
    const value = this.workOrders.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listWorkOrders(filter?: WorkOrderFilter): Promise<WorkOrderRecord[]> {
    let items = [...this.workOrders.values()];
    if (filter?.status) items = items.filter((w) => w.status === filter.status);
    if (filter?.assetId) items = items.filter((w) => w.assetId === filter.assetId);
    if (filter?.contractorId) items = items.filter((w) => w.contractorId === filter.contractorId);
    return Promise.resolve(page(items.sort(byCreatedAt), filter).map(clone));
  }

  updateWorkOrder(id: string, patch: WorkOrderPatch): Promise<WorkOrderRecord | null> {
    const current = this.workOrders.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.workOrders.set(id, next);
    return Promise.resolve(clone(next));
  }

  createBidCommitment(commitment: BidCommitmentRecord): Promise<BidCommitmentRecord> {
    const key = `${commitment.workOrderId}:${commitment.bidId}`;
    if (this.bidCommitments.has(key)) {
      return Promise.reject(new Error('bid commitment already exists'));
    }
    const record = clone(commitment);
    this.bidCommitments.set(key, record);
    return Promise.resolve(clone(record));
  }

  getBidCommitment(workOrderId: string, bidId: string): Promise<BidCommitmentRecord | null> {
    const value = this.bidCommitments.get(`${workOrderId}:${bidId}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  listBidCommitments(workOrderId: string): Promise<BidCommitmentRecord[]> {
    const items = [...this.bidCommitments.values()]
      .filter((b) => b.workOrderId === workOrderId)
      .sort((a, b) => a.bidId.localeCompare(b.bidId));
    return Promise.resolve(items.map(clone));
  }

  createBidReveal(reveal: BidRevealRecord): Promise<BidRevealRecord> {
    const key = `${reveal.workOrderId}:${reveal.bidId}`;
    if (this.bidReveals.has(key)) {
      return Promise.reject(new Error('bid reveal already exists'));
    }
    const record = clone(reveal);
    this.bidReveals.set(key, record);
    return Promise.resolve(clone(record));
  }

  getBidReveal(workOrderId: string, bidId: string): Promise<BidRevealRecord | null> {
    const value = this.bidReveals.get(`${workOrderId}:${bidId}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  listBidReveals(workOrderId: string): Promise<BidRevealRecord[]> {
    const items = [...this.bidReveals.values()]
      .filter((b) => b.workOrderId === workOrderId)
      .sort((a, b) => a.bidId.localeCompare(b.bidId));
    return Promise.resolve(items.map(clone));
  }

  createScoreExecution(score: ScoreExecutionRecord): Promise<ScoreExecutionRecord> {
    const record = clone(score);
    this.scores.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getScoreExecution(id: string): Promise<ScoreExecutionRecord | null> {
    const value = this.scores.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listScoreExecutions(workOrderId: string): Promise<ScoreExecutionRecord[]> {
    const items = [...this.scores.values()]
      .filter((s) => s.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  async getLatestScoreExecution(workOrderId: string): Promise<ScoreExecutionRecord | null> {
    const items = await this.listScoreExecutions(workOrderId);
    return items.at(-1) ?? null;
  }

  createEvidencePackage(pkg: EvidencePackageRecord): Promise<EvidencePackageRecord> {
    const record = clone(pkg);
    this.evidencePackages.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getEvidencePackage(id: string): Promise<EvidencePackageRecord | null> {
    const value = this.evidencePackages.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listEvidencePackages(workOrderId: string): Promise<EvidencePackageRecord[]> {
    const items = [...this.evidencePackages.values()]
      .filter((e) => e.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  createEvidenceObject(object: EvidenceObjectRecord): Promise<EvidenceObjectRecord> {
    const record = clone(object);
    this.evidenceObjects.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getEvidenceObject(id: string): Promise<EvidenceObjectRecord | null> {
    const value = this.evidenceObjects.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listEvidenceObjects(evidencePackageId: string): Promise<EvidenceObjectRecord[]> {
    const items = [...this.evidenceObjects.values()]
      .filter((e) => e.evidencePackageId === evidencePackageId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  createInspection(inspection: InspectionRecord): Promise<InspectionRecord> {
    const record = clone(inspection);
    this.inspections.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getInspection(id: string): Promise<InspectionRecord | null> {
    const value = this.inspections.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listInspections(workOrderId: string): Promise<InspectionRecord[]> {
    const items = [...this.inspections.values()]
      .filter((i) => i.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  upsertEscrow(escrow: EscrowRecord): Promise<EscrowRecord> {
    const record = clone(escrow);
    this.escrows.set(record.workOrderId, record);
    return Promise.resolve(clone(record));
  }

  getEscrow(workOrderId: string): Promise<EscrowRecord | null> {
    const value = this.escrows.get(workOrderId);
    return Promise.resolve(value ? clone(value) : null);
  }

  createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    const record = clone(payment);
    this.payments.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getPayment(id: string): Promise<PaymentRecord | null> {
    const value = this.payments.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listPayments(workOrderId: string): Promise<PaymentRecord[]> {
    const items = [...this.payments.values()]
      .filter((p) => p.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  updatePayment(id: string, patch: PaymentPatch): Promise<PaymentRecord | null> {
    const current = this.payments.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.payments.set(id, next);
    return Promise.resolve(clone(next));
  }

  createWarrantyCase(warranty: WarrantyCaseRecord): Promise<WarrantyCaseRecord> {
    const record = clone(warranty);
    this.warranties.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getWarrantyCase(id: string): Promise<WarrantyCaseRecord | null> {
    const value = this.warranties.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listWarrantyCases(workOrderId: string): Promise<WarrantyCaseRecord[]> {
    const items = [...this.warranties.values()]
      .filter((w) => w.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  updateWarrantyCase(id: string, patch: WarrantyPatch): Promise<WarrantyCaseRecord | null> {
    const current = this.warranties.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.warranties.set(id, next);
    return Promise.resolve(clone(next));
  }

  upsertAgent(agent: AgentRecord): Promise<AgentRecord> {
    const record = clone(agent);
    this.agents.set(`${record.account}:${record.role}`, record);
    return Promise.resolve(clone(record));
  }

  getAgent(account: string, role: AgentRecord['role']): Promise<AgentRecord | null> {
    const value = this.agents.get(`${account}:${role}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  listAgents(filter?: ListFilter): Promise<AgentRecord[]> {
    const items = [...this.agents.values()].sort((a, b) => a.account.localeCompare(b.account));
    return Promise.resolve(page(items, filter).map(clone));
  }

  createTestnetWallet(wallet: TestnetWalletRecord): Promise<TestnetWalletRecord> {
    const record = clone(wallet);
    this.testnetWallets.set(record.accountId, record);
    return Promise.resolve(clone(record));
  }

  getTestnetWallet(accountId: string): Promise<TestnetWalletRecord | null> {
    const value = this.testnetWallets.get(accountId);
    return Promise.resolve(value ? clone(value) : null);
  }

  updateTestnetWallet(accountId: string, patch: TestnetWalletPatch): Promise<TestnetWalletRecord | null> {
    const current = this.testnetWallets.get(accountId);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.testnetWallets.set(accountId, next);
    return Promise.resolve(clone(next));
  }

  createAttestation(attestation: AttestationRecord): Promise<AttestationRecord> {
    const record = clone(attestation);
    this.attestations.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getAttestation(id: string): Promise<AttestationRecord | null> {
    const value = this.attestations.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listAttestationsBySubject(subjectHash: string): Promise<AttestationRecord[]> {
    const items = [...this.attestations.values()]
      .filter((a) => a.subjectHash === subjectHash)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  createIntentQuote(quote: IntentQuoteRecord): Promise<IntentQuoteRecord> {
    const record = clone(quote);
    this.intentQuotes.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getIntentQuote(id: string): Promise<IntentQuoteRecord | null> {
    const value = this.intentQuotes.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listIntentQuotes(filter?: ListFilter): Promise<IntentQuoteRecord[]> {
    return Promise.resolve(page([...this.intentQuotes.values()].sort(byCreatedAt), filter).map(clone));
  }

  updateIntentQuote(id: string, patch: IntentQuotePatch): Promise<IntentQuoteRecord | null> {
    const current = this.intentQuotes.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.intentQuotes.set(id, next);
    return Promise.resolve(clone(next));
  }

  createIntentExecution(execution: IntentExecutionRecord): Promise<IntentExecutionRecord> {
    const record = clone(execution);
    this.intentExecutions.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getIntentExecution(id: string): Promise<IntentExecutionRecord | null> {
    const value = this.intentExecutions.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listIntentExecutions(workOrderId: string): Promise<IntentExecutionRecord[]> {
    const items = [...this.intentExecutions.values()]
      .filter((e) => e.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  updateIntentExecution(id: string, patch: IntentExecutionPatch): Promise<IntentExecutionRecord | null> {
    const current = this.intentExecutions.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.intentExecutions.set(id, next);
    return Promise.resolve(clone(next));
  }

  createTriageSuggestion(suggestion: TriageSuggestionRecord): Promise<TriageSuggestionRecord> {
    const record = clone(suggestion);
    this.triage.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getTriageSuggestion(id: string): Promise<TriageSuggestionRecord | null> {
    const value = this.triage.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listTriageSuggestions(reportId: string): Promise<TriageSuggestionRecord[]> {
    const items = [...this.triage.values()]
      .filter((t) => t.reportId === reportId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  createChainCommand(command: ChainCommandRecord): Promise<ChainCommandRecord> {
    const record = clone(command);
    this.chainCommands.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  getChainCommand(id: string): Promise<ChainCommandRecord | null> {
    const value = this.chainCommands.get(id);
    return Promise.resolve(value ? clone(value) : null);
  }

  listChainCommands(workOrderId: string): Promise<ChainCommandRecord[]> {
    const items = [...this.chainCommands.values()]
      .filter((c) => c.workOrderId === workOrderId)
      .sort(byCreatedAt);
    return Promise.resolve(items.map(clone));
  }

  updateChainCommand(id: string, patch: ChainCommandPatch): Promise<ChainCommandRecord | null> {
    const current = this.chainCommands.get(id);
    if (!current) return Promise.resolve(null);
    const next = { ...current, ...patch };
    this.chainCommands.set(id, next);
    return Promise.resolve(clone(next));
  }

  appendAudit(event: AuditEventRecord): Promise<AuditEventRecord> {
    const record = clone(event);
    this.audits.push(record);
    return Promise.resolve(clone(record));
  }

  listAudit(filter?: AuditFilter): Promise<AuditEventRecord[]> {
    let items = [...this.audits];
    if (filter?.workOrderId) items = items.filter((a) => a.workOrderId === filter.workOrderId);
    if (filter?.assetId) items = items.filter((a) => a.assetId === filter.assetId);
    if (filter?.name) items = items.filter((a) => a.name === filter.name);
    items.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at)));
    return Promise.resolve(page(items, filter).map(clone));
  }

  async markEventProcessed(eventKey: string, source: string): Promise<boolean> {
    if (this.processedEvents.has(eventKey)) return false;
    this.processedEvents.set(eventKey, source);
    return true;
  }

  getIndexerCursor(source: string): Promise<string | null> {
    return Promise.resolve(this.cursors.get(source) ?? null);
  }

  setIndexerCursor(source: string, cursor: string): Promise<void> {
    this.cursors.set(source, cursor);
    return Promise.resolve();
  }

  async resetIndexerState(source?: string): Promise<void> {
    if (!source) {
      this.processedEvents.clear();
      this.cursors.clear();
      return;
    }
    for (const [key] of this.processedEvents) {
      if (this.processedEvents.get(key) === source) this.processedEvents.delete(key);
    }
    this.cursors.delete(source);
  }

  async clearDemoData(): Promise<void> {
    const demoWorkOrderIds = new Set(
      [...this.workOrders.values()].filter((w) => w.isDemo).map((w) => w.id),
    );
    const demoPackageIds = new Set(
      [...this.evidencePackages.values()]
        .filter((p) => p.isDemo || demoWorkOrderIds.has(p.workOrderId))
        .map((p) => p.id),
    );
    for (const id of demoWorkOrderIds) {
      for (const [key, value] of this.bidCommitments) if (value.workOrderId === id) this.bidCommitments.delete(key);
      for (const [key, value] of this.bidReveals) if (value.workOrderId === id) this.bidReveals.delete(key);
      for (const [key, value] of this.scores) if (value.workOrderId === id) this.scores.delete(key);
      for (const [key, value] of this.evidencePackages) if (value.workOrderId === id) this.evidencePackages.delete(key);
      for (const [key, value] of this.inspections) if (value.workOrderId === id) this.inspections.delete(key);
      for (const [key, value] of this.escrows) if (value.workOrderId === id) this.escrows.delete(key);
      for (const [key, value] of this.payments) if (value.workOrderId === id) this.payments.delete(key);
      for (const [key, value] of this.warranties) if (value.workOrderId === id) this.warranties.delete(key);
      for (const [key, value] of this.chainCommands) if (value.workOrderId === id) this.chainCommands.delete(key);
      for (const [key, value] of this.intentExecutions) if (value.workOrderId === id) this.intentExecutions.delete(key);
    }
    for (const id of demoPackageIds) {
      for (const [key, value] of this.evidenceObjects) {
        if (value.evidencePackageId === id) this.evidenceObjects.delete(key);
      }
    }
    for (const [key, value] of this.assets) if (value.isDemo) this.assets.delete(key);
    for (const [key, value] of this.reports) if (value.isDemo) this.reports.delete(key);
    for (const [key, value] of this.reportPrivate) {
      if (!this.reports.has(key)) this.reportPrivate.delete(key);
    }
    for (const [key, value] of this.clusters) if (value.isDemo) this.clusters.delete(key);
    for (const [key, value] of this.daoApprovals) if (value.isDemo) this.daoApprovals.delete(key);
    for (const [key, value] of this.workOrders) if (value.isDemo) this.workOrders.delete(key);
    for (const [key, value] of this.agents) if (value.isDemo) this.agents.delete(key);
    for (const [key, value] of this.attestations) if (value.isDemo) this.attestations.delete(key);
    for (const [key, value] of this.intentQuotes) if (value.isDemo) this.intentQuotes.delete(key);
    for (const [key, value] of this.triage) if (value.isDemo) this.triage.delete(key);
    // Audit events are append-only by design and are not deleted by demo reset.
  }

  /** Test/diagnostic helper: total audit rows (append-only proof). */
  auditCount(): number {
    return this.audits.length;
  }

  async clearReadModel(): Promise<void> {
    this.assets.clear();
    this.reports.clear();
    this.reportPrivate.clear();
    this.clusters.clear();
    this.daoApprovals.clear();
    this.workOrders.clear();
    this.bidCommitments.clear();
    this.bidReveals.clear();
    this.scores.clear();
    this.evidencePackages.clear();
    this.evidenceObjects.clear();
    this.inspections.clear();
    this.escrows.clear();
    this.payments.clear();
    this.warranties.clear();
    this.agents.clear();
    this.attestations.clear();
    this.intentQuotes.clear();
    this.intentExecutions.clear();
    this.triage.clear();
    this.chainCommands.clear();
    this.sequences.clear();
    this.processedEvents.clear();
    this.cursors.clear();
    // Audit events remain: append-only history is not part of the public read model.
  }

  private snapshot(): Record<string, unknown> {
    const cloneMap = <T>(map: Map<string, T>) => new Map([...map].map(([k, v]) => [k, clone(v)]));
    return {
      assets: cloneMap(this.assets),
      reports: cloneMap(this.reports),
      reportPrivate: cloneMap(this.reportPrivate),
      clusters: cloneMap(this.clusters),
      daoApprovals: cloneMap(this.daoApprovals),
      workOrders: cloneMap(this.workOrders),
      bidCommitments: cloneMap(this.bidCommitments),
      bidReveals: cloneMap(this.bidReveals),
      scores: cloneMap(this.scores),
      evidencePackages: cloneMap(this.evidencePackages),
      evidenceObjects: cloneMap(this.evidenceObjects),
      inspections: cloneMap(this.inspections),
      escrows: cloneMap(this.escrows),
      payments: cloneMap(this.payments),
      warranties: cloneMap(this.warranties),
      agents: cloneMap(this.agents),
      attestations: cloneMap(this.attestations),
      intentQuotes: cloneMap(this.intentQuotes),
      intentExecutions: cloneMap(this.intentExecutions),
      triage: cloneMap(this.triage),
      testnetWallets: cloneMap(this.testnetWallets),
      chainCommands: cloneMap(this.chainCommands),
      audits: clone(this.audits),
      sequences: new Map(this.sequences),
      processedEvents: new Map(this.processedEvents),
      cursors: new Map(this.cursors),
    };
  }

  private restore(snapshot: Record<string, unknown>): void {
    this.assets = snapshot.assets as Map<string, AssetRecord>;
    this.reports = snapshot.reports as Map<string, ReportRecord>;
    this.reportPrivate = snapshot.reportPrivate as Map<string, ReportPrivateRecord>;
    this.clusters = snapshot.clusters as Map<string, ReportClusterRecord>;
    this.daoApprovals = snapshot.daoApprovals as Map<string, DaoApprovalRecord>;
    this.workOrders = snapshot.workOrders as Map<string, WorkOrderRecord>;
    this.bidCommitments = snapshot.bidCommitments as Map<string, BidCommitmentRecord>;
    this.bidReveals = snapshot.bidReveals as Map<string, BidRevealRecord>;
    this.scores = snapshot.scores as Map<string, ScoreExecutionRecord>;
    this.evidencePackages = snapshot.evidencePackages as Map<string, EvidencePackageRecord>;
    this.evidenceObjects = snapshot.evidenceObjects as Map<string, EvidenceObjectRecord>;
    this.inspections = snapshot.inspections as Map<string, InspectionRecord>;
    this.escrows = snapshot.escrows as Map<string, EscrowRecord>;
    this.payments = snapshot.payments as Map<string, PaymentRecord>;
    this.warranties = snapshot.warranties as Map<string, WarrantyCaseRecord>;
    this.agents = snapshot.agents as Map<string, AgentRecord>;
    this.attestations = snapshot.attestations as Map<string, AttestationRecord>;
    this.intentQuotes = snapshot.intentQuotes as Map<string, IntentQuoteRecord>;
    this.intentExecutions = snapshot.intentExecutions as Map<string, IntentExecutionRecord>;
    this.triage = snapshot.triage as Map<string, TriageSuggestionRecord>;
    this.testnetWallets = snapshot.testnetWallets as Map<string, TestnetWalletRecord>;
    this.chainCommands = snapshot.chainCommands as Map<string, ChainCommandRecord>;
    this.audits = snapshot.audits as AuditEventRecord[];
    this.sequences = snapshot.sequences as Map<string, number>;
    this.processedEvents = snapshot.processedEvents as Map<string, string>;
    this.cursors = snapshot.cursors as Map<string, string>;
  }
}
