import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;
const LIVE_SCENARIO_PATH = 'v1/live/run-scenario';

// Mirrors packages/protocol ROLES. Kept local because the web workspace does
// not depend on the protocol package.
const DEMO_ROLES = new Set([
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
]);

const NEAR_ACCOUNT_PATTERN = /^(([a-z\d]+[-_])*[a-z\d]+)(\.([a-z\d]+[-_])*[a-z\d]+)*$/;

/**
 * The proxy is same-origin only. It deliberately sets no
 * Access-Control-Allow-Origin header: a wildcard would let any site use this
 * deployment as an open API and as a demo-role relay.
 */
function errorResponse(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: { code, message }, ...extra },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

function unavailable() {
  return errorResponse(
    503,
    'API_UNCONFIGURED',
    'MEND_API_BASE_URL is not configured. The web app is using frozen replay fixtures; no request left this server.',
    { replay: true },
  );
}

/**
 * TESTNET DEMO AUTHORIZATION ONLY.
 *
 * The browser may forward `x-mend-role` and `x-mend-account`, but only after
 * both values pass this validation. The API treats these headers as spoofable
 * demo auth. No cookie, Authorization header or arbitrary client header is
 * forwarded, so this proxy cannot become a credential forwarder.
 */
function readDemoHeaders(request: Request): { headers: Record<string, string> } | { response: NextResponse } {
  const rawRole = request.headers.get('x-mend-role')?.trim();
  const rawAccount = request.headers.get('x-mend-account')?.trim();
  if (!rawRole && !rawAccount) return { headers: {} };

  if (!rawRole || !rawAccount) {
    return {
      response: errorResponse(
        400,
        'DEMO_AUTH_INVALID',
        'Send both x-mend-role and x-mend-account, or neither. Demo auth is all-or-nothing.',
      ),
    };
  }

  const role = rawRole.toUpperCase();
  if (!DEMO_ROLES.has(role)) {
    return {
      response: errorResponse(400, 'DEMO_AUTH_INVALID', 'Unknown demo role. No demo headers were forwarded.'),
    };
  }

  if (!rawAccount.endsWith('.testnet') || !NEAR_ACCOUNT_PATTERN.test(rawAccount) || rawAccount.length > 64) {
    return {
      response: errorResponse(
        400,
        'DEMO_AUTH_INVALID',
        'Demo accounts must be valid NEAR testnet account IDs ending in .testnet. No demo headers were forwarded.',
      ),
    };
  }

  return { headers: { 'x-mend-role': role, 'x-mend-account': rawAccount } };
}

async function forward(request: Request, path: string[]) {
  const base = process.env.MEND_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return unavailable();

  if (
    path.length === 0 ||
    path.some((segment) => segment === '..' || segment === '.' || segment === '') ||
    (path[0] !== 'v1' && !(path.length === 1 && path[0] === 'health'))
  ) {
    return errorResponse(404, 'PROXY_PATH_DENIED', 'Only documented MEND API paths are proxied.');
  }

  const joinedPath = path.join('/');

  // Defence in depth: the web UI exposes no runner, and the proxy refuses to
  // start the live lifecycle unless the deployment explicitly enabled it.
  if (
    request.method === 'POST' &&
    joinedPath === LIVE_SCENARIO_PATH &&
    process.env.MEND_LIVE_SCENARIO_ENABLED?.trim().toLowerCase() !== 'true'
  ) {
    return errorResponse(
      403,
      'LIVE_SCENARIO_DISABLED',
      'The live scenario runner is disabled for this deployment (MEND_LIVE_SCENARIO_ENABLED is not true).',
    );
  }

  const demo = readDemoHeaders(request);
  if ('response' in demo) return demo.response;

  const safePath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const incoming = new URL(request.url);
  const target = new URL(`${base}/${safePath}`);
  target.search = incoming.search;

  let body: string | undefined;
  if (request.method === 'POST') {
    const length = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the web proxy limit.');
    }
    body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the web proxy limit.');
    }
  }

  const headers = new Headers({ accept: 'application/json' });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  for (const [name, value] of Object.entries(demo.headers)) headers.set(name, value);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });

    const text = await upstream.text();
    const responseHeaders = new Headers({
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      'x-mend-source': 'api',
    });

    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) responseHeaders.set('retry-after', retryAfter);

    const upstreamMode = upstream.headers.get('x-mend-mode');
    if (upstreamMode && ['LIVE_TESTNET', 'MAINNET', 'REPLAY'].includes(upstreamMode)) {
      responseHeaders.set('x-mend-mode', upstreamMode);
    }

    return new NextResponse(text, { status: upstream.status, headers: responseHeaders });
  } catch {
    return errorResponse(
      503,
      'API_UNREACHABLE',
      'The MEND API is unreachable. Fall back to the frozen replay fixtures and label the source.',
      { replay: true },
    );
  }
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, path);
}
