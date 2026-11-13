import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ASSETS, casesForAsset, getAsset } from '@/lib/fixtures';
import { formatDate, formatDateTime, usdc } from '@/lib/format';
import { Badge, HashDisplay, StatusPill } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  FileText,
  Lock,
  MapPin,
  Refresh,
  ShieldCheck,
} from '@/components/Icons';

export function generateStaticParams() {
  return ASSETS.map((asset) => ({ assetId: asset.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }): Promise<Metadata> {
  const { assetId } = await params;
  const asset = getAsset(assetId);
  return {
    title: asset ? `${asset.id} passport` : 'Asset passport',
    description: asset?.publicDescription ?? 'MEND non-transferable maintenance passport.',
  };
}

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = getAsset(assetId);
  if (!asset) notFound();
  const cases = casesForAsset(asset.id);
  const history = cases
    .flatMap((caseData) =>
      caseData.events
        .filter((event) =>
          ['report', 'policy', 'funding', 'award', 'inspection', 'payment', 'warranty', 'dispute', 'close'].includes(
            event.kind,
          ),
        )
        .map((event) => ({ ...event, workOrderId: caseData.id, status: caseData.status })),
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const payments = cases.flatMap((caseData) =>
    caseData.payments.map((payment) => ({ ...payment, workOrderId: caseData.id })),
  );
  const reopened = cases.some((caseData) => caseData.reopenCount > 0);

  const inspections = cases.flatMap((caseData) =>
    caseData.inspections.map((inspection) => ({
      ...inspection,
      workOrderId: caseData.id,
      contractorId: caseData.contractorId,
    })),
  );
  const completedRepairs = inspections.filter(
    (inspection) =>
      (inspection.kind === 'COMPLETION' || inspection.kind === 'REMEDIATION') &&
      inspection.decision === 'APPROVED',
  );

  const contractorAccounts = Array.from(
    new Set(cases.map((caseData) => caseData.contractorId).filter((id) => id !== undefined)),
  ).map((account) => {
    const accountCases = cases.filter((caseData) => caseData.contractorId === account);
    const accountRepairs = completedRepairs.filter((repair) =>
      accountCases.some((caseData) => caseData.id === repair.workOrderId),
    );
    const lastActivity = [...accountCases.map((caseData) => caseData.updatedAt), ...accountRepairs.map((repair) => repair.signedAt)]
      .sort()
      .at(-1);
    return { account, workOrders: accountCases, completedRepairs: accountRepairs, lastActivity };
  });

  const inspectorAccounts = Array.from(new Set(inspections.map((inspection) => inspection.inspectorId))).map(
    (account) => {
      const accountInspections = inspections.filter((inspection) => inspection.inspectorId === account);
      return {
        account,
        decisions: accountInspections.length,
        approved: accountInspections.filter((inspection) => inspection.decision === 'APPROVED').length,
        rejected: accountInspections.filter((inspection) => inspection.decision === 'REJECTED').length,
        workOrderIds: Array.from(new Set(accountInspections.map((inspection) => inspection.workOrderId))),
      };
    },
  );

  const reopenings = cases
    .filter((caseData) => caseData.reopenCount > 0 || Boolean(caseData.warranty))
    .map((caseData) => {
      const warrantyEvent = caseData.events.find((event) => event.kind === 'warranty');
      return {
        caseData,
        openedAt: caseData.warranty?.openedAt ?? warrantyEvent?.at ?? caseData.updatedAt,
        reason:
          caseData.warranty?.note ??
          warrantyEvent?.detail ??
          'The work order history records a warranty reopening.',
      };
    });

  return (
    <div className="container" data-testid="passport-page">
      <div style={{ paddingTop: 'clamp(30px, 5vw, 54px)' }}>
        <nav className="case-hero__breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Map</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{asset.id} passport</span>
        </nav>

        <header className="passport-head">
          <div>
            <div className="case-hero__badges">
              <Badge tone="positive">
                <ShieldCheck size={14} aria-hidden="true" /> NEP-171 passport
              </Badge>
              <Badge tone="warning">Non-transferable</Badge>
              <Badge tone="neutral">{asset.assetType.replace(/_/g, ' ')}</Badge>
            </div>
            <h1 style={{ marginTop: 14 }} data-testid="passport-id">
              {asset.id}
            </h1>
            <p className="page-lead" style={{ marginTop: 10 }}>
              {asset.publicDescription}
            </p>
            <p className="hero__note">
              <span>
                <MapPin size={15} aria-hidden="true" /> {asset.publicLocation.label}
              </span>
              <span>
                <Lock size={15} aria-hidden="true" /> Passport owner: {asset.owner}
              </span>
              <span>
                <Refresh size={15} aria-hidden="true" /> {asset.repairCount} repair{asset.repairCount === 1 ? '' : 's'} ·{' '}
                {asset.repeatFailures} repeat failure{asset.repeatFailures === 1 ? '' : 's'}
              </span>
            </p>
          </div>
          <div className="passport-seal" aria-label="Maintenance passport, non-transferable">
            <div>
              <strong>Living passport</strong>
              <span>Non-transferable</span>
            </div>
          </div>
        </header>
      </div>

      <div className="passport-grid">
        <div className="passport-main">
          <section className="panel" aria-labelledby="passport-facts-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Passport facts</p>
                <h2 id="passport-facts-title">What the passport is — and is not</h2>
                <p>
                  The passport records maintenance history for a public asset. It is not legal ownership, not a tradable
                  claim and not a speculative token.
                </p>
              </div>
              <Badge tone="warning">
                <AlertTriangle size={14} aria-hidden="true" /> Transfer disabled
              </Badge>
            </div>
            <dl className="facts-grid">
              <div className="fact">
                <dt>Token ID</dt>
                <dd className="mono">{asset.passportTokenId}</dd>
              </div>
              <div className="fact">
                <dt>Standard</dt>
                <dd>NEP-171 · non-transferable</dd>
              </div>
              <div className="fact">
                <dt>Owner account</dt>
                <dd className="mono">{asset.owner}</dd>
              </div>
              <div className="fact">
                <dt>Created</dt>
                <dd>{formatDate(asset.createdAt)}</dd>
              </div>
              <div className="fact">
                <dt>Repairs recorded</dt>
                <dd>{asset.repairCount}</dd>
              </div>
              <div className="fact">
                <dt>Replacements</dt>
                <dd>{asset.replacementCount}</dd>
              </div>
              <div className="fact">
                <dt>Repeat failures</dt>
                <dd>{asset.repeatFailures}</dd>
              </div>
              <div className="fact">
                <dt>Current case state</dt>
                <dd>{cases[0] ? <StatusPill status={cases[0].status} /> : 'No case'}</dd>
              </div>
            </dl>
            <div className="non-transfer" style={{ marginTop: 14 }}>
              <Lock size={18} aria-hidden="true" />
              <span>
                <strong>Every transfer attempt fails.</strong> <code>nft_transfer</code>, <code>nft_transfer_call</code> and{' '}
                <code>nft_approve</code> return <code>TRANSFER_DISABLED</code>. The passport does not imply legal ownership
                of the physical asset.
              </span>
            </div>
          </section>

          <section className="panel" aria-labelledby="actor-history-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Actor history</p>
                <h2 id="actor-history-title">Contractors, inspectors and completed work</h2>
                <p>
                  Derived only from this passport&apos;s work orders and recorded human inspections. No account, decision
                  or outcome is inferred.
                </p>
              </div>
              <Badge tone="neutral">
                {completedRepairs.length} completed repair{completedRepairs.length === 1 ? '' : 's'}
              </Badge>
            </div>

            <dl className="facts-grid">
              <div className="fact">
                <dt>Contractor accounts</dt>
                <dd>{contractorAccounts.length}</dd>
              </div>
              <div className="fact">
                <dt>Inspector accounts</dt>
                <dd>{inspectorAccounts.length}</dd>
              </div>
              <div className="fact">
                <dt>Completed repairs</dt>
                <dd>{completedRepairs.length}</dd>
              </div>
              <div className="fact">
                <dt>Warranty reopenings</dt>
                <dd>{reopenings.length}</dd>
              </div>
            </dl>

            <h3 style={{ marginTop: 20, marginBottom: 8 }}>Contractor accounts</h3>
            {contractorAccounts.length === 0 ? (
              <p className="empty-state">No contractor has been awarded work on this asset.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Contractor history for {asset.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Work orders</th>
                      <th scope="col">Completed repairs</th>
                      <th scope="col">Last recorded activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractorAccounts.map((contractor) => (
                      <tr key={contractor.account}>
                        <td data-label="Account">
                          <span className="mono" title={contractor.account}>
                            {contractor.account}
                          </span>
                        </td>
                        <td data-label="Work orders">
                          {contractor.workOrders.map((caseData) => (
                            <Link
                              key={caseData.id}
                              className="text-link"
                              href={`/cases/${caseData.id}`}
                              style={{ display: 'block' }}
                            >
                              {caseData.id}
                            </Link>
                          ))}
                        </td>
                        <td data-label="Completed repairs">{contractor.completedRepairs.length}</td>
                        <td data-label="Last recorded activity">
                          {contractor.lastActivity ? formatDateTime(contractor.lastActivity) : 'No completed work'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ marginTop: 20, marginBottom: 8 }}>Inspector accounts</h3>
            {inspectorAccounts.length === 0 ? (
              <p className="empty-state">
                No human inspection decision has been recorded against this asset yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Inspector history for {asset.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Decisions</th>
                      <th scope="col">Approved</th>
                      <th scope="col">Rejected</th>
                      <th scope="col">Work orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectorAccounts.map((inspector) => (
                      <tr key={inspector.account}>
                        <td data-label="Account">
                          <span className="mono" title={inspector.account}>
                            {inspector.account}
                          </span>
                        </td>
                        <td data-label="Decisions">{inspector.decisions}</td>
                        <td data-label="Approved">{inspector.approved}</td>
                        <td data-label="Rejected">{inspector.rejected}</td>
                        <td data-label="Work orders">
                          {inspector.workOrderIds.map((workOrderId) => (
                            <Link
                              key={workOrderId}
                              className="text-link"
                              href={`/cases/${workOrderId}`}
                              style={{ display: 'block' }}
                            >
                              {workOrderId}
                            </Link>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ marginTop: 20, marginBottom: 8 }}>Completed repairs</h3>
            {completedRepairs.length === 0 ? (
              <p className="empty-state">
                No completion or remediation inspection has been approved for this asset.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Completed repairs for {asset.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Work order</th>
                      <th scope="col">Repair stage</th>
                      <th scope="col">Completed</th>
                      <th scope="col">Contractor</th>
                      <th scope="col">Inspector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedRepairs.map((repair) => (
                      <tr key={`${repair.workOrderId}-${repair.id}`}>
                        <td data-label="Work order">
                          <Link className="text-link" href={`/cases/${repair.workOrderId}`}>
                            {repair.workOrderId}
                          </Link>
                        </td>
                        <td data-label="Repair stage">
                          {repair.kind === 'REMEDIATION' ? 'Warranty remediation' : 'Completion'}
                        </td>
                        <td data-label="Completed">{formatDateTime(repair.signedAt)}</td>
                        <td data-label="Contractor">
                          <span className="mono">{repair.contractorId ?? 'Not recorded'}</span>
                        </td>
                        <td data-label="Inspector">
                          <span className="mono">{repair.inspectorId}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ marginTop: 20, marginBottom: 8 }}>Warranty reopenings</h3>
            {reopenings.length === 0 ? (
              <p className="empty-state">No warranty reopening is recorded for this asset.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Warranty reopenings for {asset.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Work order</th>
                      <th scope="col">Reopened</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Current state</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reopenings.map((reopening) => (
                      <tr key={reopening.caseData.id}>
                        <td data-label="Work order">
                          <Link className="text-link" href={`/cases/${reopening.caseData.id}`}>
                            {reopening.caseData.id}
                          </Link>
                        </td>
                        <td data-label="Reopened">{formatDateTime(reopening.openedAt)}</td>
                        <td data-label="Reason">{reopening.reason}</td>
                        <td data-label="Current state">
                          <StatusPill status={reopening.caseData.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rule-note" style={{ marginTop: 18 }}>
              <strong>Repair vs replacement.</strong>{' '}
              {asset.replacementCount > 0
                ? `History records ${asset.repairCount} repair${asset.repairCount === 1 ? '' : 's'} and ${asset.replacementCount} replacement${asset.replacementCount === 1 ? '' : 's'}.`
                : completedRepairs.length > 0
                  ? `History records ${completedRepairs.length} approved repair${completedRepairs.length === 1 ? '' : 's'} and no replacement.`
                  : 'History records no completed repair and no replacement yet.'}{' '}
              A scope that says “replace” a part is not counted as a full replacement. Only approved completion or
              remediation inspections are counted as completed repair work; no replacement is inferred from scope wording.
            </div>
          </section>

          <section className="panel" aria-labelledby="history-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Maintenance history</p>
                <h2 id="history-title">Unbroken asset lineage</h2>
                <p>Reports, decisions, failures, remedies and payments stay attached to this asset.</p>
              </div>
              <Badge tone="neutral">{cases.length} work order{cases.length === 1 ? '' : 's'}</Badge>
            </div>
            <ol className="history-list">
              {history.map((event) => (
                <li key={`${event.workOrderId}-${event.id}`} className="history-item">
                  <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.detail}</p>
                    <p className="mono" style={{ marginTop: 4 }}>
                      <Link className="text-link" href={`/cases/${event.workOrderId}`} style={{ fontSize: '0.72rem' }}>
                        {event.workOrderId} <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {reopened ? (
              <div className="callout callout--warning" style={{ marginTop: 16 }}>
                <div className="callout__icon">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="callout__title">This asset has a repeat failure</p>
                  <div className="callout__body">
                    The failed durability inspection and the remediation remain in the same work-order history. A warranty
                    reopening did not create a fresh bounty or new escrow.
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="asset-cases-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Work orders</p>
                <h2 id="asset-cases-title">Every repair remains a case</h2>
              </div>
            </div>
            <div className="case-grid" style={{ gridTemplateColumns: '1fr' }}>
              {cases.map((caseData) => (
                <Link key={caseData.id} href={`/cases/${caseData.id}`} className="case-card">
                  <div className="case-card__top">
                    <span className="case-card__id">{caseData.id}</span>
                    <StatusPill status={caseData.status} />
                  </div>
                  <h3>{caseData.title}</h3>
                  <p className="case-card__summary">{caseData.summary}</p>
                  <div className="case-card__facts">
                    <span>
                      Funded <strong>{usdc(caseData.escrow.fundedMicro, 0)}</strong>
                    </span>
                    <span>
                      Holdback released <strong>{usdc(caseData.escrow.holdbackReleasedMicro, 0)}</strong>
                    </span>
                    <span>
                      Reopened <strong>{caseData.reopenCount > 0 ? 'Yes' : 'No'}</strong>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="asset-payments-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Payment history</p>
                <h2 id="asset-payments-title">Money attached to the history</h2>
              </div>
            </div>
            {payments.length === 0 ? (
              <p className="empty-state">No payment has been recorded against this asset yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <caption className="sr-only">Payment history for {asset.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Work order</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td data-label="Work order">
                          <Link className="text-link" href={`/cases/${payment.workOrderId}`}>
                            {payment.workOrderId}
                          </Link>
                        </td>
                        <td data-label="Kind">
                          <Coins size={14} aria-hidden="true" /> {payment.kind.toLowerCase()}
                        </td>
                        <td data-label="Amount">{usdc(payment.amountMicro)}</td>
                        <td data-label="Status">
                          <span className={`payment-status payment-status--${payment.status.toLowerCase()}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td data-label="Recorded">{payment.releasedAt ? formatDateTime(payment.releasedAt) : 'Not released'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="source-note source-note--replay" style={{ marginTop: 12 }}>
              <FileText size={16} aria-hidden="true" />
              <span>
                No payment in this replay carries a real transaction hash. Explorer links are never fabricated; a live case
                would show one only for a real transaction.
              </span>
            </p>
          </section>

          <DataSourceNote detail={`Passport ${asset.id} is a replay record. The non-transferability rule and history structure are real UI behaviour; no NEP-171 transaction is claimed.`} />
        </div>

        <aside className="passport-aside" aria-label="Passport side panel">
          <section className="side-card">
            <h2>Passport rules</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <Check size={15} aria-hidden="true" /> Non-speculative and non-transferable.
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Approved work-order and evidence hashes only.
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Contractor, inspector and payment history stay attached.
              </li>
              <li>
                <AlertTriangle size={15} aria-hidden="true" /> Not legal ownership of a physical asset.
              </li>
            </ul>
          </section>

          <section className="side-card">
            <h2>Public location</h2>
            <p className="side-card__note">{asset.publicLocation.label}</p>
            <p className="side-card__note mono">
              {asset.publicLocation.coarseLat.toFixed(3)}, {asset.publicLocation.coarseLng.toFixed(3)} (coarse)
            </p>
            <p className="side-card__note" style={{ marginTop: 8 }}>
              Precise coordinates are private and shared only with authorized roles.
            </p>
          </section>

          <section className="side-card">
            <h2>Record references</h2>
            <div className="hash-stack">
              {cases[0] ? <HashDisplay value={cases[0].scopeHash} label="Latest scope" /> : null}
              {cases[0] ? <HashDisplay value={cases[0].policyHash} label="Policy" /> : null}
            </div>
          </section>

          <section className="side-card">
            <h2>Warranty status</h2>
            {cases.find((caseData) => caseData.warranty) ? (
              <>
                <Badge tone="warning">Warranty reopened</Badge>
                <p className="side-card__note" style={{ marginTop: 8 }}>
                  The failure and remedy are recorded in the same work order. No new escrow was created.
                </p>
              </>
            ) : (
              <>
                <Badge tone="positive">No open warranty case</Badge>
                <p className="side-card__note" style={{ marginTop: 8 }}>
                  Durability decisions and holdback releases are shown in the work-order history.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
