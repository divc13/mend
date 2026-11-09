import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiConfigured = Boolean(process.env.MEND_API_BASE_URL);
  const requested = process.env.MEND_MODE;

  // MAINNET is never a selectable UI mode. Even if misconfigured, report REPLAY.
  const mode =
    apiConfigured && requested === 'LIVE_TESTNET'
      ? 'LIVE_TESTNET'
      : 'REPLAY';

  return NextResponse.json(
    {
      mode,
      apiConfigured,
      mainnetEnabled: false,
      fixtureVersion: 'protocol-v1 / fixtures-2026-11-10',
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
