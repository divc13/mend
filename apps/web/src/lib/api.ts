import type { Report } from './types';

/**
 * Same-origin API client. Browser code never receives an API key or a private
 * evidence URL. `/api/mend/*` proxies to the server-side MEND_API_BASE_URL.
 *
 * TESTNET DEMO AUTH: the selector in `/demo` stores a demo role and account in
 * sessionStorage. `apiFetch` forwards them as `x-mend-role` / `x-mend-account`
 * only to same-origin `/api/mend/*` proxy calls. These headers are demo
 * authorization, not a wallet signature or a production auth mechanism.
 */

export const DEMO_ROLES = [
  'REPORTER',
  'STEWARD',
  'SPONSOR',
  'CONTRACTOR',
  'INSPECTOR',
  'DAO',
  'COORDINATOR_AI',
  'REVIEWER_AI',
  'RELAYER',
  'ADMIN',
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export interface DemoIdentity {
  role: DemoRole;
  account: string;
}

export const DEMO_ROLE_STORAGE_KEY = 'mend-demo-role';
export const DEMO_ACCOUNT_STORAGE_KEY = 'mend-demo-account';

const NEAR_ACCOUNT_PATTERN = /^(([a-z\d]+[-_])*[a-z\d]+)(\.([a-z\d]+[-_])*[a-z\d]+)*$/;

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === 'string' && (DEMO_ROLES as readonly string[]).includes(value);
}

/** Demo accounts are testnet-only; a mainnet-looking account is rejected. */
export function isDemoAccount(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 2 &&
    value.length <= 64 &&
    value.endsWith('.testnet') &&
    NEAR_ACCOUNT_PATTERN.test(value)
  );
}

export function readDemoIdentity(): DemoIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const role = window.sessionStorage.getItem(DEMO_ROLE_STORAGE_KEY);
    const account = window.sessionStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);
    if (isDemoRole(role) && isDemoAccount(account)) return { role, account };
  } catch {
    // Session storage can be unavailable in locked-down browsers.
  }
  return null;
}

export function storeDemoIdentity(identity: DemoIdentity): boolean {
  if (typeof window === 'undefined') return false;
  if (!isDemoRole(identity.role) || !isDemoAccount(identity.account)) return false;
  try {
    window.sessionStorage.setItem(DEMO_ROLE_STORAGE_KEY, identity.role);
    window.sessionStorage.setItem(DEMO_ACCOUNT_STORAGE_KEY, identity.account);
    return true;
  } catch {
    return false;
  }
}

export function clearDemoIdentity(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.sessionStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
    window.sessionStorage.removeItem(DEMO_ACCOUNT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Only these two demo headers cross the proxy. No cookies or bearer tokens. */
function demoIdentityHeaders(): Record<string, string> {
  const identity = readDemoIdentity();
  if (!identity) return {};
  return {
    'x-mend-role': identity.role,
    'x-mend-account': identity.account,
  };
}

export interface ApiFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  replayFallback: true;
  /** Present on 429 responses when the upstream sends Retry-After. */
  retryAfterSeconds?: number;
}

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
  source: 'api';
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

function failure(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds?: number,
): ApiFailure {
  return { ok: false, status, code, message, replayFallback: true, retryAfterSeconds };
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (typeof window === 'undefined') {
    return failure(0, 'BROWSER_ONLY', 'API calls run only in the browser.');
  }

  // apiFetch is deliberately proxy-only. Absolute URLs and protocol-relative
  // paths are rejected so demo headers can never leak to a third-party origin.
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) {
    return failure(0, 'PROXY_ONLY', 'API calls must use a same-origin /api/mend path.');
  }

  const proxyUrl = new URL(`/api/mend${path.startsWith('/') ? path : `/${path}`}`, window.location.origin);
  const sameOriginProxy =
    proxyUrl.origin === window.location.origin && proxyUrl.pathname.startsWith('/api/mend/');

  if (!sameOriginProxy) {
    return failure(0, 'PROXY_ONLY', 'API calls must use a same-origin /api/mend path.');
  }

  try {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    // A caller cannot smuggle its own demo identity. Only the validated
    // sessionStorage identity is attached, and only to this same-origin proxy.
    headers.delete('x-mend-role');
    headers.delete('x-mend-account');
    for (const [name, value] of Object.entries(demoIdentityHeaders())) headers.set(name, value);

    const response = await fetch(proxyUrl.toString(), {
      ...init,
      cache: 'no-store',
      headers,
      signal: init.signal ?? AbortSignal.timeout(8_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string } })
      | null;

    if (!response.ok) {
      return failure(
        response.status,
        payload?.error?.code ?? `HTTP_${response.status}`,
        payload?.error?.message ?? 'The API did not return a usable response.',
        parseRetryAfter(response),
      );
    }

    return { ok: true, status: response.status, data: payload as T, source: 'api' };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The API did not respond in time. Falling back to the frozen replay fixtures.'
        : 'The API is unreachable. Falling back to the frozen replay fixtures.';
    return failure(0, 'API_UNREACHABLE', message);
  }
}

export type ApiHealthMode = 'LIVE_TESTNET' | 'MAINNET' | 'REPLAY' | 'UNKNOWN';

export interface ApiHealth {
  /** True only when the API answers and its own mode is LIVE_TESTNET. */
  ok: boolean;
  httpStatus: number;
  mode: ApiHealthMode;
  status?: string;
  service?: string;
  database?: string;
  repository?: string;
  liveScenarioEnabled: boolean;
  roleAccounts?: Record<string, string>;
  testnet?: {
    walletEnabled: boolean;
    faucetEnabled: boolean;
  };
  checkedAt: string;
  message: string;
}

interface HealthPayload {
  status?: string;
  service?: string;
  mode?: string;
  repository?: string;
  database?: string;
  testnet?: {
    liveScenarioEnabled?: boolean;
    walletEnabled?: boolean;
    faucetEnabled?: boolean;
    roleAccounts?: Record<string, string>;
  };
}

function healthMode(value: unknown): ApiHealthMode {
  return value === 'LIVE_TESTNET' || value === 'MAINNET' || value === 'REPLAY' ? value : 'UNKNOWN';
}

/**
 * Health is the only source of truth for LIVE_TESTNET selection. An HTTP 200
 * response that reports REPLAY, MAINNET or a degraded status is not enough to
 * label the web app live.
 */
export async function checkApiHealth(): Promise<ApiHealth> {
  const checkedAt = new Date().toISOString();
  const result = await apiFetch<HealthPayload>('/health');

  if (!result.ok) {
    return {
      ok: false,
      httpStatus: result.status,
      mode: 'UNKNOWN',
      liveScenarioEnabled: false,
      checkedAt,
      message: result.message,
    };
  }

  const payload = result.data ?? {};
  const mode = healthMode(payload.mode);
  const apiHealthy = payload.status !== 'degraded';
  const ok = mode === 'LIVE_TESTNET' && apiHealthy;

  const message = ok
    ? 'The MEND API is reachable and reports LIVE_TESTNET mode.'
    : mode === 'LIVE_TESTNET'
      ? 'The MEND API reports LIVE_TESTNET mode but its health is degraded, so the web app stays in REPLAY / SIMULATION.'
      : mode === 'UNKNOWN'
        ? 'The MEND API responded without a recognised mode, so the web app stays in REPLAY / SIMULATION.'
        : `The MEND API is reachable but reports ${mode} mode, so the web app stays in REPLAY / SIMULATION.`;

  return {
    ok,
    httpStatus: result.status,
    mode,
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.service ? { service: payload.service } : {}),
    ...(payload.database ? { database: payload.database } : {}),
    ...(payload.repository ? { repository: payload.repository } : {}),
    liveScenarioEnabled: payload.testnet?.liveScenarioEnabled === true,
    ...(payload.testnet?.roleAccounts ? { roleAccounts: payload.testnet.roleAccounts } : {}),
    ...(payload.testnet
      ? {
          testnet: {
            walletEnabled: payload.testnet.walletEnabled === true,
            faucetEnabled: payload.testnet.faucetEnabled === true,
          },
        }
      : {}),
    checkedAt,
    message,
  };
}

/**
 * Read endpoints used by the live console integration. The public replay pages
 * render frozen fixture bundles; when a live API is available these calls can
 * replace individual records without changing the presentation layer.
 */
export const apiEndpoints = {
  assets: '/v1/assets',
  reports: '/v1/reports',
  workOrders: '/v1/work-orders',
  workOrder: (id: string) => `/v1/work-orders/${encodeURIComponent(id)}`,
  bids: (id: string) => `/v1/work-orders/${encodeURIComponent(id)}/bids`,
  score: (id: string) => `/v1/work-orders/${encodeURIComponent(id)}/score`,
  evidence: (id: string) => `/v1/work-orders/${encodeURIComponent(id)}/evidence`,
  payments: (id: string) => `/v1/work-orders/${encodeURIComponent(id)}/payments`,
  intentQuote: '/v1/intents/quote',
  intentStatus: (quoteId: string) => `/v1/intents/status/${encodeURIComponent(quoteId)}`,
  verification: (subjectHash: string) => `/v1/verification/${encodeURIComponent(subjectHash)}`,
};

export function getWorkOrder(id: string) {
  return apiFetch<Record<string, unknown>>(apiEndpoints.workOrder(id));
}

export function getWorkOrderBids(id: string) {
  return apiFetch<{ commitments?: unknown[]; reveals?: unknown[] }>(apiEndpoints.bids(id));
}

export function getWorkOrderScore(id: string) {
  return apiFetch<Record<string, unknown>>(apiEndpoints.score(id));
}

/**
 * Testnet-only operations. These are never called while REPLAY is selected and
 * they never touch MAINNET. The raw payload is normalised in `lib/testnet.ts`.
 *
 * The live scenario runner is intentionally absent from this client. The web
 * app exposes no "run scenario" control; `MEND_LIVE_SCENARIO_ENABLED=false`
 * keeps the API's live lifecycle disabled too.
 */
export function createTestnetWallet() {
  return apiFetch<unknown>('/v1/testnet/wallet', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getTestnetWallet(accountId: string) {
  return apiFetch<unknown>(`/v1/testnet/wallet/${encodeURIComponent(accountId)}`);
}

export function requestTestnetFaucet(accountId: string) {
  return apiFetch<unknown>('/v1/testnet/faucet', {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
}

export interface ReportSubmission {
  description: string;
  publicLocation: Report['publicLocation'];
  assetId?: string;
  redactedMediaHash?: string;
  exifStripped: true;
  category: string;
  duplicateChoice: 'same' | 'different' | 'unsure';
}

/**
 * Walletless report submission. In replay, or when the API is unavailable,
 * the caller creates a local replay receipt with a private case token.
 */
export async function submitReport(
  submission: ReportSubmission,
): Promise<ApiResult<{ id: string; reporterCaseLink: string }>> {
  return apiFetch<{ id: string; reporterCaseLink: string }>('/v1/reports', {
    method: 'POST',
    body: JSON.stringify({
      description: submission.description,
      publicLocation: submission.publicLocation,
      assetId: submission.assetId ?? 'UNASSIGNED',
      redactedMediaHash: submission.redactedMediaHash,
      exifStripped: submission.exifStripped,
      status: 'SUBMITTED',
      reporterCaseLink: 'generated-server-side',
      createdAt: new Date().toISOString(),
      category: submission.category,
      duplicateChoice: submission.duplicateChoice,
    }),
  });
}
