'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { DataSourceNote } from '@/components/DataSourceNote';
import { TxHashRow } from '@/components/TxHashRow';
import { useMode } from '@/components/ModeProvider';
import { Badge, Callout, PageHero } from '@/components/ui';
import {
  createTestnetWallet,
  getTestnetWallet,
  requestTestnetFaucet,
  type ApiFailure,
} from '@/lib/api';
import {
  TESTNET_FAUCET_MICRO,
  TESTNET_HUB_ACCOUNT,
  TESTNET_TOKEN_ACCOUNT,
  TESTNET_NETWORK,
  buildWalletKeyFile,
  explorerAccountUrl,
  formatBytes,
  microAmountLabel,
  nearAmountLabel,
  normalizeFaucet,
  normalizeWallet,
  storagePercent,
  walletKeyFilename,
  type FaucetReceiptView,
  type TestnetWalletView,
} from '@/lib/testnet';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  ExternalLink,
  Info,
  Lock,
  Refresh,
  ShieldCheck,
  Wallet,
} from '@/components/Icons';

const ACCOUNT_STORAGE_KEY = 'mend-wallet-account-id';

function readRememberedAccount(): string {
  try {
    return window.sessionStorage.getItem(ACCOUNT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberAccount(accountId: string) {
  // Only the public account ID is remembered for this tab. The secret key is
  // never written to session storage, local storage, cookies or IndexedDB.
  try {
    window.sessionStorage.setItem(ACCOUNT_STORAGE_KEY, accountId);
  } catch {
    // Storage can be unavailable in locked-down browsers; the wallet still works.
  }
}

function friendlyError(error: ApiFailure, action: string): string {
  if (error.status === 429 || /RATE|LIMIT|COOLDOWN/i.test(error.code)) {
    const retry = error.retryAfterSeconds
      ? ` Try again in ${error.retryAfterSeconds} second${error.retryAfterSeconds === 1 ? '' : 's'}.`
      : ' Wait for the API cooldown before retrying.';
    return `${action} was rate-limited.${retry} Testnet faucets are shared infrastructure.`;
  }
  if (error.code === 'API_UNCONFIGURED') {
    return `${action} is unavailable because MEND_API_BASE_URL is not configured for this build. No request left this server.`;
  }
  if (error.code === 'API_UNREACHABLE') {
    return `${action} could not reach the testnet API. Nothing was signed and no transaction is claimed.`;
  }
  if (error.status === 404) {
    return `${action} could not find that testnet account. Check the account ID and try again.`;
  }
  return `${action} failed (${error.code}). ${error.message}`;
}

export function WalletConsole() {
  const { mode, apiConfigured, apiHealth, setMode } = useMode();
  const live = mode === 'LIVE_TESTNET';
  const walletEnabled = live && apiHealth?.testnet?.walletEnabled === true;
  const faucetEnabled = live && apiHealth?.testnet?.faucetEnabled === true;
  const [accountInput, setAccountInput] = useState('');
  const [wallet, setWallet] = useState<TestnetWalletView | null>(null);
  const [creating, setCreating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [fauceting, setFauceting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createError, setCreateError] = useState<ApiFailure | null>(null);
  const [lookupError, setLookupError] = useState<ApiFailure | null>(null);
  const [faucetError, setFaucetError] = useState<ApiFailure | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<FaucetReceiptView | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const secretPanelRef = useRef<HTMLHeadingElement>(null);
  const modeRef = useRef(mode);

  const secretVisible = Boolean(wallet?.secretKey);
  const busy = creating || lookingUp || fauceting || refreshing;

  useEffect(() => {
    setAccountInput(readRememberedAccount());
  }, []);

  // A secret may only be displayed while LIVE_TESTNET is selected. Leaving live
  // mode discards it from React state immediately.
  useEffect(() => {
    modeRef.current = mode;
    if (mode === 'LIVE_TESTNET') return;
    // Leaving LIVE TESTNET removes the one-time secret and every cached live
    // balance claim from the page. The public account ID remains in the input.
    setWallet(null);
    setDownloaded(false);
    setSavedConfirmed(false);
    setReceipt(null);
    setFaucetError(null);
    setCreateError(null);
    setLookupError(null);
    setBalanceError(null);
  }, [mode]);

  useEffect(() => {
    if (!secretVisible) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const shouldLeave = window.confirm(
        'The secret key is shown once and is not stored. Leaving this page discards it. Download the key JSON first. Leave anyway?',
      );
      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    document.addEventListener('click', confirmInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      document.removeEventListener('click', confirmInternalNavigation, true);
    };
  }, [secretVisible]);

  useEffect(() => {
    if (secretVisible) secretPanelRef.current?.focus();
  }, [secretVisible]);

  async function onCreate() {
    if (!live || busy) return;
    setCreating(true);
    setCreateError(null);
    setLookupError(null);
    setFaucetError(null);
    setReceipt(null);
    setBalanceError(null);
    setDownloaded(false);
    setSavedConfirmed(false);

    const result = await createTestnetWallet();
    setCreating(false);
    if (modeRef.current !== 'LIVE_TESTNET') {
      setCreateError({
        ok: false,
        status: 0,
        code: 'MODE_CHANGED',
        message:
          'LIVE TESTNET was deselected while the request was in flight. The response was discarded; no wallet is shown in REPLAY.',
        replayFallback: true,
      });
      return;
    }
    if (!result.ok) {
      setCreateError(result);
      return;
    }

    const next = normalizeWallet(result.data, { allowSecret: true });
    if (!next) {
      setCreateError({
        ok: false,
        status: 200,
        code: 'INVALID_RESPONSE',
        message: 'The API response did not include an account ID, so no wallet is shown.',
        replayFallback: true,
      });
      return;
    }

    setWallet(next);
    setAccountInput(next.accountId);
    rememberAccount(next.accountId);
    setLastUpdated(new Date().toISOString());
  }

  async function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountId = accountInput.trim();
    if (!live || busy) return;
    if (!accountId) {
      setLookupError({
        ok: false,
        status: 0,
        code: 'ACCOUNT_REQUIRED',
        message: 'Enter the testnet account ID returned when the wallet was created.',
        replayFallback: true,
      });
      return;
    }
    if (secretVisible) {
      setLookupError({
        ok: false,
        status: 0,
        code: 'SECRET_VISIBLE',
        message: 'Hide the one-time secret key panel before loading another wallet.',
        replayFallback: true,
      });
      return;
    }

    setLookingUp(true);
    setLookupError(null);
    setFaucetError(null);
    setBalanceError(null);
    setReceipt(null);
    const result = await getTestnetWallet(accountId);
    setLookingUp(false);
    if (modeRef.current !== 'LIVE_TESTNET') {
      setLookupError({
        ok: false,
        status: 0,
        code: 'MODE_CHANGED',
        message: 'LIVE TESTNET was deselected while the request was in flight. The response was discarded.',
        replayFallback: true,
      });
      return;
    }
    if (!result.ok) {
      setLookupError(result);
      return;
    }
    const next = normalizeWallet(result.data, { allowSecret: false });
    if (!next) {
      setLookupError({
        ok: false,
        status: 200,
        code: 'INVALID_RESPONSE',
        message: 'The API response did not include a testnet account ID.',
        replayFallback: true,
      });
      return;
    }
    setWallet(next);
    setAccountInput(next.accountId);
    rememberAccount(next.accountId);
    setLastUpdated(new Date().toISOString());
  }

  async function refreshBalance(): Promise<boolean> {
    const accountId = wallet?.accountId;
    if (!live || !accountId) return false;
    setRefreshing(true);
    setBalanceError(null);
    const result = await getTestnetWallet(accountId);
    setRefreshing(false);
    if (modeRef.current !== 'LIVE_TESTNET') return false;
    if (!result.ok) {
      setBalanceError(friendlyError(result, 'Balance refresh'));
      return false;
    }
    const next = normalizeWallet(result.data, { allowSecret: false });
    if (!next) {
      setBalanceError('The balance response did not include a testnet account ID.');
      return false;
    }
    setWallet((current) => ({
      ...(current ?? next),
      publicKey: next.publicKey ?? current?.publicKey,
      balance: next.balance,
      accountId: next.accountId,
    }));
    setLastUpdated(new Date().toISOString());
    return true;
  }

  async function onFaucet() {
    const accountId = wallet?.accountId;
    if (!live || !accountId || busy) return;
    setFauceting(true);
    setFaucetError(null);
    setBalanceError(null);
    setReceipt(null);

    const result = await requestTestnetFaucet(accountId);
    if (modeRef.current !== 'LIVE_TESTNET') {
      setFauceting(false);
      return;
    }
    if (!result.ok) {
      setFauceting(false);
      setFaucetError(result);
      return;
    }

    const nextReceipt = normalizeFaucet(result.data, accountId);
    setReceipt(nextReceipt);
    // A faucet call can succeed even if the follow-up read fails. Keep the
    // receipt visible and label the stale balance separately.
    await refreshBalance();
    setFauceting(false);
  }

  function downloadKey() {
    if (!wallet?.secretKey) return;
    const data = buildWalletKeyFile(wallet);
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = walletKeyFilename(wallet.accountId);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloaded(true);
  }

  function hideSecret() {
    setWallet((current) => (current ? { ...current, secretKey: undefined } : current));
    setDownloaded(false);
    setSavedConfirmed(false);
  }

  const storagePct = storagePercent(wallet?.balance.storageUsedBytes, wallet?.balance.storageLimitBytes);

  return (
    <div className="container">
      <PageHero
        eyebrow="Testnet wallet"
        title="A wallet built to be thrown away."
        lead="Create a NEAR testnet account, collect 100 test mUSDC from the MEND faucet and watch the balance update. This is test infrastructure: the keys, token and every transaction have no real value."
        aside={
          <div className="side-card wallet-status-card">
            <div className="wallet-status-card__top">
              <h2>LIVE TESTNET</h2>
              <Badge tone={live ? 'positive' : 'warning'}>{live ? 'Connected' : 'Not selected'}</Badge>
            </div>
            <p className="wallet-status-card__value">TEST VALUE ONLY</p>
            <p className="side-card__note">
              REPLAY remains the default. Wallet actions only call the API while LIVE TESTNET is selected and healthy.
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
                <dt>Network</dt>
                <dd className="mono">{TESTNET_NETWORK}</dd>
              </div>
            </dl>
          </div>
        }
      >
        <div className="wallet-test-banner" role="note">
          <span className="wallet-test-banner__dot" aria-hidden="true" />
          <strong>LIVE TESTNET — TEST VALUE ONLY</strong>
          <span>No mainnet. No real funds. No deploy.</span>
        </div>
      </PageHero>

      {!live ? (
        <Callout
          tone="warning"
          title="LIVE TESTNET is not selected"
          icon={<Lock size={18} />}
        >
          <p>
            The demo starts in REPLAY / SIMULATION. Wallet creation and the faucet are disabled until you explicitly
            select LIVE TESTNET and the configured API passes a health check.
          </p>
          <div className="wallet-actions wallet-actions--tight">
            <button
              type="button"
              className="button button--small"
              onClick={() => void setMode('LIVE_TESTNET')}
              disabled={!apiConfigured}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              Switch to LIVE TESTNET
            </button>
            <Link className="button button--small button--ghost" href="/demo">
              Open mode controls <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!apiConfigured ? (
            <p className="small muted">
              This build has no <code>MEND_API_BASE_URL</code>. The wallet API is unavailable; replay stays active and
              nothing is sent over the network.
            </p>
          ) : null}
        </Callout>
      ) : (
        <p className="wallet-live-note" role="status">
          <span className="wallet-live-note__dot" aria-hidden="true" />
          LIVE TESTNET selected. Every account and transaction below is testnet-only.
          {!walletEnabled || !faucetEnabled ? ' Wallet creation and the faucet are disabled on this deployment.' : ''}
        </p>
      )}

      <div className="wallet-grid">
        <div className="wallet-main">
          <section className="panel wallet-identity" aria-labelledby="wallet-identity-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Step 1 · account</p>
                <h2 id="wallet-identity-title">Create or load a testnet wallet</h2>
                <p>
                  The API creates a real <code>.testnet</code> account. The secret key is returned once, kept in this
                  tab&apos;s memory and never written to browser storage.
                </p>
              </div>
              <Badge tone="warning" icon={<Wallet size={14} aria-hidden="true" />}>
                Test value
              </Badge>
            </div>

            {secretVisible ? (
              <div className="secret-panel">
                <div className="secret-panel__head">
                  <div>
                    <p className="eyebrow">Secret key · shown once</p>
                    <h3 ref={secretPanelRef} tabIndex={-1}>
                      Save this key now. It cannot be recovered here.
                    </h3>
                  </div>
                  <Badge tone="danger" icon={<AlertTriangle size={14} aria-hidden="true" />}>
                    One-time reveal
                  </Badge>
                </div>

                <p className="secret-panel__warning">
                  Anyone with this key controls this testnet account. Do not paste it into chat, screenshots or issue
                  trackers. Never use it on mainnet. This panel closes when you leave the page.
                </p>

                <div className="secret-key">
                  <span className="secret-key__label">Account</span>
                  <code>{wallet?.accountId}</code>
                  <span className="secret-key__label">Secret key</span>
                  <code className="secret-key__value" aria-label="One-time secret key">
                    {wallet?.secretKey}
                  </code>
                  {wallet?.publicKey ? (
                    <>
                      <span className="secret-key__label">Public key</span>
                      <code>{wallet.publicKey}</code>
                    </>
                  ) : null}
                </div>

                <div className="wallet-actions">
                  <button type="button" className="button button--small" onClick={downloadKey}>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {downloaded ? 'Download JSON again' : 'Download key JSON'}
                  </button>
                </div>
                {downloaded ? (
                  <p className="secret-panel__saved" role="status">
                    <Check size={15} aria-hidden="true" /> JSON downloaded. Move it out of your Downloads folder and
                    keep it offline.
                  </p>
                ) : null}

                <label className="checkbox-row secret-panel__confirm">
                  <input
                    type="checkbox"
                    checked={savedConfirmed}
                    onChange={(event) => setSavedConfirmed(event.target.checked)}
                  />
                  <span>I saved the key outside the browser and understand it cannot be shown again.</span>
                </label>
                <button
                  type="button"
                  className="button button--small button--ghost"
                  onClick={hideSecret}
                  disabled={!savedConfirmed}
                >
                  <Lock size={15} aria-hidden="true" /> Hide secret from this tab
                </button>
              </div>
            ) : (
              <>
                <div className="wallet-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => void onCreate()}
                    disabled={!walletEnabled || busy}
                    aria-busy={creating}
                    data-testid="create-testnet-wallet"
                  >
                    {creating ? (
                      <>
                        <span className="spinner" aria-hidden="true" /> Creating testnet account…
                      </>
                    ) : (
                      <>
                        <Wallet size={17} aria-hidden="true" /> Create testnet wallet
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => void refreshBalance()}
                    disabled={!walletEnabled || !wallet || busy}
                    aria-busy={refreshing}
                  >
                    <Refresh size={15} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh balance'}
                  </button>
                </div>

                <form className="wallet-lookup" onSubmit={(event) => void onLookup(event)}>
                  <div className="field">
                    <label htmlFor="wallet-account-input">Testnet account ID</label>
                    <div className="wallet-lookup__row">
                      <input
                        id="wallet-account-input"
                        className="input"
                        value={accountInput}
                        onChange={(event) => setAccountInput(event.target.value)}
                        placeholder="mend-wallet-xxxx.testnet"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={!walletEnabled || busy || secretVisible}
                      />
                      <button
                        type="submit"
                        className="button button--small button--ghost"
                        disabled={!walletEnabled || busy || secretVisible}
                        aria-busy={lookingUp}
                      >
                        {lookingUp ? 'Looking up…' : 'Load wallet'}
                      </button>
                    </div>
                    <p className="field__hint">
                      Public account ID only. This tab remembers the ID in <code>sessionStorage</code>; the secret key is
                      never stored.
                    </p>
                  </div>
                </form>

                {createError ? (
                  <div className="wallet-error" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div>
                      <strong>Could not create a testnet wallet.</strong>
                      <p>{friendlyError(createError, 'Wallet creation')}</p>
                    </div>
                  </div>
                ) : null}
                {lookupError ? (
                  <div className="wallet-error" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <div>
                      <strong>Could not load that wallet.</strong>
                      <p>
                        {lookupError.code === 'ACCOUNT_REQUIRED' || lookupError.code === 'SECRET_VISIBLE'
                          ? lookupError.message
                          : friendlyError(lookupError, 'Wallet lookup')}
                      </p>
                    </div>
                  </div>
                ) : null}

                {!wallet ? (
                  <div className="wallet-empty">
                    <span className="wallet-empty__icon" aria-hidden="true">
                      <Wallet size={26} />
                    </span>
                    <h3>No wallet in this tab</h3>
                    <p>
                      Create a fresh testnet account, or load an existing account ID to read its mUSDC balance and
                      storage. Replay never creates a wallet.
                    </p>
                    <p className="wallet-empty__hint">
                      Tip: keep the downloaded JSON key out of the repository and out of shared drives.
                    </p>
                  </div>
                ) : (
                  <div className="wallet-loaded">
                    <div className="wallet-address">
                      <div>
                        <p className="eyebrow">Account ID</p>
                        <code>{wallet.accountId}</code>
                      </div>
                      <CopyButton value={wallet.accountId} label="Copy account ID" />
                    </div>
                    {wallet.publicKey ? (
                      <div className="wallet-address">
                        <div>
                          <p className="eyebrow">Public key</p>
                          <code>{wallet.publicKey}</code>
                        </div>
                        <CopyButton value={wallet.publicKey} label="Copy public key" />
                      </div>
                    ) : (
                      <p className="small muted">The API did not report a public key for this account.</p>
                    )}
                    <div className="wallet-metadata">
                      <span>
                        <Badge tone="positive" icon={<Check size={13} aria-hidden="true" />}>
                          Testnet account
                        </Badge>
                      </span>
                      <a
                        className="tx-link"
                        href={explorerAccountUrl(wallet.accountId)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View account on testnet explorer <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        className="button button--small button--ghost"
                        onClick={() => void refreshBalance()}
                        disabled={!walletEnabled || busy}
                      >
                        <Refresh size={14} aria-hidden="true" /> Refresh
                      </button>
                      <Link className="text-link" href="/live">
                        Open live control <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                    {balanceError ? (
                      <p className="wallet-inline-error" role="alert">
                        <AlertTriangle size={15} aria-hidden="true" /> {balanceError}
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="panel wallet-faucet" aria-labelledby="wallet-faucet-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Step 2 · test funds</p>
                <h2 id="wallet-faucet-title">Get 100 test mUSDC</h2>
                <p>
                  The faucet sends a fixed test amount to the loaded account. A transaction hash is shown only when the
                  API returns one; the explorer link is built for testnet only.
                </p>
              </div>
              <Badge tone="neutral" icon={<Coins size={14} aria-hidden="true" />}>
                100 mUSDC
              </Badge>
            </div>

            <div className="wallet-faucet__action">
              <button
                type="button"
                className="button"
                onClick={() => void onFaucet()}
                disabled={!faucetEnabled || !wallet || busy || secretVisible}
                aria-busy={fauceting}
                data-testid="request-testnet-faucet"
              >
                {fauceting ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Requesting test mUSDC…
                  </>
                ) : (
                  <>
                    <Coins size={17} aria-hidden="true" /> Get {microAmountLabel(TESTNET_FAUCET_MICRO)}
                  </>
                )}
              </button>
              <p className="small muted">
                One request per wallet within the API cooldown. Test tokens cannot be swapped, sold or withdrawn.
              </p>
            </div>

            {!wallet ? (
              <p className="wallet-empty-line" role="status">
                Create or load a wallet first, then request test mUSDC.
              </p>
            ) : null}

            {faucetError ? (
              <div className="wallet-error" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>Faucet request was not confirmed.</strong>
                  <p>{friendlyError(faucetError, 'Faucet request')}</p>
                  <p className="small">
                    Nothing is shown as funded unless the API returns a real testnet transaction hash.
                  </p>
                </div>
              </div>
            ) : null}

            {receipt ? (
              <div
                className={`faucet-receipt faucet-receipt--${receipt.status.toLowerCase()}`}
                role="status"
                aria-live="polite"
              >
                <div className="faucet-receipt__head">
                  <Badge
                    tone={receipt.status === 'SUCCESS' ? 'positive' : receipt.status === 'FAILED' ? 'danger' : 'warning'}
                    icon={<Coins size={13} aria-hidden="true" />}
                  >
                    {receipt.status === 'SUCCESS'
                      ? 'Faucet transaction reported'
                      : receipt.status === 'FAILED'
                        ? 'Faucet transaction failed'
                        : 'No transaction hash reported'}
                  </Badge>
                  <span className="small muted">
                    {microAmountLabel(receipt.amountMicro)} requested
                  </span>
                </div>
                {receipt.txHash ? (
                  <TxHashRow hash={receipt.txHash} label="Faucet transaction" />
                ) : (
                  <p className="wallet-inline-warning">
                    <AlertTriangle size={15} aria-hidden="true" /> The API did not return a transaction hash. This
                    request is not presented as confirmed and no explorer link is shown.
                  </p>
                )}
                {receipt.message ? <p className="small muted">{receipt.message}</p> : null}
              </div>
            ) : null}

            <Callout tone="warning" title="Rate-limit guidance" icon={<Info size={18} />}>
              <p>
                The testnet faucet is shared infrastructure. If the API returns <code>429</code>, wait for the cooldown
                shown above before retrying. Do not open parallel requests. Test value only — no refunds, no value, no
                mainnet path.
              </p>
            </Callout>
          </section>
        </div>

        <aside className="wallet-aside" aria-label="Balance and storage">
          <section className="panel wallet-balance-panel" aria-labelledby="wallet-balance-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Balance & storage</p>
                <h2 id="wallet-balance-title">What the account holds</h2>
              </div>
              <Badge tone={wallet ? 'positive' : 'neutral'}>{wallet ? 'Reported' : 'No wallet'}</Badge>
            </div>

            <div className="wallet-balance-grid">
              <div className="wallet-balance-card">
                <p className="wallet-balance-card__label">Test mUSDC</p>
                <p className="wallet-balance-card__value">{microAmountLabel(wallet?.balance.tokenMicro)}</p>
                <p className="wallet-balance-card__note">Repair token · test value only</p>
              </div>
              <div className="wallet-balance-card">
                <p className="wallet-balance-card__label">NEAR for gas</p>
                <p className="wallet-balance-card__value">{nearAmountLabel(wallet?.balance.nearYocto)}</p>
                <p className="wallet-balance-card__note">Pays storage and transaction fees</p>
              </div>
            </div>

            <div className="wallet-storage">
              <div className="wallet-storage__head">
                <span>Storage used</span>
                <span className="mono">
                  {formatBytes(wallet?.balance.storageUsedBytes)} / {formatBytes(wallet?.balance.storageLimitBytes)}
                </span>
              </div>
              {storagePct === null ? (
                <p className="small muted">Storage usage was not reported by this API response.</p>
              ) : (
                <>
                  <div
                    className="storage-bar"
                    role="progressbar"
                    aria-label="Testnet storage used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={storagePct}
                  >
                    <span
                      className={`storage-bar__fill${storagePct >= 85 ? ' storage-bar__fill--warning' : ''}`}
                      style={{ width: `${storagePct}%` }}
                    />
                  </div>
                  <p className="small muted">
                    {storagePct}% used
                    {wallet?.balance.storageAvailableBytes !== undefined
                      ? ` · ${formatBytes(wallet.balance.storageAvailableBytes)} available`
                      : ''}
                  </p>
                </>
              )}
            </div>

            <div className="wallet-balance-panel__foot">
              <p className="small muted">
                {lastUpdated ? `Last read ${new Date(lastUpdated).toLocaleTimeString('en-GB')} local time.` : 'No balance read yet.'}
              </p>
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={() => void refreshBalance()}
                disabled={!walletEnabled || !wallet || busy}
                aria-busy={refreshing}
              >
                <Refresh size={14} aria-hidden="true" /> Refresh
              </button>
            </div>
          </section>

          <section className="panel wallet-rails" aria-labelledby="wallet-rails-title">
            <p className="eyebrow">Safety rails</p>
            <h2 id="wallet-rails-title">No mainnet path</h2>
            <ul className="wallet-rails__list">
              <li>
                <ShieldCheck size={15} aria-hidden="true" /> Testnet account only: <code>.testnet</code>.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> Secret key never enters local storage, cookies or the URL.
              </li>
              <li>
                <Coins size={15} aria-hidden="true" /> 100 mUSDC per faucet request, subject to API rate limits.
              </li>
              <li>
                <AlertTriangle size={15} aria-hidden="true" /> MAINNET is never selectable from this interface.
              </li>
            </ul>
            <Link className="text-link" href="/trust">
              Read the privacy and safety model <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </section>

          <p className="source-note source-note--replay">
            <Info size={16} aria-hidden="true" />
            <span>
              Need a dry run? <Link href="/demo">Open the replay control room</Link>. Replay never calls the wallet API.
            </span>
          </p>
        </aside>
      </div>

      <DataSourceNote
        source={wallet && live ? 'api' : 'fixture'}
        detail={
          wallet && live
            ? 'Wallet, faucet and balance values come from the configured testnet API. Only real testnet transaction hashes receive explorer links.'
            : undefined
        }
      />
    </div>
  );
}
