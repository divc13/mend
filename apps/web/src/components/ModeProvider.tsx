'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { checkApiHealth } from '@/lib/api';
import { MODE_META, isMode, safeMode } from '@/lib/modes';
import type { Mode } from '@/lib/types';

interface ModeContextValue {
  mode: Mode;
  apiConfigured: boolean;
  setMode: (mode: Mode) => Promise<boolean>;
  notice: string;
  dismissNotice: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({
  children,
  initialMode = 'REPLAY',
  apiConfigured = false,
}: {
  children: ReactNode;
  initialMode?: Mode;
  apiConfigured?: boolean;
}) {
  const [mode, setModeState] = useState<Mode>(initialMode === 'MAINNET' ? 'REPLAY' : initialMode);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let storedMode: string | null = null;
    try {
      storedMode = window.sessionStorage.getItem('mend-mode');
    } catch {
      storedMode = null;
    }

    fetch('/api/config', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (config: { mode?: string; apiConfigured?: boolean } | null) => {
        if (cancelled || !config) return;
        const detected = config.mode;
        if (
          config.apiConfigured &&
          isMode(detected) &&
          detected === 'LIVE_TESTNET' &&
          storedMode !== 'REPLAY'
        ) {
          const health = await checkApiHealth();
          if (!cancelled && health.ok) setModeState('LIVE_TESTNET');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('mend-mode');
      if (isMode(stored) && stored !== 'MAINNET') setModeState(stored);
    } catch {
      // Session storage may be unavailable in locked-down browsers.
    }
  }, []);

  const setMode = useCallback(
    async (nextMode: Mode) => {
      if (nextMode === 'MAINNET') {
        announce(
          'MAINNET is never selectable from this interface. A separate human review and explicit approval are required for every real-funds action.',
        );
        return false;
      }

      if (nextMode === 'LIVE_TESTNET') {
        if (!apiConfigured) {
          announce(
            'No MEND_API_BASE_URL is configured for this build. Staying in REPLAY / SIMULATION with frozen fixtures.',
          );
          return false;
        }
        const health = await checkApiHealth();
        if (!health.ok) {
          announce(`${health.message} Staying in REPLAY / SIMULATION.`);
          return false;
        }
        announce('LIVE TESTNET selected. Every action still requires a real testnet transaction hash before it is shown as executed.');
      }

      if (nextMode === 'REPLAY') {
        announce('REPLAY / SIMULATION selected. Frozen fixtures are labelled throughout.');
      }

      setModeState(nextMode);
      try {
        window.sessionStorage.setItem('mend-mode', nextMode);
      } catch {
        // Ignore storage failures.
      }
      return true;
    },
    [announce, apiConfigured],
  );

  const value = useMemo<ModeContextValue>(
    () => ({ mode, apiConfigured, setMode, notice, dismissNotice: () => setNotice('') }),
    [mode, apiConfigured, setMode, notice],
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
