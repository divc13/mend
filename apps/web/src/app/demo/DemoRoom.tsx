'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { MODE_META } from '@/lib/modes';
import { CASES, FIXTURE_VERSION, SCENARIOS, getCase } from '@/lib/fixtures';
import { formatDateTime } from '@/lib/format';
import { Badge, Callout, PageHero } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Lock,
  Play,
  Refresh,
  ShieldCheck,
  SkipForward,
  Sparkles,
} from '@/components/Icons';

const START = '2026-11-10T08:00:00.000Z';

export function DemoRoom() {
  const { mode, apiConfigured, setMode } = useMode();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clock, setClock] = useState(START);
  const [status, setStatus] = useState('Replay idle. Select a scenario or fast-forward the recorded clock.');
  const activeScenario = SCENARIOS.find((scenario) => scenario.id === activeId);
  const activeCase = activeScenario?.caseId ? getCase(activeScenario.caseId) : undefined;
  const meta = MODE_META[mode];

  const nextEvent = useMemo(() => {
    if (!activeCase) return undefined;
    return activeCase.events.find((event) => new Date(event.at).getTime() > new Date(clock).getTime());
  }, [activeCase, clock]);

  function runScenario(id: string) {
    const scenario = SCENARIOS.find((item) => item.id === id);
    setActiveId(id);
    setClock(START);
    setStatus(
      scenario
        ? `Loaded ${scenario.code} · ${scenario.title}. ${scenario.expected}`
        : 'Scenario loaded.',
    );
  }

  function resetReplay() {
    setActiveId(null);
    setClock(START);
    setStatus('Replay reset. The deterministic fixture state is restored; no network or database was touched.');
  }

  function fastForward() {
    if (!activeCase) {
      setStatus('Select a scenario first. Fast-forward advances within one recorded work-order timeline.');
      return;
    }
    if (!nextEvent) {
      setStatus('End of the recorded timeline for this work order. Reset to start again.');
      return;
    }
    setClock(nextEvent.at);
    setStatus(`Fast-forwarded to ${formatDateTime(nextEvent.at)} · ${nextEvent.title}`);
  }

  return (
    <div className="container">
      <PageHero
        eyebrow="Demo control room"
        title="Replay is a tool, not a disguise."
        lead="Select a recorded scenario, reset the fixture state or fast-forward the timeline. The mode banner stays visible everywhere: LIVE TESTNET, MAINNET (never selectable) or REPLAY / SIMULATION."
        aside={
          <div className="side-card">
            <h2>Current mode</h2>
            <p className="side-card__value" style={{ fontSize: '1.02rem', fontFamily: 'var(--font-mono)' }}>
              {meta.label}
            </p>
            <p className="side-card__note">{meta.description}</p>
            <div style={{ marginTop: 10 }}>
              <Badge tone={mode === 'REPLAY' ? 'warning' : mode === 'LIVE_TESTNET' ? 'positive' : 'danger'}>{mode}</Badge>
            </div>
          </div>
        }
      />

      <div className="demo-shell" style={{ paddingBottom: 'clamp(50px, 8vw, 90px)' }}>
        <section className="panel" aria-labelledby="mode-select-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Mode selection</p>
              <h2 id="mode-select-title">Three labels. One honest choice.</h2>
              <p>
                MAINNET is never selectable here. LIVE TESTNET requires a configured API and a successful health check.
                If either is missing, the app stays in replay.
              </p>
            </div>
          </div>

          <div className="mode-cards">
            <button
              type="button"
              className={`mode-card${mode === 'REPLAY' ? ' is-selected' : ''}`}
              onClick={() => void setMode('REPLAY')}
              aria-pressed={mode === 'REPLAY'}
            >
              <span className="mode-card__label">REPLAY / SIMULATION</span>
              <h3>Frozen recording</h3>
              <p>No credentials, no wallet, no network dependency. Every figure is a protocol fixture.</p>
              <span className="mode-card__state" style={{ background: 'var(--amber-soft)', color: 'var(--amber-strong)' }}>
                Default · selectable
              </span>
            </button>
            <button
              type="button"
              className={`mode-card${mode === 'LIVE_TESTNET' ? ' is-selected' : ''}`}
              aria-disabled={!apiConfigured}
              aria-pressed={mode === 'LIVE_TESTNET'}
              onClick={() => void setMode('LIVE_TESTNET')}
            >
              <span className="mode-card__label">LIVE TESTNET</span>
              <h3>Test value only</h3>
              <p>
                {apiConfigured
                  ? 'Connect to the configured testnet API. Real testnet transaction hashes are required before an action is shown as executed.'
                  : 'MEND_API_BASE_URL is not configured in this build, so live testnet cannot be selected.'}
              </p>
              <span className="mode-card__state">
                {apiConfigured ? 'Requires health check' : 'Not configured'}
              </span>
            </button>
            <button
              type="button"
              className="mode-card"
              aria-disabled="true"
              aria-pressed={false}
              onClick={() => void setMode('MAINNET')}
            >
              <span className="mode-card__label">MAINNET</span>
              <h3>
                <Lock size={14} aria-hidden="true" /> Real funds · locked
              </h3>
              <p>Never selectable from the demo UI. Separate human approval is required for every real-funds action.</p>
              <span className="mode-card__state" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                Locked
              </span>
            </button>
          </div>

          <div className="demo-note" style={{ marginTop: 14 }}>
            <AlertTriangle size={16} aria-hidden="true" /> No private key, API secret or signing material exists in this
            browser. No mainnet transaction can be initiated from this page.
          </div>
        </section>

        <div className="demo-controls" role="group" aria-label="Replay controls">
          <button type="button" className="button button--small" onClick={resetReplay}>
            <Refresh size={15} aria-hidden="true" /> Reset replay
          </button>
          <button type="button" className="button button--small button--ghost" onClick={fastForward}>
            <SkipForward size={15} aria-hidden="true" /> Fast-forward
          </button>
          <span className="replay-clock" aria-live="polite">
            <ClockLabel /> <strong>{formatDateTime(clock)}</strong>
            {mode === 'REPLAY' ? <Badge tone="warning">REPLAY</Badge> : <Badge tone="positive">{mode}</Badge>}
          </span>
        </div>

        <p className="callout callout--warning" role="status" aria-live="polite">
          <span>
            <strong>Control:</strong> {status}
          </span>
        </p>

        <section aria-labelledby="scenarios-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Recorded scenarios</p>
              <h2 id="scenarios-title">Nine narratives, no fabricated success</h2>
              <p>
                Each scenario links to a real replay case or a recorded transcript. “Run” only changes local presentation
                state; it never claims a live transaction.
              </p>
            </div>
            <Badge tone="neutral">
              <ShieldCheck size={14} aria-hidden="true" /> {FIXTURE_VERSION}
            </Badge>
          </div>

          <div className="scenario-grid">
            {SCENARIOS.map((scenario) => {
              const isActive = activeId === scenario.id;
              const linkedCase = scenario.caseId ? getCase(scenario.caseId) : undefined;
              return (
                <article key={scenario.id} className={`scenario-card${isActive ? ' is-active' : ''}`} aria-labelledby={`scenario-${scenario.id}`}>
                  <div className="scenario-card__top">
                    <span className="scenario-card__code">{scenario.code}</span>
                    <Badge tone={isActive ? 'positive' : 'neutral'}>{isActive ? 'Active in replay' : 'Recorded'}</Badge>
                  </div>
                  <h3 id={`scenario-${scenario.id}`}>{scenario.title}</h3>
                  <p>{scenario.description}</p>
                  <p className="scenario-card__expected">{scenario.expected}</p>
                  <div className="tag-row">
                    {scenario.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="scenario-card__actions">
                    <button type="button" className="button button--small" onClick={() => runScenario(scenario.id)}>
                      <Play size={14} aria-hidden="true" /> Run replay
                    </button>
                    {linkedCase ? (
                      <Link className="button button--small button--ghost" href={`/cases/${linkedCase.id}`}>
                        Open case <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>

                  {isActive && scenario.transcript ? (
                    <div className="transcript" role="region" aria-label="Recorded prompt-injection transcript">
                      <p className="eyebrow" style={{ marginBottom: 2 }}>
                        Replay transcript · not a live log
                      </p>
                      {scenario.transcript.map((row, index) => (
                        <div key={`${row.speaker}-${index}`} className={`transcript__row${row.tone ? ` transcript__row--${row.tone}` : ''}`}>
                          <span className="transcript__speaker">{row.speaker}</span>
                          {row.text}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isActive && !scenario.transcript ? (
                    <div className="transcript" role="region" aria-label="Active replay step">
                      <div className="transcript__row transcript__row--success">
                        <span className="transcript__speaker">Replay control</span>
                        Scenario loaded. The clock is at 08:00 UTC. Use fast-forward to step through the recorded timeline.
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel" aria-labelledby="artifacts-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Recorded artifacts</p>
              <h2 id="artifacts-title">Judge replay without credentials</h2>
              <p>
                {CASES.length} public work orders, {SCENARIOS.length} scenarios, deterministic fixture versioning and no
                network dependency.
              </p>
            </div>
            <Badge tone="positive">
              <Check size={14} aria-hidden="true" /> Offline ready
            </Badge>
          </div>
          <dl className="facts-grid">
            <div className="fact">
              <dt>Fixture version</dt>
              <dd className="mono">{FIXTURE_VERSION}</dd>
            </div>
            <div className="fact">
              <dt>Scenarios</dt>
              <dd>{SCENARIOS.length}</dd>
            </div>
            <div className="fact">
              <dt>Work orders</dt>
              <dd>{CASES.length}</dd>
            </div>
            <div className="fact">
              <dt>Live credentials</dt>
              <dd>Not required</dd>
            </div>
          </dl>
          <div className="form-actions">
            <Link className="button button--ghost button--small" href="/trust">
              Read what is staged <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link className="button button--small" href="/cases/WO-BENCH-001-0001">
              Start with the successful repair <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <Callout tone="warning" title="Replay cannot be mistaken for live state">
          The mode banner is sticky at the top of every page. Replay pages never show explorer links for transactions that
          do not exist, never claim a live AI attestation and never present a dry quote as a payment.
        </Callout>

        <DataSourceNote detail="Demo control room is replay-only unless a configured testnet API passes a health check. MAINNET remains locked." />
      </div>
    </div>
  );
}

function ClockLabel() {
  return (
    <span className="sr-only">
      <Sparkles size={14} aria-hidden="true" /> Replay clock
    </span>
  );
}
