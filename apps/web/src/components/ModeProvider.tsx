'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { checkApiHealth, type ApiHealth } from '@/lib/api';
import { MODE_META, safeMode } from '@/lib/modes';
import type { Mode } from '@/lib/types';

interface ModeContextValue {
  mode: Mode;
  apiConfigured: boolean;
  apiHealth: ApiHealth | null;
  refreshApiHealth: () => Promise<ApiHealth>;
  setMode: (mode: Mode) => Promise<boolean>;
  notice: string;
  dismissNotice: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);
const MODE_STORAGE_KEY = 'mend-mode';

function readStoredMode(): string | null {
  try {
    return window.sessionStorage.getItem(MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredMode(mode: Mode): void {
  try {
    window.sessionStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}

export function ModeProvider({
  children,
  initialMode = 'REPLAY',
  apiConfigured = false,
}: {
  children: ReactNode;
  /**
   * Server-rendered hint only. It is intentionally not trusted: a build can
   * have MEND_API_BASE_URL while the API reports REPLAY or is unreachable.
   * The `/health` response decides whether LIVE_TESTNET is selectable.
   */
  initialMode?: Mode;
  apiConfigured?: boolean;
}) {
  // Always start in REPLAY. The mount effect promotes to LIVE_TESTNET only
  // after the API answers with mode LIVE_TESTNET and a non-degraded status.
  const [mode, setModeState] = useState<Mode>('REPLAY');
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [notice, setNotice] = useState('');
  const modeRef = useRef<Mode>('REPLAY');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyMode = useCallback((nextMode: Mode) => {
    modeRef.current = nextMode;
    setModeState(nextMode);
  }, []);

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 7_000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedMode = readStoredMode();

    void checkApiHealth().then((health) => {
      if (cancelled) return;
      setApiHealth(health);

      if (
        health.ok &&
        (storedMode === 'LIVE_TESTNET' || (storedMode !== 'REPLAY' && initialMode === 'LIVE_TESTNET'))
      ) {
        applyMode('LIVE_TESTNET');
        writeStoredMode('LIVE_TESTNET');
        return;
      }

      applyMode('REPLAY');
      if (storedMode === 'LIVE_TESTNET') {
        announce(`${health.message} Returned to REPLAY / SIMULATION.`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [announce, applyMode]);

  const refreshApiHealth = useCallback(async () => {
    const health = await checkApiHealth();
    setApiHealth(health);

    if (!health.ok && modeRef.current === 'LIVE_TESTNET') {
      applyMode('REPLAY');
      writeStoredMode('REPLAY');
      announce(`${health.message} Returned to REPLAY / SIMULATION.`);
    }

    return health;
  }, [announce, applyMode]);

  const setMode = useCallback(
    async (nextMode: Mode) => {
      if (nextMode === 'MAINNET') {
        announce(
          'MAINNET is never selectable from this interface. A separate human review and explicit approval are required for every real-funds action.',
        );
        return false;
      }

      if (nextMode === 'LIVE_TESTNET') {
        const health = await checkApiHealth();
        setApiHealth(health);
        if (!health.ok) {
          applyMode('REPLAY');
          writeStoredMode('REPLAY');
          announce(`${health.message} Staying in REPLAY / SIMULATION.`);
          return false;
        }
        announce(
          'LIVE TESTNET selected. The console is read-only: no scenario runner is exposed and every displayed API value must still be a real testnet response.',
        );
      }

      if (nextMode === 'REPLAY') {
        announce('REPLAY / SIMULATION selected. Frozen fixtures are labelled throughout.');
      }

      applyMode(nextMode);
      writeStoredMode(nextMode);
      return true;
    },
    [announce, applyMode],
  );

  // The server-rendered flag may be stale if an operator sets the API URL at
  // runtime. A health response with a known mode proves the API is configured.
  const resolvedApiConfigured =
    apiConfigured || (apiHealth !== null && apiHealth.mode !== 'UNKNOWN');

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      apiConfigured: resolvedApiConfigured,
      apiHealth,
      refreshApiHealth,
      setMode,
      notice,
      dismissNotice: () => setNotice(''),
    }),
    [mode, resolvedApiConfigured, apiHealth, refreshApiHealth, setMode, notice],
  );

  return (
    <ModeContext.Provider value={value}>
      {children}
      <div className="mode-toast" role="status" aria-live="polite" hidden={!notice}>
        {notice ? (
          <>
            <span>{notice}</span>
            <button type="button" className="mode-toast__close" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </>
        ) : null}
      </div>
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode must be used inside ModeProvider');
  return context;
}

export function ModeBadge({ mode }: { mode: Mode }) {
  const meta = MODE_META[safeMode(mode)];
  return <span className={`mode-badge mode-badge--${meta.tone}`}>{meta.label}</span>;
}
