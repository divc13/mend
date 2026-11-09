'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Callout, PageHero } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import { CopyButton } from '@/components/CopyButton';
import { formatDateTime, shortHash } from '@/lib/format';
import { ArrowRight, Check, Clock, FileText, Lock, MapPin, ShieldCheck } from '@/components/Icons';

interface Receipt {
  id: string;
  caseLink: string;
  token: string;
  description: string;
  category: string;
  area: string;
  areaLabel: string;
  exifStripped: boolean;
  redactionCount: number;
  mediaHash?: string;
  duplicateChoice: string;
  submittedAt: string;
  source: 'replay';
  note?: string;
}

export function ReportStatusClient({ token }: { token?: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoaded(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`mend-report:${token}`);
      setReceipt(raw ? (JSON.parse(raw) as Receipt) : null);
    } catch {
      setReceipt(null);
    }
    setLoaded(true);
  }, [token]);

  return (
    <div className="container">
      <PageHero
        eyebrow="Private report status"
        title="Your report, kept private."
        lead="This page uses the private case token in your link. In replay, the receipt is stored only in the browser that created it."
        aside={
          <div className="side-card">
            <h2>Keep this link private</h2>
            <p className="side-card__note">
              Anyone with the token can view this status page. It never shows your precise location, raw photo or private
              evidence URL.
            </p>
            <div className="hero__note" style={{ marginTop: 12 }}>
              <span>
                <Lock size={15} aria-hidden="true" /> Token in the URL
              </span>
              <span>
                <ShieldCheck size={15} aria-hidden="true" /> No wallet
              </span>
            </div>
          </div>
        }
      />

      <div className="form-shell">
        <div className="form-main">
          {!token ? (
            <section className="form-card">
              <h2>No case token</h2>
              <p>
                This page needs the private link created after you submit a report. Open the link you saved, or{' '}
                <Link className="text-link" href="/report">
                  create a new report
                </Link>
                .
              </p>
            </section>
          ) : !loaded ? (
            <section className="form-card">
              <p role="status">Looking for the private replay receipt in this browser…</p>
            </section>
          ) : !receipt ? (
            <section className="form-card">
              <Badge tone="warning">Not found in this browser</Badge>
              <h2 style={{ marginTop: 12 }}>No replay receipt for this token</h2>
              <p>
                Replay receipts are stored only in the browser and session that created them. A different device, a
                private window or cleared site data will not have the receipt. This is a privacy choice, not a public
                lookup.
              </p>
              <div className="form-actions">
                <Link className="button button--ghost" href="/report">
                  Create a report
                </Link>
                <Link className="button" href="/">
                  Public map <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </section>
          ) : (
            <>
              <section className="form-card" aria-labelledby="receipt-title">
                <div className="case-hero__badges">
                  <Badge tone="warning">Replay receipt</Badge>
                  <Badge tone="positive">EXIF removed</Badge>
                  <Badge tone="neutral">Walletless</Badge>
                </div>
                <h2 id="receipt-title" style={{ marginTop: 12 }}>
                  Report {receipt.id} · submitted
                </h2>
                <p>
                  Submitted {formatDateTime(receipt.submittedAt)}. This is a local replay receipt, not a live report. It is
                  not visible to a steward or contractor.
                </p>

                <dl className="facts-grid" style={{ marginTop: 18 }}>
                  <div className="fact">
                    <dt>Category</dt>
                    <dd>{receipt.category.replace(/_/g, ' ')}</dd>
                  </div>
                  <div className="fact">
                    <dt>Public area</dt>
                    <dd>{receipt.areaLabel}</dd>
                  </div>
                  <div className="fact">
                    <dt>EXIF / GPS</dt>
                    <dd>{receipt.exifStripped ? 'Removed in browser' : 'Not removed'}</dd>
                  </div>
                  <div className="fact">
                    <dt>Redactions</dt>
                    <dd>{receipt.redactionCount} burned in</dd>
                  </div>
                  <div className="fact">
                    <dt>Duplicate choice</dt>
                    <dd>
                      {receipt.duplicateChoice === 'same'
                        ? 'Same problem'
                        : receipt.duplicateChoice === 'different'
                          ? 'Different problem'
                          : 'Let a steward decide'}
                    </dd>
                  </div>
                  <div className="fact">
                    <dt>Wallet</dt>
                    <dd>None</dd>
                  </div>
                </dl>

                <div className="field">
                  <span className="label">Description</span>
                  <p className="scope-copy" style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                    {receipt.description}
                  </p>
                </div>

                {receipt.mediaHash ? (
                  <div className="hash-display" style={{ marginTop: 12 }}>
                    <span className="hash-display__label">Redacted preview hash</span>
                    <code title={receipt.mediaHash}>{shortHash(receipt.mediaHash, 18, 10)}</code>
                    <CopyButton value={receipt.mediaHash} label="Copy hash" />
                  </div>
                ) : null}
              </section>

              <section className="form-card" aria-labelledby="status-timeline-title">
                <h2 id="status-timeline-title">What happens next</h2>
                <ol className="timeline" style={{ marginTop: 16 }}>
                  <li className="timeline__item">
                    <div className="timeline__rail">
                      <span className="timeline__dot">
                        <Check size={14} />
                      </span>
                      <span className="timeline__line" />
                    </div>
                    <div className="timeline__body">
                      <div className="timeline__meta">
                        <span className="timeline__kind">Submitted</span>
                        <time dateTime={receipt.submittedAt}>Complete</time>
                      </div>
                      <h3>Report received</h3>
                      <p>Photo re-encoded, metadata removed and redactions applied in the browser.</p>
                    </div>
                  </li>
                  <li className="timeline__item">
                    <div className="timeline__rail">
                      <span className="timeline__dot">
                        <Clock size={14} />
                      </span>
                      <span className="timeline__line" />
                    </div>
                    <div className="timeline__body">
                      <div className="timeline__meta">
                        <span className="timeline__kind">Private triage</span>
                        <time>Pending</time>
                      </div>
                      <h3>Duplicate check and scope suggestion</h3>
                      <p>Private inference proposes classification and duplicate candidates. A human confirms any merge.</p>
                    </div>
                  </li>
                  <li className="timeline__item">
                    <div className="timeline__rail">
                      <span className="timeline__dot">
                        <FileText size={14} />
                      </span>
                    </div>
                    <div className="timeline__body">
                      <div className="timeline__meta">
                        <span className="timeline__kind">Steward review</span>
                        <time>Pending</time>
                      </div>
                      <h3>Scope, budget and roster</h3>
                      <p>The steward approves a scope and maximum budget; the DAO authorizes the envelope and roster.</p>
                    </div>
                  </li>
                </ol>
                <Callout tone="warning" title="Replay only">
                  No steward or contractor can see this receipt. Start from the public map to explore a recorded case
                  that already has a decision and payment history.
                </Callout>
                <div className="form-actions">
                  <Link className="button button--ghost" href="/cases/WO-BENCH-001-0001">
                    Explore the recorded bench case
                  </Link>
                  <Link className="button" href="/report">
                    Report another <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            </>
          )}
          <DataSourceNote detail="Private replay receipts never leave this browser. No live report is claimed." />
        </div>

        <aside className="form-aside" aria-label="What this page does not show">
          <section className="side-card">
            <h2>Never shown here</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <MapPin size={15} aria-hidden="true" /> Precise coordinates.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> The raw photo or EXIF metadata.
              </li>
              <li>
                <FileText size={15} aria-hidden="true" /> Private evidence URLs or witness details.
              </li>
            </ul>
          </section>
          <section className="side-card">
            <h2>Token</h2>
            <p className="side-card__note mono" style={{ overflowWrap: 'anywhere' }}>
              {token ?? 'No token in URL'}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
