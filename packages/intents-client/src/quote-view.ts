import { buildIntentExplorerLink, type ExplorerLink } from './explorer.js';
import { MAINNET_ONLY_LABEL } from './mainnet-guard.js';
import type { QuoteResult } from './results.js';
import type { AppFee, TokenResponse } from './schemas.js';

export const UNAUTHENTICATED_FEE_NOTICE =
  'Unauthenticated quotes may include an additional fee of up to 25 bps. A partner JWT is server-side only and is never exposed.' as const;

export type QuoteMode = 'DRY_PREVIEW' | 'LIVE_DEPOSIT_REQUEST';

export interface QuoteAssetView {
  assetId: string;
  chain: string;
  symbol: string | null;
  decimals: number | null;
  amount: string;
  formatted: string;
  usd: string;
}

export interface QuoteFeeView {
  refundFee: string | null;
  withdrawFee: string | null;
  appFees: readonly AppFee[];
  appFeeBpsTotal: number;
  /** amountInUsd - amountOutUsd, when both are present. Estimated, not a promise. */
  estimatedFeeUsd: number | null;
  estimated: true;
}

export interface QuoteDepositView {
  address: string;
  memo: string | null;
  deadline: string | null;
  inactiveAt: string | null;
  instructions: string;
  intentExplorerUrl: ExplorerLink;
}

export interface QuoteView {
  quoteKind: QuoteMode;
  /** A quote is never a payment, in dry or live mode. */
  isPayment: false;
  canBePresentedAsPayment: false;
  requiresReconciliation: true;
  mainnetOnly: true;
  mainnetNotice: typeof MAINNET_ONLY_LABEL;
  label: string;
  workOrderId: string | null;
  correlationId: string | null;
  signatureVerified: boolean;
  source: QuoteAssetView;
  destination: QuoteAssetView & {
    recipient: string;
    recipientType: string;
  };
  recipientBinding: {
    recipient: string;
    recipientType: string;
    destinationAsset: string;
    signatureVerified: boolean;
  };
  estimatedOutput: string;
  minimumOutput: string;
  timeEstimateSeconds: number | null;
  requestDeadline: string;
  expiresAt: string | null;
  fees: QuoteFeeView;
  deposit: QuoteDepositView | null;
  warnings: string[];
}

export interface QuoteViewOptions {
  tokens?: readonly TokenResponse[];
  workOrderId?: string;
  /**
   * Set false when the quote was made without a partner JWT. The UI must
   * disclose the possible 25 bps unauthenticated fee.
   */
  authenticated?: boolean;
  /** Injectable clock for tests. */
  now?: Date;
}

function tokenIndex(tokens: readonly TokenResponse[] | undefined): Map<string, TokenResponse> {
  return new Map((tokens ?? []).map((token) => [token.assetId, token]));
}

function usdDifference(amountInUsd: string, amountOutUsd: string): number | null {
  const input = Number.parseFloat(amountInUsd);
  const output = Number.parseFloat(amountOutUsd);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  const difference = input - output;
  return difference >= 0 ? difference : null;
}

/**
 * Build display data for the sponsor UI. Dry quotes are unmistakably labeled
 * and have no deposit instructions. Live quotes still are not payments: only
 * a reconciled SUCCESS with destination proof may credit a work order.
 */
export function buildQuoteView(result: QuoteResult, options: QuoteViewOptions = {}): QuoteView {
  const { quote, quoteRequest } = result.response;
  const tokens = tokenIndex(options.tokens);
  const sourceToken = tokens.get(quoteRequest.originAsset);
  const destinationToken = tokens.get(quoteRequest.destinationAsset);
  const dry = quoteRequest.dry;
  const mode: QuoteMode = dry ? 'DRY_PREVIEW' : 'LIVE_DEPOSIT_REQUEST';

  const appFees = quoteRequest.appFees ?? [];
  const appFeeBpsTotal = appFees.reduce((sum, fee) => sum + fee.fee, 0);
  const depositAddress = quote.depositAddress?.trim() ?? '';
  const depositMemo = quote.depositMemo?.trim() ?? '';
  const depositDeadline = quote.deadline ?? null;
  const inactiveAt = quote.timeWhenInactive ?? null;

  const sourceSymbol = sourceToken?.symbol ?? null;
  const sourceChain = sourceToken?.blockchain ?? 'unknown';
  const assetLabel = sourceSymbol ?? quoteRequest.originAsset;
  const deposit: QuoteDepositView | null = dry
    ? null
    : depositAddress.length > 0
      ? {
          address: depositAddress,
          memo: depositMemo.length > 0 ? depositMemo : null,
          deadline: depositDeadline,
          inactiveAt,
          instructions: `Send exactly ${quote.amountInFormatted} ${assetLabel} on ${sourceChain} to ${depositAddress}`,
          intentExplorerUrl: buildIntentExplorerLink(depositAddress, depositMemo.length > 0 ? depositMemo : null),
        }
      : null;

  const warnings: string[] = [MAINNET_ONLY_LABEL];
  if (dry) {
    warnings.push('Preview only — no deposit address yet. This is not a payment.');
  } else {
    warnings.push('This is a deposit request, not a completed payment.');
    warnings.push(`Send only ${assetLabel} on ${sourceChain}. Any other asset or chain may be lost.`);
    if (depositMemo.length > 0) warnings.push(`Memo required: ${depositMemo}`);
    if (depositDeadline !== null) warnings.push(`This quote expires at ${depositDeadline}. Do not send after expiry.`);
    if (depositAddress.length === 0) warnings.push('Deposit address missing — do not send funds.');
  }
  warnings.push('Funds arrive at the MEND hub only after SUCCESS and reconciliation; a detected deposit is not a completed sponsorship.');
  if (options.authenticated === false) warnings.push(UNAUTHENTICATED_FEE_NOTICE);
  if (quote.withdrawFee !== undefined && quote.withdrawFee !== '0') {
    warnings.push(`Destination withdrawal fee is ${quote.withdrawFee} base units; it may include recipient storage registration.`);
  }

  return {
    quoteKind: mode,
    isPayment: false,
    canBePresentedAsPayment: false,
    requiresReconciliation: true,
    mainnetOnly: true,
    mainnetNotice: MAINNET_ONLY_LABEL,
    label: dry ? 'Preview only — no deposit address yet.' : 'Deposit request — mainnet only. Not a completed payment.',
    workOrderId: options.workOrderId ?? null,
    correlationId: result.response.correlationId ?? null,
    signatureVerified: result.verified,
    source: {
      assetId: quoteRequest.originAsset,
      chain: sourceChain,
      symbol: sourceSymbol,
      decimals: sourceToken?.decimals ?? null,
      amount: quote.amountIn,
      formatted: quote.amountInFormatted,
      usd: quote.amountInUsd,
    },
    destination: {
      assetId: quoteRequest.destinationAsset,
      chain: 'near',
      symbol: destinationToken?.symbol ?? null,
      decimals: destinationToken?.decimals ?? null,
      amount: quote.amountOut,
      formatted: quote.amountOutFormatted,
      usd: quote.amountOutUsd,
      recipient: quoteRequest.recipient,
      recipientType: quoteRequest.recipientType,
    },
    recipientBinding: {
      recipient: quoteRequest.recipient,
      recipientType: quoteRequest.recipientType,
      destinationAsset: quoteRequest.destinationAsset,
      signatureVerified: result.verified,
    },
    estimatedOutput: quote.amountOut,
    minimumOutput: quote.minAmountOut,
    timeEstimateSeconds: quote.timeEstimate ?? null,
    requestDeadline: quoteRequest.deadline,
    expiresAt: dry ? null : depositDeadline,
    fees: {
      refundFee: quote.refundFee ?? null,
      withdrawFee: quote.withdrawFee ?? null,
      appFees,
      appFeeBpsTotal,
      estimatedFeeUsd: usdDifference(quote.amountInUsd, quote.amountOutUsd),
      estimated: true,
    },
    deposit,
    warnings,
  };
}
