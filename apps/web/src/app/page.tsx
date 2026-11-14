import Link from 'next/link';
import { SchematicMap } from '@/components/SchematicMap';
import { DataSourceNote } from '@/components/DataSourceNote';
import { Badge, EvidenceTag, SectionHead, StatusPill } from '@/components/ui';
import { ArrowRight, Check, Eye, FileText, Gavel, Hammer, Lock, MapPin, Scale, ShieldCheck, Sparkles, Users } from '@/components/Icons';
import { ASSETS, FIXTURE_VERSION, getPublicMetrics, statusLabel } from '@/lib/fixtures';
import { metricsForCases } from '@/lib/case-metrics';
import { caseSourceLabel, caseSourceTone } from '@/lib/case-source';
import { assetFromCase, loadCases } from '@/lib/server-api';
import { formatTime, usdc } from '@/lib/format';
import type { TimelineKind } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { cases, source, apiConfigured, fallbackReason } = await loadCases();
  const live = source === 'api';
  const metrics = live ? metricsForCases(cases) : getPublicMetrics();
  const mapAssets = live
    ? [...new Map(cases.map((caseData) => {
        const asset = assetFromCase(caseData);
        return [asset.id, asset] as const;
      })).values()]
    : ASSETS;
  const heroCase = cases[0]!;
  const heroAsset = mapAssets.find((asset) => asset.id === heroCase.assetId);
  const heroLocation = heroCase.reports[0]?.publicLocation.label ?? heroAsset?.publicLocation.label ?? 'Public location withheld';
  const sourceLabel = caseSourceLabel(source, heroCase.mode, apiConfigured);
  const heroSteps = live ? heroCase.events.slice(-4) : [];

  return (
    <>
      <div className="container">
        <section className="hero" aria-labelledby="home-title">
          <div className="hero__copy">
            <p className="hero__kicker">
              <span className="hero__kicker-dot" aria-hidden="true" />
              Maintenance with memory · public pilot
            </p>
            <h1 id="home-title" className="hero__title">
              Get it fixed.
              <em>Keep it fixed.</em>
            </h1>
            <p className="hero__lead">
              MEND turns a report into a funded, independently inspected repair — then keeps the receipt attached to
              the asset. If the repair fails, the <strong>same work order reopens</strong>. The failure cannot disappear
              into a fresh bounty.
            </p>
            <div className="hero__actions">
              <Link className="button" href="/report">
                Report a problem <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button--ghost" href={`/cases/${heroCase.id}`}>
                {live ? 'Follow the live case' : 'Follow the bench repair'}
              </Link>
            </div>
            <p className="hero__note">
              <span>
                <Check size={15} aria-hidden="true" /> No wallet needed to report
              </span>
              <span>
                <Lock size={15} aria-hidden="true" /> EXIF/GPS removed in your browser
              </span>
              <span>
                <Users size={15} aria-hidden="true" /> Humans accept the work
              </span>
            </p>
          </div>

          <div className="hero__visual">
            <article
              className="hero-card"
              aria-label={`${live ? 'Live API' : 'Replay'} case snapshot: ${heroCase.title}`}
            >
              <div className="hero-card__top">
                <div>
                  <span className="hero-card__id">{heroCase.id}</span>
                  <h2>{heroCase.title}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill status={heroCase.status} />
                  <Badge tone={caseSourceTone(source, heroCase.mode)}>{sourceLabel}</Badge>
                </div>
              </div>
              <p className="hero-card__location">
                <MapPin size={14} aria-hidden="true" /> {heroLocation}
              </p>
              <div className="hero-card__mini">
                {live ? (
                  heroSteps.length > 0 ? (
                    heroSteps.map((event) => (
                      <div key={event.id} className="hero-mini-step">
                        <span className="hero-mini-step__dot">{heroEventIcon(event.kind)}</span>
                        <span className="hero-mini-step__copy">
                          <strong>{event.title}</strong>
                          <span>{event.detail || event.actor}</span>
                        </span>
                        <time>{formatTime(event.at)}</time>
                      </div>
                    ))
                  ) : (
                    <p className="hero-mini-step__copy">
                      The live API returned this case without public timeline events. No events are invented.
                    </p>
                  )
                ) : (
                  <ReplayHeroSteps />
                )}
              </div>
              <div className="hero-card__split">
                <div className="hero-split-item">
                  <span>Funded</span>
                  <strong>{usdc(heroCase.budgetMicro)}</strong>
                </div>
                <div className="hero-split-item">
                  <span>Awarded</span>
                  <strong>{usdc(heroCase.winningBidMicro ?? '0')}</strong>
                </div>
                <div className="hero-split-item">
                  <span>Holdback</span>
                  <strong>{usdc(heroCase.holdbackMicro ?? '0')}</strong>
                </div>
              </div>
              <p className="hero-trust">
                <ShieldCheck size={15} aria-hidden="true" />{' '}
                {live
                  ? `Data source: the configured MEND API. ${sourceLabel}. Explorer links appear only for real testnet transaction hashes.`
                  : apiConfigured
                    ? 'The live API did not return usable case data, so this is a frozen replay recording. No live transaction or AI attestation is claimed.'
                    : 'Replay recording — no live transaction or AI attestation is claimed.'}
              </p>
            </article>
          </div>
        </section>

        <div className="hero-stats" aria-label={live ? 'Live API at a glance' : 'Replay pilot at a glance'}>
          <div className="hero-stat">
            <strong>{metrics.assets}</strong>
            <span>Public assets</span>
          </div>
          <div className="hero-stat">
            <strong>{metrics.reports}</strong>
            <span>Reports received</span>
          </div>
          <div className="hero-stat">
            <strong>{usdc(metrics.fundedMicro, 0)}</strong>
            <span>Test value funded</span>
          </div>
          <div className="hero-stat">
            <strong>{metrics.reopenedCases}</strong>
            <span>Warranty reopened</span>
          </div>
        </div>
      </div>

      <section className="section" id="cases" aria-labelledby="map-title">
        <div className="container">
          <SectionHead
            id="map-title"
            eyebrow="On the ground"
            title="A public map with private precision"
            lead="Public pins are deliberately coarse. The exact location is shared only with authorized stewards and contractors, never rendered on this page."
            action={
              <Link className="button button--ghost button--small" href="/dashboard">
                Public metrics <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
          <SchematicMap assets={mapAssets} cases={cases} />
          <DataSourceNote
            source={source}
            detail={fallbackReason}
            liveDetail="The map and case cards use public records returned by the configured MEND API. Exact coordinates and private evidence URLs are never included."
          />
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="cases-title">
        <div className="container">
          <SectionHead
            id="cases-title"
            eyebrow={live ? 'Live API cases' : apiConfigured ? 'Replay fallback cases' : 'Replay case cards'}
            title="Every case has a next decision, not a spinner"
            lead={
              live
                ? 'These are the public work orders returned by the configured MEND API. Each state has a plain-language meaning, a named actor and the evidence that moved it forward.'
                : 'Each state has a plain-language meaning, a named actor and the evidence that moved it forward.'
            }
          />
          <div className="case-grid">
            {cases.map((item) => (
              <Link key={item.id} href={`/cases/${item.id}`} className="case-card">
                <div className="case-card__top">
                  <span className="case-card__id">{item.assetId}</span>
                  <StatusPill status={item.status} />
                </div>
                <h3>{item.title}</h3>
                <p className="case-card__summary">{item.summary}</p>
                <div style={{ marginTop: 10 }}>
                  <Badge tone={caseSourceTone(source, item.mode)}>
                    {caseSourceLabel(source, item.mode, apiConfigured)}
                  </Badge>
                </div>
                <div className="case-card__facts">
                  <span>
                    Envelope <strong>{usdc(item.budgetMicro, 0)}</strong>
                  </span>
                  <span>
                    Reports <strong>{item.reports.length}</strong>
                  </span>
                  <span>
                    Warranty{' '}
                    <strong>
                      {item.warranty ? 'Reopened' : item.status === 'CLOSED' ? 'Released' : 'Pending'}
                    </strong>
                  </span>
                </div>
                <div className="case-card__foot">
                  <span>{statusLabel(item.status)}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
          <DataSourceNote
            source={source}
            detail={fallbackReason}
            liveDetail="These case cards are live API records. A record whose own mode is REPLAY is labelled as a replay record, not as a live testnet transaction."
          />
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <SectionHead
            id="how-title"
            eyebrow="How it works"
            title="A repair, with its decisions attached"
            lead="No wallet theatre. No AI authority. No disappearing failures."
          />
          <div className="flow-steps">
            <article className="flow-step">
              <span className="flow-step__num">01</span>
              <h3>Report without a wallet</h3>
              <p>
                Take a photo, describe the damage and choose a public area. EXIF is stripped and you can paint over
                anything private before upload.
              </p>
            </article>
            <article className="flow-step">
              <span className="flow-step__num">02</span>
              <h3>Private triage, human merge</h3>
              <p>
                AI proposes duplicate candidates and a scope. A steward confirms any merge, edits the scope and sets a
                maximum budget.
              </p>
            </article>
            <article className="flow-step">
              <span className="flow-step__num">03</span>
              <h3>Sealed market, deterministic score</h3>
              <p>
                Contractors commit and reveal. A hash-pinned WASM policy weighs price, duration, warranty and materials.
                No LLM awards the job.
              </p>
            </article>
            <article className="flow-step">
              <span className="flow-step__num">04</span>
              <h3>Human acceptance, durable warranty</h3>
              <p>
                90% is paid after independent acceptance. 10% waits for a later durability inspection. Failure reopens the
                same work order.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--dark" aria-labelledby="promise-title">
        <div className="container promise">
          <div>
            <p className="eyebrow">The differentiator</p>
            <h2 id="promise-title" className="promise__title">
              A failed repair does not become <em>a new bounty.</em>
            </h2>
          </div>
          <div className="promise__copy">
            <p>
              Most systems lose the failure. The old job closes, a new one appears, and the history quietly resets. MEND
              reopens the original work order and keeps the failed durability inspection, the held-back money and the
              remediation in the same asset passport.
            </p>
            <p>
              The warranty is not a promise in a PDF. It is a funded 10% holdback, a predetermined inspection timestamp
              and an unbroken lineage.
            </p>
            <div className="promise__facts">
              <div className="promise__fact">
                <strong>90 / 10</strong>
                <span>Completion / durability</span>
              </div>
              <div className="promise__fact">
                <strong>0 new funds</strong>
                <span>On warranty reopening</span>
              </div>
              <div className="promise__fact">
                <strong>1 history</strong>
                <span>Failure and remedy</span>
              </div>
            </div>
            <div className="hero__actions">
              {live ? (
                <Link className="button button--light" href={`/cases/${heroCase.id}`}>
                  Open the live testnet case <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
              <Link className="button button--ghost" href="/cases/WO-RACK-002-0001" style={{ color: 'var(--paper)', borderColor: 'rgba(245,241,230,.3)' }}>
                See the replay failed-durability case <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="trust-title">
        <div className="container">
          <SectionHead
            id="trust-title"
            eyebrow="Trust by default"
            title="Four kinds of evidence, never blurred together"
            lead="A hash is not a repair. An AI suggestion is not a decision. The interface keeps the difference visible."
            action={
              <Link className="button button--ghost button--small" href="/trust">
                Read the trust model <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
          <div className="card-grid">
            <article className="card">
              <span className="card__icon">
                <ShieldCheck size={21} />
              </span>
              <EvidenceTag kind="VERIFIED" />
              <h3>Cryptographically checked</h3>
              <p>
                Inference attestations, OutLayer execution hashes and real transaction references. If verification is
                unavailable, the UI says so instead of implying success.
              </p>
            </article>
            <article className="card">
              <span className="card__icon">
                <AlertTriangleIcon />
              </span>
              <EvidenceTag kind="UNAVAILABLE" />
              <h3>Honestly unavailable</h3>
              <p>
                Replay recordings do not bundle live AI response signatures or real transaction hashes. Those panels are
                labelled unavailable.
              </p>
            </article>
            <article className="card">
              <span className="card__icon">
                <Users size={21} />
              </span>
              <EvidenceTag kind="HUMAN" />
              <h3>Named human decisions</h3>
              <p>
                A steward confirms the merge and award. A rostered inspector — never the contractor — accepts completion.
                AI cannot click these buttons.
              </p>
            </article>
            <article className="card">
              <span className="card__icon">
                <Eye size={21} />
              </span>
              <EvidenceTag kind="PHYSICAL" />
              <h3>Physical-world claims</h3>
              <p>
                Photos and inspection observations are claims about the world. MEND does not certify structural safety
                and never pretends that a hash inspected the bench.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="closing-cta">
            <div>
              <p className="eyebrow">Start with something small</p>
              <h2>Find something broken. Give it a memory.</h2>
              <p>
                Reporting needs no wallet, no seed phrase and no NEAR knowledge. The private case link is yours to keep.
              </p>
            </div>
            <div className="closing-cta__actions">
              <Link className="button button--light" href="/report">
                Report a problem <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="button button--ghost" href="/live" style={{ color: 'var(--paper)', borderColor: 'rgba(245,241,230,.3)' }}>
                Live API status
              </Link>
            </div>
          </div>
          <p className="source-note source-note--replay">
            <Sparkles size={16} aria-hidden="true" />
            <span>
              {live ? (
                <>
                  <strong>Live API data source.</strong> Case records come from the configured MEND API. Test value only;
                  static explanatory sections and the replay example are labelled separately. No mainnet transaction is
                  claimed.
                </>
              ) : (
                <>
                  <strong>Replay / simulation.</strong> {FIXTURE_VERSION}. No live transaction, AI attestation or physical
                  verification is claimed on this page.
                </>
              )}
            </span>
          </p>
        </div>
      </section>
    </>
  );
}

function ReplayHeroSteps() {
  return (
    <>
      <div className="hero-mini-step">
        <span className="hero-mini-step__dot">
          <FileText size={12} />
        </span>
        <span className="hero-mini-step__copy">
          <strong>Two reports merged privately</strong>
          <span>Steward confirmed a 94% duplicate suggestion</span>
        </span>
        <time>08:20</time>
      </div>
      <div className="hero-mini-step">
        <span className="hero-mini-step__dot">
          <Scale size={12} />
        </span>
        <span className="hero-mini-step__copy">
          <strong>Sealed market → deterministic winner</strong>
          <span>Contractor B · 80 USDC · 180-day warranty</span>
        </span>
        <time>09:21</time>
      </div>
      <div className="hero-mini-step">
        <span className="hero-mini-step__dot">
          <Hammer size={12} />
        </span>
        <span className="hero-mini-step__copy">
          <strong>Human inspector accepted completion</strong>
          <span>72 USDC paid · 8 USDC holdback retained</span>
        </span>
        <time>11:30</time>
      </div>
      <div className="hero-mini-step">
        <span className="hero-mini-step__dot">
          <Check size={12} />
        </span>
        <span className="hero-mini-step__copy">
          <strong>Durability passed, holdback released</strong>
          <span>Same asset history · work order closed</span>
        </span>
        <time>13:35</time>
      </div>
    </>
  );
}

function heroEventIcon(kind: TimelineKind) {
  switch (kind) {
    case 'score':
    case 'bid':
      return <Scale size={12} />;
    case 'award':
      return <Gavel size={12} />;
    case 'work':
      return <Hammer size={12} />;
    case 'inspection':
      return <Check size={12} />;
    case 'payment':
      return <Sparkles size={12} />;
    default:
      return <FileText size={12} />;
  }
}

function AlertTriangleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </svg>
  );
}
