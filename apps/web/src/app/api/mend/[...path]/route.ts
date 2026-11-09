import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

function unavailable() {
  return NextResponse.json(
    {
      error: {
        code: 'API_UNCONFIGURED',
        message:
          'MEND_API_BASE_URL is not configured. The web app is using frozen replay fixtures; no request left this server.',
      },
      replay: true,
    },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

async function forward(request: Request, path: string[]) {
  const base = process.env.MEND_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return unavailable();

  if (
    path.length === 0 ||
    path.some((segment) => segment === '..' || segment === '.' || segment === '') ||
    (path[0] !== 'v1' && !(path.length === 1 && path[0] === 'health'))
  ) {
    return NextResponse.json(
      { error: { code: 'PROXY_PATH_DENIED', message: 'Only documented MEND API paths are proxied.' } },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  const safePath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const incoming = new URL(request.url);
  const target = new URL(`${base}/${safePath}`);
  target.search = incoming.search;

  if (request.method === 'POST') {
    const length = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the web proxy limit.' } },
        { status: 413 },
      );
    }
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  if (request.headers.get('content-type')) headers['content-type'] = request.headers.get('content-type')!;

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
        'x-mend-source': 'api',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'API_UNREACHABLE',
          message: 'The MEND API is unreachable. Fall back to the frozen replay fixtures and label the source.',
        },
        replay: true,
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
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
