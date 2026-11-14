'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DataSourceNote } from '@/components/DataSourceNote';
import { useMode } from '@/components/ModeProvider';
import { Timeline } from '@/components/Timeline';
import { Badge, Callout, PageHero } from '@/components/ui';
import { readDemoIdentity, type DemoIdentity } from '@/lib/api';
import { FIXTURE_VERSION, getCase } from '@/lib/fixtures';
import { formatDateTime } from '@/lib/format';
import { TESTNET_EXPLORER, TESTNET_HUB_ACCOUNT, TESTNET_TOKEN_ACCOUNT } from '@/lib/testnet';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
  Info,
  Lock,
  Refresh,
  ShieldCheck,
  Users,
} from '@/components/Icons';

const REPLAY_CASE_ID = 'WO-BENCH-001-0001';

function healthTone(live: boolean, healthy: boolean): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (healthy) return 'positive';
  if (live) return 'warning';
  return 'neutral';
}

export function LiveConsole() {
  const { mode, apiConfigured, apiHealth, refreshApiHealth, setMode } = useMode();
  const live = mode === 'LIVE_TESTNET';
  const healthy = live && apiHealth?.ok === true;
  const [checking, setChecking] = useState(false);
  const [demoIdentity, setDemoIdentity] = useState<DemoIdentity | null>(null);

  useEffect(() => {
    setDemoIdentity(readDemoIdentity());
  }, []);

  async function onRefresh() {
    if (checking) return;
    setChecking(true);
    try {
      await refreshApiHealth();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="container">
      <PageHero
        eyebrow="Live control · read-only"
        title="The testnet API, without a live runner."
        lead={`This console verifies the configured MEND API and shows its LIVE_TESTNET health. It does not execute testnet actions and does not start the scenario lifecycle. If the API is missing, unreachable or not in LIVE_TESTNET mode, the app stays in REPLAY / SIMULATION with frozen fixtures.`}
        aside={
          <div className="side-card wallet-status-card">
            <div className="wallet-status-card__top">
              <h2>API mode</h2>
              <Badge tone={healthTone(live, healthy)}>
                {healthy ? 'LIVE_TESTNET verified' : live ? 'LIVE TESTNET selected' : 'REPLAY'}
              </Badge>
            </div>
            <p className="wallet-status-card__value">TEST VALUE ONLY</p>
            <p className="side-card__note">
              No mainnet, no deploy, no real funds, no scenario runner. Explorer links are testnet-only and only appear
              for plausible NEAR transaction hashes returned by the API.
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
                <dt>Checks</dt>
                <dd className="mono">GET /api/mend/health</dd>
              </div>
            </dl>
          </div>
        }
      >
        <div className="wallet-test-banner" role="note">
          <span className="wallet-test-banner__dot" aria-hidden="true" />
          <strong>READ-ONLY TESTNET CONSOLE — TEST VALUE ONLY</strong>
          <span>REPLAY is the default · MAINNET is never selectable</span>
        </div>
      </PageHero>

      {!live ? (
        <Callout tone="warning" title="LIVE_TESTNET is not verified" icon={<Lock size={18} />}>
          <p>
            The app is in REPLAY / SIMULATION. Selecting LIVE TESTNET performs a fresh health check against{' '}
            <code>/api/mend/health</code>. The mode only changes when the API answers with mode{' '}
            <code>LIVE_TESTNET</code> and is not degraded.
          </p>
          <div className="wallet-actions wallet-actions--tight">
            <button
              type="button"
              className="button button--small"
              onClick={() => void setMode('LIVE_TESTNET')}
              disabled={!apiConfigured}
            >
              <ShieldCheck size={15} aria-hidden="true" /> Check API and select LIVE TESTNET
            </button>
            <Link className="button button--small button--ghost" href="/demo">
              Open mode &amp; demo role <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!apiConfigured ? (
            <p className="small muted">
              This build has no <code>MEND_API_BASE_URL</code>. The replay fixtures stay visible and no external
              request is made.
            </p>
          ) : null}
        </Callout>
      ) : null}

      <div className="live-shell">
        <section className="panel live-run-panel" aria-labelledby="api-health-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">API health · read only</p>
              <h2 id="api-health-title">Health check, not a scenario runner</h2>
              <p>
                The page calls <code>GET /api/mend/health</code> through the same-origin proxy. It never calls{' '}
                <code>/v1/live/run-scenario</code> and never claims a transaction.
              </p>
            </div>
            <Badge tone={healthTone(live, healthy)}>
              {healthy ? 'LIVE_TESTNET' : apiHealth ? apiHealth.mode : 'Checking'}
            </Badge>
          </div>

          <div className="live-summary-grid">
            <div>
              <span>API mode</span>
              <strong className="mono">{apiHealth?.mode ?? 'checking…'}</strong>
            </div>
            <div>
              <span>Health status</span>
              <strong>{apiHealth?.status ?? 'not checked'}</strong>
            </div>
            <div>
              <span>Database</span>
              <strong>{apiHealth?.database ?? 'not reported'}</strong>
            </div>
            <div>
              <span>Runner flag</span>
              <strong>{apiHealth ? (apiHealth.liveScenarioEnabled ? 'enabled (UI hidden)' : 'disabled') : 'not checked'}</strong>
            </div>
          </div>

          <p className="small muted" role="status" aria-live="polite">
            {apiHealth ? apiHealth.message : 'Checking the same-origin API proxy…'}
          </p>

          <div className="live-run-actions">
            <button
              type="button"
              className="button"
              onClick={() => void onRefresh()}
              disabled={checking}
              aria-busy={checking}
              data-testid="refresh-api-health"
            >
              {checking ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Checking API…
                </>
              ) : (
                <>
                  <Refresh size={17} aria-hidden="true" /> Refresh API status
                </>
              )}
            </button>
            <span className="small muted">
              Last checked {apiHealth ? formatDateTime(apiHealth.checkedAt) : '—'}
              {demoIdentity ? (
                <>
                  {' · '}Demo role <code>{demoIdentity.role}</code> · <code>{demoIdentity.account}</code>
                </>
              ) : (
                <>
                  {' · '}No demo role stored (see <Link href="/demo">/demo</Link>)
                </>
              )}
            </span>
          </div>

          {apiHealth && apiHealth.mode !== 'UNKNOWN' ? (
            <dl className="facts-grid">
              <div className="fact">
                <dt>Service</dt>
                <dd className="mono">{apiHealth.service ?? 'not reported'}</dd>
              </div>
              <div className="fact">
                <dt>Repository</dt>
                <dd className="mono">{apiHealth.repository ?? 'not reported'}</dd>
              </div>
              <div className="fact">
                <dt>HTTP</dt>
                <dd className="mono">{apiHealth.httpStatus || '—'}</dd>
              </div>
              <div className="fact">
                <dt>Mode label</dt>
                <dd>{healthy ? 'LIVE TESTNET — TEST VALUE ONLY' : 'REPLAY / SIMULATION'}</dd>
              </div>
            </dl>
          ) : null}

          <div className="demo-note" role="note">
            <Lock size={16} aria-hidden="true" /> The web UI exposes no live scenario runner. This deployment is
            expected to run with <code>MEND_LIVE_SCENARIO_ENABLED=false</code>; the same-origin proxy also refuses the
            runner endpoint unless it is explicitly enabled. There is no &ldquo;run scenario&rdquo; button, no wallet
            creation and no transaction from this page. Switching to LIVE TESTNET only enables this read-only status
            view.
          </div>

          {healthy ? (
            <Callout tone="positive" title="API verified in LIVE_TESTNET mode" icon={<Check size={18} />}>
              <p>
                Only the health response above is live API data. No transaction has been executed. Public case pages
                must still label their own data source; when a live read is unavailable they fall back to frozen
                fixtures instead of presenting replay values as live.
              </p>
              {apiHealth.roleAccounts ? (
                <p className="small muted">
                  Demo role accounts are configured server-side. Use <Link href="/demo">/demo</Link> to store a
                  testnet-only role for same-origin reads.
                </p>
              ) : null}
              <p style={{ marginTop: 10 }}>
                <Link className="text-link" href="/cases/WO-BENCH-V2-001-0002" data-testid="live-case-link">
                  Open the seeded live testnet case <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </p>
            </Callout>
          ) : (
            <div className="wallet-error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>No verified live read state.</strong>
                <p>{apiHealth ? apiHealth.message : 'The API health check has not completed.'}</p>
                <p className="small">
                  The replay reference below is a recording. It is not a substitute for a live API response and gets
                  no explorer links.
                </p>
              </div>
            </div>
          )}
        </section>

        <ReplayPath />
      </div>

      {healthy ? (
        <DataSourceNote
          source="api"
          liveDetail="Only the health response is live API data. The timeline below is a frozen recording and is labelled separately."
        />
      ) : (
        <DataSourceNote
          source="fixture"
          detail="The API was not verified in LIVE_TESTNET mode. Frozen protocol fixtures are shown; no live transaction or attestation is claimed."
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
          <p className="eyebrow">Recorded reference · no live transaction</p>
          <h2 id="replay-path-title">The recorded repair, clearly labelled</h2>
          <p>
            This is the frozen canonical repair from <code>{FIXTURE_VERSION}</code>. It is a recording — not a testnet
            execution — and receives no explorer links.
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
          <Clock size={15} aria-hidden="true" /> The live console verifies API health only. It does not replay
          fixtures into a live claim and never converts recorded hashes into explorer links.
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
