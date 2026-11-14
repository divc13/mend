'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { MODE_META } from '@/lib/modes';
import {
  DEMO_ROLES,
  clearDemoIdentity,
  isDemoAccount,
  readDemoIdentity,
  storeDemoIdentity,
  type DemoIdentity,
  type DemoRole,
} from '@/lib/api';
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

const ROLE_ACCOUNT_KEYS: Partial<Record<DemoRole, string>> = {
  STEWARD: 'steward',
  SPONSOR: 'sponsor',
  DAO: 'dao',
  CONTRACTOR: 'contractor',
  INSPECTOR: 'inspector',
  ADMIN: 'admin',
};

export function DemoRoom() {
  const { mode, apiConfigured, apiHealth, setMode } = useMode();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clock, setClock] = useState(START);
  const [status, setStatus] = useState('Replay idle. Select a scenario or fast-forward the recorded clock.');
  const [demoRole, setDemoRole] = useState<DemoRole>('STEWARD');
  const [demoAccount, setDemoAccount] = useState('mend-steward.testnet');
  const [savedIdentity, setSavedIdentity] = useState<DemoIdentity | null>(null);
  const [demoError, setDemoError] = useState('');
  const [demoStatus, setDemoStatus] = useState('No demo role stored. API calls carry no role headers.');
  const activeScenario = SCENARIOS.find((scenario) => scenario.id === activeId);
  const activeCase = activeScenario?.caseId ? getCase(activeScenario.caseId) : undefined;
  const meta = MODE_META[mode];

  useEffect(() => {
    const stored = readDemoIdentity();
    if (!stored) return;
    setDemoRole(stored.role);
    setDemoAccount(stored.account);
    setSavedIdentity(stored);
    setDemoStatus(`Stored for this tab: ${stored.role} · ${stored.account}`);
  }, []);

  function suggestedAccount(role: DemoRole): string | undefined {
    const key = ROLE_ACCOUNT_KEYS[role];
    return key ? apiHealth?.roleAccounts?.[key] : undefined;
  }

  function onDemoRoleChange(role: DemoRole) {
    setDemoRole(role);
    setDemoError('');
    const suggested = suggestedAccount(role);
    if (suggested) setDemoAccount(suggested);
  }

  function saveDemoRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = demoAccount.trim();
    if (!isDemoAccount(account)) {
      setDemoError('Enter a valid NEAR testnet account ending in .testnet. This demo selector never accepts a key.');
      return;
    }
    const identity: DemoIdentity = { role: demoRole, account };
    if (!storeDemoIdentity(identity)) {
      setDemoError('Session storage is unavailable in this browser, so the demo role could not be stored.');
      return;
    }
    setSavedIdentity(identity);
    setDemoError('');
    setDemoStatus(
      `Stored for this tab: ${identity.role} · ${identity.account}. Only same-origin /api/mend calls receive the demo headers.`,
    );
  }

  function onClearDemoRole() {
    clearDemoIdentity();
    setSavedIdentity(null);
    setDemoError('');
    setDemoStatus('Demo role cleared. API calls carry no role headers.');
  }

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

        <section className="panel" aria-labelledby="demo-role-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">TESTNET DEMO ROLE</p>
              <h2 id="demo-role-title">Demo auth, not authentication</h2>
              <p>
                Store a role and testnet account for this tab. <code>apiFetch</code> forwards them as{' '}
                <code>x-mend-role</code> and <code>x-mend-account</code> only to the same-origin{' '}
                <code>/api/mend/*</code> proxy. The API must also have demo headers enabled.
              </p>
            </div>
            <Badge tone={savedIdentity ? 'warning' : 'neutral'}>
              {savedIdentity ? 'DEMO ROLE STORED' : 'NO DEMO ROLE'}
            </Badge>
          </div>

          <form onSubmit={saveDemoRole}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="demo-role">Testnet demo role</label>
                <select
                  id="demo-role"
                  className="select"
                  value={demoRole}
                  onChange={(event) => onDemoRoleChange(event.target.value as DemoRole)}
                >
                  {DEMO_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <span className="field__hint">
                  Selects which demo actor the API should evaluate. It is not a wallet and grants no real authority.
                </span>
              </div>
              <div className="field">
                <label htmlFor="demo-account">Testnet account</label>
                <input
                  id="demo-account"
                  className="input"
                  value={demoAccount}
                  onChange={(event) => setDemoAccount(event.target.value)}
                  placeholder="mend-steward.testnet"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={demoError ? true : undefined}
                />
                <span className="field__hint">
                  Must end in <code>.testnet</code>. Never enter a private key, seed phrase or mainnet account.
                </span>
              </div>
            </div>

            {demoError ? (
              <p className="field__error" role="alert">
                {demoError}
              </p>
            ) : null}

            <div className="form-actions">
              <button type="submit" className="button button--small" data-testid="save-demo-role">
                <ShieldCheck size={15} aria-hidden="true" /> Save demo role for this tab
              </button>
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={onClearDemoRole}
                disabled={!savedIdentity}
              >
                Clear demo role
              </button>
              <span className="small muted" role="status" aria-live="polite">
                {demoStatus}
              </span>
            </div>
          </form>

          {savedIdentity ? (
            <p className="small muted">
              Forwarded on API calls: <code>x-mend-role: {savedIdentity.role}</code> ·{' '}
              <code>x-mend-account: {savedIdentity.account}</code>. Stored in sessionStorage for this tab only.
            </p>
          ) : null}

          <div className="demo-note" role="note">
            <AlertTriangle size={16} aria-hidden="true" /> <strong>DEMO AUTH ONLY.</strong> These headers are trivially
            spoofable and are not production authentication. They are testnet-only, never a wallet signature, and must
            not be used to authorize real funds. No secret material belongs in this form.
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
              <h2 id="scenarios-title">{SCENARIOS.length} narratives, no fabricated success</h2>
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
                    <button
                      type="button"
                      className="button button--small"
                      data-testid={`scenario-${scenario.id}`}
                      onClick={() => runScenario(scenario.id)}
                    >
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

        <DataSourceNote detail="Demo control room is replay-only unless a configured testnet API reports LIVE_TESTNET health. Demo role headers are session-only testnet demo auth, not authentication. MAINNET remains locked." />
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
