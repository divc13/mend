import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CaseBundle } from '@/lib/types';
import { getAsset } from '@/lib/fixtures';
import { assetFromCase, loadCase } from '@/lib/server-api';
import { STATE_COPY } from '@/lib/status';
import { formatDateTime, shortAccount, usdc } from '@/lib/format';
import { Badge, HashDisplay, StatusPill } from '@/components/ui';
import { Timeline } from '@/components/Timeline';
import { TrustPanel } from '@/components/TrustPanel';
import { MoneyRail } from '@/components/MoneyRail';
import { WarrantyCountdown } from '@/components/WarrantyCountdown';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  ArrowRight,
  Check,
  Coins,
  FileText,
  Gavel,
  MapPin,
  Scale,
  ShieldCheck,
  Users,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}): Promise<Metadata> {
  const { workOrderId } = await params;
  const { caseData } = await loadCase(workOrderId);
  if (!caseData) return { title: 'Case not found' };
  return {
    title: caseData.title,
    description: caseData.summary,
  };
}

export default async function CasePage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const { caseData, source, apiConfigured, fallbackReason } = await loadCase(workOrderId);
  if (!caseData) notFound();
  const asset = source === 'api' ? assetFromCase(caseData) : getAsset(caseData.assetId);
  if (!asset) notFound();
  const stateCopy = STATE_COPY[caseData.status];
  const caseIsReplay = source === 'fixture' || caseData.mode === 'REPLAY';
  const sourceLabel =
    source === 'api'
      ? caseData.mode === 'REPLAY'
        ? 'LIVE API · REPLAY RECORD'
        : 'LIVE API'
      : apiConfigured
        ? 'REPLAY / SIMULATION · FIXTURE FALLBACK'
        : 'REPLAY / SIMULATION';

  return (
    <>
      <div className="container" data-testid="case-page">
        <header className="case-hero">
          <div>
            <nav className="case-hero__breadcrumbs" aria-label="Breadcrumb">
              <Link href="/">Map</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/assets/${asset.id}`}>{asset.id}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{caseData.id}</span>
            </nav>
            <div className="case-hero__badges">
              <StatusPill status={caseData.status} />
              <Badge tone={caseIsReplay ? 'warning' : 'positive'}>{sourceLabel}</Badge>
              <Badge tone="neutral">{caseData.reports.length} report{caseData.reports.length === 1 ? '' : 's'}</Badge>
            </div>
            <h1 className="case-hero__title" style={{ marginTop: 16 }}>
              {caseData.title}
            </h1>
            <p className="case-hero__summary">{caseData.summary}</p>
            <p className="hero__note">
              <span>
                <MapPin size={15} aria-hidden="true" /> {asset.publicLocation.label}
              </span>
              <span>
                <FileText size={15} aria-hidden="true" /> {caseData.id}
              </span>
              <span>
                <Users size={15} aria-hidden="true" /> {shortAccount(caseData.contractorId ?? 'No contractor yet')}
              </span>
            </p>
            {source === 'fixture' && apiConfigured ? (
              <p className="source-note source-note--replay" data-testid="fixture-fallback" style={{ marginTop: 12 }}>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  <strong>Fixture fallback.</strong>{' '}
                  {fallbackReason ?? 'The live API did not return usable data for this case.'} No live transaction,
                  attestation or physical verification is claimed.
                </span>
              </p>
            ) : null}
          </div>

          <div className="case-hero__side">
            <div className="side-card">
              <h2>Current state · plain language</h2>
              <p className="side-card__note" style={{ marginTop: 10, color: 'var(--ink-2)' }}>
                {stateCopy.meaning}
              </p>
              <p className="side-card__note" style={{ marginTop: 8 }}>
                <strong>Next:</strong> {stateCopy.next}
              </p>
              <p className="side-card__note" style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                Updated {formatDateTime(caseData.updatedAt)}
              </p>
            </div>
            <div className="side-card" data-testid="case-accounting">
              <h2>Money at a glance</h2>
              <p className="side-card__value" data-testid="case-funded">
                {usdc(caseData.escrow.fundedMicro)}
              </p>
              <p className="side-card__note">Funded in {caseData.fundingToken}</p>
              <dl>
                <div>
                  <dt>Refunded</dt>
                  <dd data-testid="case-refunded">{usdc(caseData.escrow.refundedMicro)}</dd>
                </div>
                {BigInt(caseData.escrow.escrowedMicro ?? '0') > 0n ? (
                  <div>
                    <dt>Still escrowed</dt>
                    <dd data-testid="case-escrowed">{usdc(caseData.escrow.escrowedMicro ?? '0')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Completion paid</dt>
                  <dd data-testid="case-completion-paid">{usdc(caseData.escrow.completionPaidMicro)}</dd>
                </div>
                <div>
                  <dt>Holdback held</dt>
                  <dd data-testid="case-holdback-held">{usdc(caseData.escrow.holdbackHeldMicro)}</dd>
                </div>
                <div>
                  <dt>Holdback released</dt>
                  <dd data-testid="case-holdback-released">{usdc(caseData.escrow.holdbackReleasedMicro)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </header>
      </div>

      <div className="container">
        <div className="case-layout">
          <div className="case-main">
            <section className="panel" aria-labelledby="scope-title">
              <div className="panel__head">
                <div>
                  <p className="eyebrow">Approved scope</p>
                  <h2 id="scope-title">What the contractor is allowed to do</h2>
                  <p>
                    Scope, budget, roster and scoring policy were authorized together. AI may propose; it cannot approve.
                  </p>
                </div>
                <Badge tone={caseData.daoApproval.state === 'APPROVED' ? 'positive' : 'warning'}>
                  DAO #{caseData.daoApproval.proposalId} · {caseData.daoApproval.state}
                </Badge>
              </div>
              <p className="scope-copy">{caseData.scope}</p>
              <div className="hash-stack" style={{ marginTop: 16 }}>
                <HashDisplay value={caseData.scopeHash} label="Scope hash" />
                <HashDisplay value={caseData.policyHash} label="Scoring policy hash" />
              </div>
              <dl className="facts-grid" style={{ marginTop: 16 }}>
                <div className="fact">
                  <dt>Maximum budget</dt>
                  <dd>{usdc(caseData.budgetMicro)}</dd>
                </div>
                <div className="fact">
                  <dt>Awarded bid</dt>
                  <dd>{caseData.winningBidMicro ? usdc(caseData.winningBidMicro) : 'Not awarded'}</dd>
                </div>
                <div className="fact">
                  <dt>Contractor roster</dt>
                  <dd>{caseData.daoApproval.contractorRoster.length} approved accounts</dd>
                </div>
                <div className="fact">
                  <dt>Inspector roster</dt>
                  <dd>{caseData.daoApproval.inspectorRoster.length} approved accounts</dd>
                </div>
              </dl>
              <div className="source-note source-note--replay">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  {source === 'api'
                    ? 'The API supplied this DAO reference. It is not a live Sputnik proposal lookup: MEND trusts only a FunctionCall that executes dao_authorize after approval, never proposal text.'
                    : 'DAO authorization is a push path: a Sputnik FunctionCall proposal executes dao_authorize only after approval. MEND does not trust proposal text. This replay reference is not a live proposal lookup.'}
                </span>
              </div>
            </section>

            <TimelinePanel caseData={caseData} />

            <MoneyRail caseData={caseData} source={source} />

            <EvidencePanel caseData={caseData} />

            <TrustPanel caseData={caseData} source={source} />
          </div>

          <aside className="case-aside" aria-label="Case side panel">
            <WarrantyCountdown caseData={caseData} />

            <section className="panel">
              <div className="panel__head">
                <div>
                  <p className="eyebrow">Consoles</p>
                  <h2>Open the working views</h2>
                </div>
              </div>
              <ul className="decision-list">
                <li>
                  <Scale size={15} aria-hidden="true" />
                  <Link className="text-link" href={`/bids/${caseData.id}`}>
                    Sealed bid room <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
                <li>
                  <Users size={15} aria-hidden="true" />
                  <Link className="text-link" href={`/inspector/${caseData.id}`}>
                    Inspector evidence review <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
                <li>
                  <Coins size={15} aria-hidden="true" />
                  <Link className="text-link" href={`/sponsor/${caseData.id}`}>
                    Sponsor &amp; Intents <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
                <li>
                  <Gavel size={15} aria-hidden="true" />
                  <Link className="text-link" href={`/steward?case=${encodeURIComponent(caseData.id)}`}>
                    Steward console <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
                <li>
                  <FileText size={15} aria-hidden="true" />
                  <Link className="text-link" href={`/assets/${asset.id}`}>
                    Asset passport <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </section>

            <section className="panel">
              <div className="panel__head">
                <div>
                  <p className="eyebrow">Participants</p>
                  <h2>Who is accountable</h2>
                </div>
              </div>
              <dl className="inline-facts">
                <div>
                  <dt>Steward</dt>
                  <dd className="mono">{shortAccount('steward.mend.testnet')}</dd>
                </div>
                <div>
                  <dt>Contractor</dt>
                  <dd className="mono">{caseData.contractorId ? shortAccount(caseData.contractorId) : 'Not awarded'}</dd>
                </div>
                <div>
                  <dt>Inspector</dt>
                  <dd className="mono">{caseData.inspectorId ? shortAccount(caseData.inspectorId) : 'Not assigned'}</dd>
                </div>
                <div>
                  <dt>DAO</dt>
                  <dd className="mono">{shortAccount(caseData.daoApproval.daoAccount)}</dd>
                </div>
                <div>
                  <dt>AI roles</dt>
                  <dd>Proposal only</dd>
                </div>
              </dl>
              <div className="rule-note">
                The contractor and inspector must be different accounts. AI roles cannot accept, award, refund or release
                funds.
              </div>
            </section>

            <DataSourceNote
              source={source}
              detail={fallbackReason}
              liveDetail={
                caseData.mode === 'REPLAY'
                  ? 'Data source: the configured MEND API. The API marks this record REPLAY / SIMULATION, so no live transaction or attestation is claimed.'
                  : 'Data source: the configured MEND live API. Explorer links appear only for real transaction hashes.'
              }
            />
          </aside>
        </div>
      </div>
    </>
  );
}

function TimelinePanel({ caseData }: { caseData: CaseBundle }) {
  return (
    <section className="panel" aria-labelledby="timeline-title">
      <div className="panel__head">
        <div>
          <p className="eyebrow">Full timeline</p>
          <h2 id="timeline-title">Every state, actor and evidence reference</h2>
          <p>No unexplained “processing” state. Each entry names the actor and the decision that moved the case.</p>
        </div>
        <Badge tone="neutral">{caseData.events.length} events</Badge>
      </div>
      <Timeline events={caseData.events} />
    </section>
  );
}

function EvidencePanel({ caseData }: { caseData: CaseBundle }) {
  return (
    <section className="panel" aria-labelledby="evidence-title">
      <div className="panel__head">
        <div>
          <p className="eyebrow">Evidence packages</p>
          <h2 id="evidence-title">Private media, public hashes</h2>
          <p>On-chain state references redacted hashes only. Raw media and precise location stay off-chain.</p>
        </div>
        <Badge tone="neutral">{caseData.evidence.length} package{caseData.evidence.length === 1 ? '' : 's'}</Badge>
      </div>

      {caseData.evidence.length === 0 ? (
        <p className="empty-state">No evidence package has been submitted yet.</p>
      ) : (
        caseData.evidence.map((evidence) => (
          <article key={evidence.id} className="trust-item" style={{ marginTop: 12 }}>
            <div className="trust-item__head">
              <span className="trust-icon">
                <FileText size={18} />
              </span>
              <div>
                <h3>
                  {evidence.id} · {evidence.kind.toLowerCase()} evidence
                </h3>
                <p className="trust-item__sub">
                  {evidence.submittedBy} · {formatDateTime(evidence.submittedAt)}
                </p>
              </div>
              <Badge tone="positive">Redacted</Badge>
            </div>
            <ul className="checklist" style={{ marginTop: 0 }}>
              {evidence.checklist.map((item) => (
                <li key={item.label} className="checklist__item">
                  {item.complete ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">—</span>}
                  <span>
                    {item.label}
                    {item.note ? <small>{item.note}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="hash-stack" style={{ marginTop: 12 }}>
              {evidence.evidenceHashes.map((hash, index) => (
                <HashDisplay key={hash} value={hash} label={`Evidence hash ${index + 1}`} />
              ))}
            </div>
          </article>
        ))
      )}

      <div className="rule-note">
        A completeness review can identify missing checklist items. It cannot certify physical quality and it never
        supplies the human acceptance decision.
      </div>
    </section>
  );
}
