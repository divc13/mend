'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DataSourceNote } from '@/components/DataSourceNote';
import { useMode } from '@/components/ModeProvider';
import { Timeline } from '@/components/Timeline';
import { TxHashRow } from '@/components/TxHashRow';
import { Badge, Callout, PageHero } from '@/components/ui';
import { runLiveTestnetScenario, type ApiFailure } from '@/lib/api';
import { FIXTURE_VERSION, getCase } from '@/lib/fixtures';
import {
  TESTNET_EXPLORER,
  TESTNET_HUB_ACCOUNT,
  TESTNET_TOKEN_ACCOUNT,
  normalizeScenarioRun,
  type RunStepStatus,
  type ScenarioRunView,
} from '@/lib/testnet';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  Clock,
  Coins,
  ExternalLink,
  Info,
  Lock,
  Play,
  Refresh,
  ShieldCheck,
  Users,
  X,
} from '@/components/Icons';

const REPLAY_CASE_ID = 'WO-BENCH-001-0001';

const statusMeta: Record<
  RunStepStatus,
  { label: string; tone: 'positive' | 'danger' | 'active' | 'warning' | 'neutral'; icon: React.ReactNode }
> = {
  SUCCESS: { label: 'Reported success', tone: 'positive', icon: <Check size={13} aria-hidden="true" /> },
  FAILED: { label: 'Reported failure', tone: 'danger', icon: <X size={13} aria-hidden="true" /> },
  RUNNING: { label: 'Running', tone: 'active', icon: <Refresh size={13} aria-hidden="true" /> },
  PENDING: { label: 'Pending', tone: 'warning', icon: <Clock size={13} aria-hidden="true" /> },
  SKIPPED: { label: 'Skipped', tone: 'neutral', icon: <CircleDot size={13} aria-hidden="true" /> },
  UNKNOWN: { label: 'Status not reported', tone: 'neutral', icon: <CircleDot size={13} aria-hidden="true" /> },
};

function friendlyRunError(error: ApiFailure): string {
  if (error.code === 'API_UNCONFIGURED') {
    return 'MEND_API_BASE_URL is not configured, so the live scenario cannot run. No request left this server.';
  }
  if (error.code === 'API_UNREACHABLE') {
    return 'The testnet API is unreachable. Nothing was executed and no live transaction is claimed.';
  }
  if (error.status === 429 || /RATE|LIMIT/i.test(error.code)) {
    const retry = error.retryAfterSeconds
      ? ` Try again in ${error.retryAfterSeconds} second${error.retryAfterSeconds === 1 ? '' : 's'}.`
      : ' Wait for the API cooldown before retrying.';
    return `The live run was rate-limited.${retry}`;
  }
  return `${error.message} (${error.code})`;
}

export function LiveConsole() {
  const { mode, apiConfigured, setMode } = useMode();
  const live = mode === 'LIVE_TESTNET';
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<ScenarioRunView | null>(null);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [showReplayPath, setShowReplayPath] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);

  // Selecting REPLAY must remove every live claim from the page immediately.
  useEffect(() => {
    modeRef.current = mode;
    if (mode === 'LIVE_TESTNET') return;
    setRun(null);
    setError(null);
    setRunning(false);
    setShowReplayPath(true);
  }, [mode]);

  useEffect(() => {
    if (run) resultRef.current?.focus();
  }, [run]);

  async function onRun() {
    if (!live || running) return;
    setRunning(true);
    setError(null);
    setRun(null);
    setShowReplayPath(false);

    const result = await runLiveTestnetScenario();
    setRunning(false);
    if (modeRef.current !== 'LIVE_TESTNET') {
      // The user switched back to REPLAY while the request was in flight. No
      // live result may be rendered in replay.
      setShowReplayPath(true);
      return;
    }
    if (!result.ok) {
      setError(result);
      setShowReplayPath(true);
      return;
    }

    const normalised = normalizeScenarioRun(result.data);
    if (!normalised) {
      setError({
        ok: false,
        status: 200,
        code: 'NO_STEPS',
        message: 'The API returned no ordered steps. Nothing is shown as a live execution.',
        replayFallback: true,
      });
      setShowReplayPath(true);
      return;
    }

    setRun(normalised);
  }

  const runTone =
    run?.status === 'SUCCESS' ? 'positive' : run?.status === 'FAILED' ? 'danger' : run ? 'warning' : 'neutral';

  return (
    <div className="container">
      <PageHero
        eyebrow="Live control"
        title="Run the testnet scenario, or watch the recording."
        lead={`LIVE TESTNET executes a real scenario against ${TESTNET_HUB_ACCOUNT} and ${TESTNET_TOKEN_ACCOUNT}. Every step is shown in order with the transaction hashes the API returns. If live is unavailable, the recorded replay path takes over — clearly labelled.`}
        aside={
          <div className="side-card wallet-status-card">
            <div className="wallet-status-card__top">
              <h2>Run mode</h2>
              <Badge tone={live ? 'positive' : 'warning'}>{live ? 'LIVE TESTNET' : 'REPLAY'}</Badge>
            </div>
            <p className="wallet-status-card__value">TEST VALUE ONLY</p>
            <p className="side-card__note">
              No mainnet, no deploy, no real funds. Explorer links are testnet-only and only appear for plausible NEAR
              transaction hashes returned by the API.
            </p>
            <dl>
              <div>
                <dt>Hub</dt>
                <dd className="mono">{TESTNET_HUB_ACCOUNT}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd className="mono">{TESTNET_TOKEN_ACCOUNT}</dd>
              </div>
              <div>
                <dt>Explorer</dt>
                <dd className="mono">explorer.testnet.near.org</dd>
              </div>
            </dl>
          </div>
        }
      >
        <div className="wallet-test-banner" role="note">
          <span className="wallet-test-banner__dot" aria-hidden="true" />
          <strong>LIVE TESTNET — TEST VALUE ONLY</strong>
          <span>REPLAY is the default · MAINNET is never selectable</span>
        </div>
      </PageHero>

      {!live ? (
        <Callout tone="warning" title="LIVE TESTNET is not selected" icon={<Lock size={18} />}>
          <p>
            This page is showing the replay path. Select LIVE TESTNET only when you mean to execute against the testnet
            API. The run button stays disabled in REPLAY.
          </p>
          <div className="wallet-actions wallet-actions--tight">
            <button
              type="button"
              className="button button--small"
              onClick={() => void setMode('LIVE_TESTNET')}
              disabled={!apiConfigured}
            >
              <ShieldCheck size={15} aria-hidden="true" /> Switch to LIVE TESTNET
            </button>
            <Link className="button button--small button--ghost" href="/demo">
              Open mode controls <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!apiConfigured ? (
            <p className="small muted">
              This build has no <code>MEND_API_BASE_URL</code>. The replay fixtures stay visible and no network request
              is made.
            </p>
          ) : null}
        </Callout>
      ) : null}

      <div className="live-shell">
        <section className="panel live-run-panel" aria-labelledby="live-run-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Scenario runner</p>
              <h2 id="live-run-title">One ordered run, real testnet hashes</h2>
              <p>
                Calls <code>POST /v1/live/run-scenario</code>. The response is rendered as an ordered timeline. A step
                with no hash is not described as confirmed on-chain.
              </p>
            </div>
            <Badge tone="warning" icon={<Coins size={14} aria-hidden="true" />}>
              100 mUSDC test value
            </Badge>
          </div>

          <div className="live-run-actions">
            <button
              type="button"
              className="button"
              onClick={() => void onRun()}
              disabled={!live || running}
              aria-busy={running}
              data-testid="run-live-scenario"
            >
              {running ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Running live testnet scenario…
                </>
              ) : (
                <>
                  <Play size={17} aria-hidden="true" /> Run live testnet scenario
                </>
              )}
            </button>
            <span className="small muted">
              {live
                ? 'LIVE TESTNET selected. This will create real testnet transactions, not replay state.'
                : 'Disabled in REPLAY / SIMULATION.'}
            </span>
          </div>

          {running ? (
            <div className="live-loading" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <div>
                <strong>Executing against testnet…</strong>
                <p>Waiting for the API to return the ordered steps. Do not start a second run.</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="wallet-error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>The live run was not confirmed.</strong>
                <p>{friendlyRunError(error)}</p>
                <p className="small">
                  The replay path below is a recording. It is not a substitute for a live transaction and gets no
                  explorer links.
                </p>
              </div>
            </div>
          ) : null}

          {!run && !running && !error ? (
            <div className="wallet-empty live-empty">
              <span className="wallet-empty__icon" aria-hidden="true">
                <Play size={26} />
              </span>
              <h3>{live ? 'Ready to run' : 'Replay path is active'}</h3>
              <p>
                {live
                  ? 'Start the scenario to see every step, the returned transaction hashes and the verified testnet explorer links.'
                  : 'Select LIVE TESTNET to enable the run button. Until then, only the recorded repair is shown below.'}
              </p>
            </div>
          ) : null}
        </section>

        {run ? (
          <section
            className="panel live-result-panel"
            aria-labelledby="live-result-title"
            ref={resultRef}
            tabIndex={-1}
          >
            <div className="panel__head">
              <div>
                <p className="eyebrow">Live run result</p>
                <h2 id="live-result-title">{run.title ?? 'Live testnet scenario'}</h2>
                {run.summary ? <p>{run.summary}</p> : null}
              </div>
              <Badge tone={runTone}>{run.status}</Badge>
            </div>

            <div className="live-summary-grid">
              <div>
                <span>Scenario</span>
                <strong className="mono">{run.scenarioId ?? 'canonical'}</strong>
              </div>
              <div>
                <span>Ordered steps</span>
                <strong>{run.steps.length}</strong>
              </div>
              <div>
                <span>Transaction hashes</span>
                <strong>{run.transactionCount}</strong>
              </div>
              <div>
                <span>Explorer links</span>
                <strong>{run.linkableTransactionCount}</strong>
              </div>
            </div>

            {run.transactionCount === 0 ? (
              <p className="wallet-inline-warning" role="status">
                <AlertTriangle size={15} aria-hidden="true" /> The API returned steps but no transaction hashes. This run
                is not presented as an on-chain execution.
              </p>
            ) : null}
            {run.transactionCount > run.linkableTransactionCount ? (
              <p className="wallet-inline-warning" role="status">
                <AlertTriangle size={15} aria-hidden="true" /> {run.transactionCount - run.linkableTransactionCount}{' '}
                hash{run.transactionCount - run.linkableTransactionCount === 1 ? '' : 'es'} did not match the NEAR
                transaction-hash format. They are shown without an explorer link.
              </p>
            ) : null}

            <ol className="live-steps" aria-label="Live testnet scenario steps">
              {run.steps.map((step) => {
                const meta = statusMeta[step.status];
                return (
                  <li
                    key={step.id}
                    className={`live-step live-step--${step.status.toLowerCase()}`}
                  >
                    <div className="live-step__rail" aria-hidden="true">
                      <span className="live-step__index">{step.index}</span>
                      <span className="live-step__line" />
                    </div>
                    <div className="live-step__body">
                      <div className="live-step__top">
                        <h3>{step.title}</h3>
                        <Badge tone={meta.tone} icon={meta.icon}>
                          {meta.label}
                        </Badge>
                      </div>
                      {step.detail ? <p>{step.detail}</p> : null}
                      {step.at ? (
                        <p className="small muted">
                          <Clock size={13} aria-hidden="true" /> <time dateTime={step.at}>{step.at}</time>
                        </p>
                      ) : null}
                      {step.txHashes.length > 0 ? (
                        <div className="live-step__txs">
                          {step.txHashes.map((hash, hashIndex) => (
                            <TxHashRow
                              key={`${step.id}-${hashIndex}`}
                              hash={hash}
                              label={`Step ${step.index} transaction`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="live-step__no-tx">
                          No transaction hash reported for this step. Nothing is claimed as confirmed on-chain.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="form-actions">
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={() => void onRun()}
                disabled={!live || running}
              >
                <Refresh size={14} aria-hidden="true" /> Run again
              </button>
              <Link className="button button--small button--ghost" href="/wallet">
                Back to the testnet wallet <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {showReplayPath || !live ? <ReplayPath /> : null}
      </div>

      {run && live ? (
        <DataSourceNote
          source="api"
          detail="Live steps and transaction hashes come from the configured testnet API. Only shape-valid testnet hashes receive explorer links."
        />
      ) : live && !error ? (
        <p className="source-note source-note--replay">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>No live run yet.</strong> LIVE TESTNET is selected and the API is configured, but no transaction is
            claimed until you run the scenario. The replay path is only shown when you opt into REPLAY or the API fails.
          </span>
        </p>
      ) : (
        <DataSourceNote
          source="fixture"
          detail="The recorded repair is shown because LIVE TESTNET is not selected or the live API did not return usable data. No live transaction is claimed."
        />
      )}
    </div>
  );
}

function ReplayPath() {
  const recordedCase = getCase(REPLAY_CASE_ID);

  return (
    <section className="panel replay-path" aria-labelledby="replay-path-title">
      <div className="panel__head">
        <div>
          <p className="eyebrow">Replay path · no live transaction</p>
          <h2 id="replay-path-title">The recorded repair, clearly labelled</h2>
          <p>
            The live run is unavailable or LIVE TESTNET is not selected. This is the frozen canonical repair from{' '}
            <code>{FIXTURE_VERSION}</code>. It is a recording — not a testnet execution — and receives no explorer links.
          </p>
        </div>
        <Badge tone="warning" icon={<Info size={14} aria-hidden="true" />}>
          REPLAY / SIMULATION
        </Badge>
      </div>

      <div className="replay-path__notes">
        <p>
          <Users size={15} aria-hidden="true" /> Every event below is a fixture. No wallet, faucet call or transaction
          occurred.
        </p>
        <p>
          <Lock size={15} aria-hidden="true" /> Replay state never becomes a live claim. Use the mode controls to opt in
          to testnet explicitly.
        </p>
      </div>

      {recordedCase ? (
        <Timeline events={recordedCase.events} />
      ) : (
        <p className="small muted">The recorded case is unavailable in this bundle.</p>
      )}

      <div className="form-actions">
        <Link className="button button--small" href="/demo">
          Open replay control room <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <Link className="button button--small button--ghost" href={`/cases/${REPLAY_CASE_ID}`}>
          Read the recorded case
        </Link>
        <a
          className="text-link"
          href={`${TESTNET_EXPLORER}/accounts/${encodeURIComponent(TESTNET_HUB_ACCOUNT)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hub on testnet explorer <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
