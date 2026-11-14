import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicMetrics, statusLabel } from '@/lib/fixtures';
import { metricsForCases } from '@/lib/case-metrics';
import { caseSourceLabel, caseSourceTone } from '@/lib/case-source';
import { loadCases } from '@/lib/server-api';
import { usdc } from '@/lib/format';
import { Badge, Callout, Metric, SectionHead, StatusPill } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import { ArrowRight, AlertTriangle, Eye, ShieldCheck, Users } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Public metrics',
  description:
    'Public MEND pilot metrics from live API case records when available, or frozen replay fixtures with a visible fallback label.',
};

export default async function DashboardPage() {
  const { cases, source, apiConfigured, fallbackReason } = await loadCases();
  const live = source === 'api';
  const metrics = live ? metricsForCases(cases) : getPublicMetrics();
  const maxStatus = Math.max(...metrics.statusDistribution.map((item) => item.count), 1);
  const accounted = (
    BigInt(metrics.refundedMicro) +
    BigInt(metrics.completionPaidMicro) +
    BigInt(metrics.holdbackReleasedMicro) +
    BigInt(metrics.holdbackHeldMicro) +
    cases.reduce((sum, item) => sum + BigInt(item.escrow.escrowedMicro ?? '0'), 0n)
  ).toString();
  const firstCase = cases[0]!;
  const sourceLabel = caseSourceLabel(source, firstCase.mode, apiConfigured);
  const apiReplay = live && firstCase.mode === 'REPLAY';

  return (
    <>
      <div className="container">
        <header className="page-hero">
          <div>
            <p className="eyebrow">Public dashboard</p>
            <h1 className="page-title">A pilot measured without theatre.</h1>
            <p className="page-lead">
              Reports, duplicate clusters, funding, human decisions and evidence honesty. Every figure is computed from
              the public case records shown below — live API records when available, frozen replay fixtures otherwise,
              always labelled.
            </p>
            <div style={{ marginTop: 12 }}>
              <Badge tone={caseSourceTone(source, firstCase.mode)}>{sourceLabel}</Badge>
            </div>
          </div>
          <div className="page-hero__aside">
            <div className="side-card">
              <h2>{live ? (apiReplay ? 'Live API · replay record total' : 'Live testnet funding total') : 'Replay funding total'}</h2>
              <p className="side-card__value" style={{ fontSize: '1.1rem' }}>
                {usdc(metrics.fundedMicro, 0)}
              </p>
              <p className="side-card__note">
                {usdc(metrics.completionPaidMicro, 0)} completion + {usdc(metrics.holdbackReleasedMicro, 0)} holdback
                released across {live ? 'the live API records' : 'the replay'}.
              </p>
              <Link className="text-link" href={`/cases/${firstCase.id}`} style={{ marginTop: 10 }}>
                Open {live ? 'the live case' : 'the bench case'} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
      </div>

      <section className="section section--tight" aria-labelledby="kpis-title">
        <div className="container">
          <SectionHead
            id="kpis-title"
            eyebrow="Pilot at a glance"
            title="Numbers that keep their caveats"
            lead="A small pilot is not a city-wide claim. The dashboard separates recorded decisions from physical outcomes and unavailable evidence."
          />

          <div className="metric-grid">
            <Metric label="Public assets" value={metrics.assets} note="Coarse public location only" />
            <Metric label="Reports received" value={metrics.reports} note="Walletless submissions" />
            <Metric label="Duplicate clusters" value={metrics.duplicateClusters} note="Human-confirmed merges" />
            <Metric label="Work orders" value={metrics.cases} note="Every state explained" tone="active" />
            <Metric
              label="Test value funded"
              value={usdc(metrics.fundedMicro, 0)}
              note={live ? (apiReplay ? 'API replay record · test value' : 'Live testnet record · test value, not real funds') : 'Test USDC, not real value'}
            />
            <Metric label="Completion paid" value={usdc(metrics.completionPaidMicro, 0)} note="90% after human acceptance" tone="positive" />
            <Metric label="Holdback released" value={usdc(metrics.holdbackReleasedMicro, 0)} note="10% after durability pass" tone="positive" />
            <Metric label="Warranty reopened" value={metrics.reopenedCases} note="Same work order, no new funds" tone="warning" />
          </div>

          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <section className="chart-card" aria-labelledby="status-chart-title">
              <h2 id="status-chart-title">Cases by current state</h2>
              <p>{live ? 'Live API case snapshot. One case can represent more than one story over time.' : 'Replay fixture snapshot. One case can represent more than one story over time.'}</p>
              <div className="status-bars" role="img" aria-label="Bar chart of case counts by state">
                {metrics.statusDistribution.map((item) => (
                  <div key={item.status} className="status-bar">
                    <span>{statusLabel(item.status)}</span>
                    <div className="status-bar__track">
                      <div
                        className={`status-bar__fill status-bar__fill--${item.status === 'WARRANTY_REOPENED' || item.status === 'DISPUTED' ? 'warning' : item.status === 'CLOSED' ? '' : 'neutral'}`}
                        style={{ width: `${(item.count / maxStatus) * 100}%` }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
              <table className="sr-only">
                <caption>Case counts by current state</caption>
                <thead>
                  <tr>
                    <th scope="col">State</th>
                    <th scope="col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.statusDistribution.map((item) => (
                    <tr key={item.status}>
                      <td>{statusLabel(item.status)}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="chart-card" aria-labelledby="evidence-mix-title">
              <h2 id="evidence-mix-title">Evidence honesty</h2>
              <p>What the interface can and cannot verify in this {live ? 'API dataset' : 'replay'}.</p>
              <div className="evidence-mix">
                <div className="evidence-mix__row">
                  <span className="badge badge--positive">
                    <ShieldCheck size={13} aria-hidden="true" /> Verified inference evidence
                  </span>
                  <strong>{metrics.verifiedEvidence}</strong>
                </div>
                <div className="evidence-mix__row">
                  <span className="badge badge--warning">
                    <AlertTriangle size={13} aria-hidden="true" /> Unavailable evidence
                  </span>
                  <strong>{metrics.evidenceUnavailable}</strong>
                </div>
                <div className="evidence-mix__row">
                  <span className="badge badge--info">
                    <Users size={13} aria-hidden="true" /> Human decisions
                  </span>
                  <strong>{metrics.humanDecisions}</strong>
                </div>
                <div className="evidence-mix__row">
                  <span className="badge badge--neutral">
                    <Eye size={13} aria-hidden="true" /> Physical claims
                  </span>
                  <strong>{metrics.physicalClaims}</strong>
                </div>
              </div>
              <div className="kpi-list">
                <div className="kpi">
                  <span>Funded</span>
                  <strong>{usdc(metrics.fundedMicro, 0)}</strong>
                </div>
                <div className="kpi">
                  <span>Accounted</span>
                  <strong>{usdc(accounted, 0)}</strong>
                </div>
                <div className="kpi">
                  <span>Held back</span>
                  <strong>{usdc(metrics.holdbackHeldMicro, 0)}</strong>
                </div>
                <div className="kpi">
                  <span>Refunded</span>
                  <strong>{usdc(metrics.refundedMicro, 0)}</strong>
                </div>
              </div>
              <p className="source-note source-note--replay">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  Zero verified inference evidence means exactly that. No live AI attestation is bundled with the{' '}
                  {live ? 'public API records' : 'replay'}. The deterministic ranking is reproducible, but it is not
                  presented as a live OutLayer callback.
                </span>
              </p>
            </section>
          </div>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="outcomes-title">
        <div className="container">
          <SectionHead
            id="outcomes-title"
            eyebrow="Outcomes"
            title="Each case, with its financial state"
            lead="Funded, refunded, paid and held amounts must reconcile. No case is shown as complete without a human acceptance."
          />
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <caption className="sr-only">Case financial and evidence summary</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Source</th>
                  <th scope="col">State</th>
                  <th scope="col">Funded</th>
                  <th scope="col">Refunded</th>
                  <th scope="col">Escrowed</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Holdback</th>
                  <th scope="col">Reports</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseData) => (
                  <tr key={caseData.id}>
                    <td data-label="Case">
                      <Link className="text-link" href={`/cases/${caseData.id}`}>
                        {caseData.assetId}
                      </Link>
                    </td>
                    <td data-label="Source">
                      <Badge tone={caseSourceTone(source, caseData.mode)}>
                        {caseSourceLabel(source, caseData.mode, apiConfigured)}
                      </Badge>
                    </td>
                    <td data-label="State">
                      <StatusPill status={caseData.status} />
                    </td>
                    <td data-label="Funded">{usdc(caseData.escrow.fundedMicro, 0)}</td>
                    <td data-label="Refunded">{usdc(caseData.escrow.refundedMicro, 0)}</td>
                    <td data-label="Escrowed">{usdc(caseData.escrow.escrowedMicro ?? '0', 0)}</td>
                    <td data-label="Completion">{usdc(caseData.escrow.completionPaidMicro, 0)}</td>
                    <td data-label="Holdback">
                      {usdc(BigInt(caseData.escrow.holdbackHeldMicro) + BigInt(caseData.escrow.holdbackReleasedMicro), 0)}
                    </td>
                    <td data-label="Reports">{caseData.reports.length}</td>
                    <td data-label="Evidence">{caseData.evidence.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Callout tone="warning" title="What this dashboard does not claim">
            {live
              ? 'It does not claim city adoption, verified physical safety, live AI attestations, mainnet activity or that every API record is a real chain action. A record whose own mode is REPLAY stays labelled as replay.'
              : 'It does not claim city adoption, verified physical safety, live AI attestations, a real transaction volume or that a replay is a live network. It is a deterministic presentation of the pilot fixtures.'}
          </Callout>
          <div className="form-actions" style={{ borderTop: 0 }}>
            <Link className="button button--ghost" href="/trust">
              Privacy &amp; limitations <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button" href="/live">
              Live API status <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <DataSourceNote
            source={source}
            detail={fallbackReason}
            liveDetail="Every value on this dashboard is computed from public case records returned by the configured MEND API. No analytics, wallet addresses or private evidence are used."
          />
        </div>
      </section>
    </>
  );
}
