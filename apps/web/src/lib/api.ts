import type { Report } from './types';

/**
 * Same-origin API client. Browser code never receives an API key or a private
 * evidence URL. `/api/mend/*` proxies to the server-side MEND_API_BASE_URL.
 */

export interface ApiFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  replayFallback: true;
}

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
  source: 'api';
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

function failure(status: number, code: string, message: string): ApiFailure {
  return { ok: false, status, code, message, replayFallback: true };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (typeof window === 'undefined') {
    return failure(0, 'BROWSER_ONLY', 'API calls run only in the browser.');
  }

  try {
    const response = await fetch(`/api/mend${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(8_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string } })
      | null;

    if (!response.ok) {
      return failure(
        response.status,
        payload?.error?.code ?? `HTTP_${response.status}`,
        payload?.error?.message ?? 'The API did not return a usable response.',
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

export async function checkApiHealth(): Promise<{ ok: boolean; message: string }> {
  const result = await apiFetch<{ status?: string }>('/health');
  if (result.ok) return { ok: true, message: 'Testnet API reachable.' };
  return { ok: false, message: result.message };
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
