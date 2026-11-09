import { IntentsApiError, IntentsNetworkError, IntentsTimeoutError } from '../src/errors.js';
import { OneClickClient, ONE_CLICK_BASE_URL } from '../src/client.js';
import { buildQuoteView } from '../src/quote-view.js';
import { trackStatus } from '../src/status.js';

/**
 * Read-only live smoke test. It calls ONLY:
 *   GET /v0/tokens
 *   POST /v0/quote (dry:true)
 *   GET /v0/status
 *
 * It never creates a non-dry quote, never calls deposit/submit, never signs
 * and never spends funds. Skipped by default; run with `npm run smoke -- --dry`.
 */

const NEAR_USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const BASE_USDC = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';
const PUBLIC_SUCCESS_ADDRESS = '0x85B7Ba3fFDb04245CF61A380C9D2039d786760c5';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

function isNetworkUnavailable(error: unknown): boolean {
  if (error instanceof IntentsNetworkError || error instanceof IntentsTimeoutError) return true;
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? '')}`;
  return /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|fetch failed|network|abort/i.test(text);
}

async function main(): Promise<number> {
  const dry = process.argv.slice(2).includes('--dry');
  if (!dry) {
    console.log('SKIPPED: live smoke is off by default. Run `npm run smoke -- --dry` for read-only checks.');
    console.log('No network calls, no quote, no deposit, no signing.');
    return 0;
  }

  const recipient = argValue('recipient') ?? 'root.near';
  const refundTo = argValue('refund-to') ?? '0x1111111111111111111111111111111111111111';
  const statusAddress = argValue('status-address') ?? PUBLIC_SUCCESS_ADDRESS;
  const timeoutMs = Number.parseInt(argValue('timeout') ?? '15000', 10);

  console.log('MEND Intents smoke — READ-ONLY');
  console.log(`Base URL: ${ONE_CLICK_BASE_URL}`);
  console.log('MAINNET ONLY — real funds. Dry quote only. No signing. No transfer.');
  console.log('');

  const client = new OneClickClient({ timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15_000, userAgent: 'mend-intents-smoke/0.1' });

  try {
    const { tokens } = await client.getTokens();
    const base = tokens.find((token) => token.assetId === BASE_USDC);
    const near = tokens.find((token) => token.assetId === NEAR_USDC);
    console.log(`TOKENS: ${tokens.length} returned; Base USDC=${base ? 'found' : 'MISSING'}; NEAR USDC=${near ? 'found' : 'MISSING'}`);
    if (!base || !near) {
      console.error('FAILED: required canonical tokens were not present in /v0/tokens.');
      return 1;
    }

    const quote = await client.getDryQuote({
      originAsset: BASE_USDC,
      destinationAsset: NEAR_USDC,
      amount: '150000',
      recipient,
      refundTo,
      slippageTolerance: 100,
    });
    const view = buildQuoteView(quote, { tokens });
    console.log(`DRY QUOTE: ${view.source.formatted} ${view.source.symbol ?? view.source.assetId} -> ${view.destination.formatted} ${view.destination.symbol ?? view.destination.assetId}`);
    console.log(`  amountIn=${quote.response.quote.amountIn} amountOut=${quote.response.quote.amountOut} minAmountOut=${quote.response.quote.minAmountOut}`);
    console.log(`  refundFee=${quote.response.quote.refundFee ?? 'n/a'} withdrawFee=${quote.response.quote.withdrawFee ?? 'n/a'} timeEstimate=${quote.response.quote.timeEstimate ?? 'n/a'}s`);
    console.log(`  signatureVerified=${quote.verified} depositAddress=${quote.response.quote.depositAddress ?? 'NONE (dry)'}`);
    console.log(`  label="${view.label}" canBePresentedAsPayment=${view.canBePresentedAsPayment}`);
    if (quote.response.quote.depositAddress !== undefined) {
      console.error('FAILED: dry quote unexpectedly returned a deposit address.');
      return 1;
    }

    const status = await client.getStatus(statusAddress, { requireSignature: false });
    const tracked = trackStatus(status);
    console.log(`STATUS: address=${statusAddress}`);
    console.log(`  rawStatus=${tracked.rawStatus} known=${tracked.known} mendState=${tracked.state} flowState=${tracked.flowState} terminal=${tracked.terminal}`);
    console.log(`  signatureVerified=${status.verified} destinationTxHashes=${tracked.destinationTxHashes.length}`);
    console.log('');
    console.log('SMOKE OK — read-only checks completed. No funds moved. No transaction signed.');
    return 0;
  } catch (error) {
    if (isNetworkUnavailable(error)) {
      console.log('');
      console.log(`SKIPPED: live network unavailable — ${error instanceof Error ? error.message : String(error)}`);
      console.log('No fake result was produced. No funds moved. No transaction signed.');
      return 0;
    }
    if (error instanceof IntentsApiError) {
      console.error(`FAILED: 1Click API error ${error.status} for ${error.path}`);
      return 1;
    }
    console.error(`FAILED: ${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`FAILED: unexpected smoke error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
