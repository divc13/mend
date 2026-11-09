import { MendError } from '@mend/protocol';
import {
  buildQuoteView,
  EXECUTION_STATUSES,
  IntentsError,
  MAINNET_ONLY_LABEL,
  OneClickClient,
  trackStatus,
  type GetStatusOptions,
  type QuoteParams,
  type QuoteResult,
  type QuoteView,
  type StatusResult,
} from '@mend/intents-client';
import type { AppConfig } from '../config.js';

export const INTENTS_PROVIDER = 'NEAR Intents / 1Click';
export { MAINNET_ONLY_LABEL };

export interface IntentQuoteRequest {
  dry: boolean;
  srcChain: string;
  srcAsset: string;
  dstAsset: string;
  amountIn: string;
  recipient: string;
  workOrderId?: string;
  refundTo?: string;
  /**
   * Explicit per-call human confirmation. Required for live/non-dry quotes in
   * addition to INTENTS_ALLOW_LIVE=true.
   */
  confirmLive?: boolean;
}

export interface IntentQuoteResult {
  amountOut: string;
  feesUsd?: number;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
  raw: Record<string, unknown>;
  quoteKind: 'DRY_PREVIEW' | 'LIVE_DEPOSIT_REQUEST';
  label: string;
  mainnetOnly: true;
  mainnetLabel: typeof MAINNET_ONLY_LABEL;
  isPayment: false;
  canBePresentedAsPayment: false;
  signatureVerified: boolean;
  view: QuoteView;
}

export interface IntentStatusRequest {
  quoteId: string;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
}

export interface IntentStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'INCOMPLETE' | 'EXPIRED';
  destinationTxHash?: string;
  explorerUrl?: string;
  raw: Record<string, unknown>;
  verified: boolean;
  flowState: string;
  rawStatus: string;
}

export interface IntentsAdapter {
  readonly provider: string;
  readonly mainnetOnly: true;
  readonly available: boolean;
  readonly unavailableReason?: string;
  capabilities(): IntentsCapabilities;
  quote(request: IntentQuoteRequest): Promise<IntentQuoteResult>;
  status(request: IntentStatusRequest): Promise<IntentStatusResult>;
}

export interface IntentsCapabilities {
  provider: string;
  available: boolean;
  mainnetOnly: true;
  mainnetLabel: typeof MAINNET_ONLY_LABEL;
  dryQuotesEnabled: boolean;
  liveExecutionEnabled: boolean;
  liveRequiresHumanConfirmation: true;
  signingEnabled: false;
  statuses: readonly string[];
  reason?: string;
  disclaimer: string;
}

/** Narrow interface so tests can inject a deterministic Intents client. */
export interface IntentsSdkClient {
  getDryQuote(params: QuoteParams): Promise<QuoteResult>;
  createDepositQuote(
    params: QuoteParams,
    options: { confirmMainnet: boolean },
  ): Promise<QuoteResult>;
  getStatus(depositAddress: string, options?: GetStatusOptions): Promise<StatusResult>;
}

export interface OneClickIntentsAdapterOptions {
  client?: IntentsSdkClient;
  now?: () => Date;
}

function intentsUnavailable(reason: string): MendError {
  return new MendError('UPSTREAM_UNAVAILABLE', reason, {
    provider: INTENTS_PROVIDER,
    available: false,
    mainnetOnly: true,
    mainnetLabel: MAINNET_ONLY_LABEL,
    dryQuotesEnabled: false,
    liveExecutionEnabled: false,
  });
}

function toMendError(error: unknown): MendError {
  if (error instanceof MendError) return error;
  if (error instanceof IntentsError) {
    const details = {
      provider: INTENTS_PROVIDER,
      intentsCode: error.code,
      mainnetOnly: true,
      signingEnabled: false,
    };
    switch (error.code) {
      case 'MAINNET_GUARD_BLOCKED':
        return new MendError('INVALID_STATE', error.message, {
          ...details,
          humanConfirmationRequired: true,
          allowLive: false,
        });
      case 'INTENTS_NOT_FOUND':
        return new MendError('NOT_FOUND', error.message, details);
      case 'INVALID_QUOTE_REQUEST':
        return new MendError('VALIDATION_ERROR', error.message, details);
      case 'NEAR_RECIPIENT_NOT_READY':
        return new MendError('UPSTREAM_UNAVAILABLE', error.message, {
          ...details,
          recipientReadinessRequired: true,
        });
      default:
        return new MendError('UPSTREAM_UNAVAILABLE', `${INTENTS_PROVIDER}: ${error.message}`, details);
    }
  }
  return new MendError('UPSTREAM_UNAVAILABLE', `${INTENTS_PROVIDER} request failed`, {
    provider: INTENTS_PROVIDER,
    mainnetOnly: true,
    signingEnabled: false,
    cause: error instanceof Error ? error.name : 'unknown',
  });
}

function feesUsd(result: QuoteResult): number | undefined {
  const input = Number.parseFloat(result.response.quote.amountInUsd);
  const output = Number.parseFloat(result.response.quote.amountOutUsd);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return undefined;
  const difference = input - output;
  return difference >= 0 ? Math.round(difference * 1_000_000) / 1_000_000 : undefined;
}

/**
 * Real NEAR Intents/1Click adapter built on the merged
 * `@mend/intents-client` package.
 *
 * MAINNET ONLY: there is no testnet. Dry previews are enabled with
 * INTENTS_ENABLED=true. Live (non-dry) deposit requests additionally require
 * INTENTS_ALLOW_LIVE=true and an explicit per-call `confirmLive: true`; even
 * then the merged client requires a NEAR recipient readiness proof. This
 * adapter has no signing or transfer capability.
 */
export class OneClickIntentsAdapter implements IntentsAdapter {
  readonly provider = INTENTS_PROVIDER;
  readonly mainnetOnly = true as const;
  readonly available: boolean;
  readonly unavailableReason?: string;
  private readonly client: IntentsSdkClient;
  private readonly now: () => Date;

  constructor(
    private readonly config: AppConfig['intents'],
    options: OneClickIntentsAdapterOptions = {},
  ) {
    this.available = config.enabled;
    if (!this.available) {
      this.unavailableReason =
        config.unavailableReason ??
        'NEAR Intents 1Click is disabled (INTENTS_ENABLED is not true). Dry previews are disabled until it is enabled.';
    }
    this.now = options.now ?? (() => new Date());
    this.client =
      options.client ??
      new OneClickClient({
        baseUrl: config.baseUrl,
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        env: { MEND_ALLOW_MAINNET: config.allowLive ? 'true' : 'false' },
      });
  }

  capabilities(): IntentsCapabilities {
    if (!this.available) {
      return {
        provider: this.provider,
        available: false,
        mainnetOnly: true,
        mainnetLabel: MAINNET_ONLY_LABEL,
        dryQuotesEnabled: false,
        liveExecutionEnabled: false,
        liveRequiresHumanConfirmation: true,
        signingEnabled: false,
        statuses: EXECUTION_STATUSES,
        reason: this.unavailableReason ?? 'NEAR Intents 1Click is disabled',
        disclaimer:
          'NEAR Intents operates on mainnet only. No quote, deposit or transfer is initiated by this adapter while it is disabled.',
      };
    }
    return {
      provider: this.provider,
      available: true,
      mainnetOnly: true,
      mainnetLabel: MAINNET_ONLY_LABEL,
      dryQuotesEnabled: true,
      liveExecutionEnabled: this.config.allowLive,
      liveRequiresHumanConfirmation: true,
      signingEnabled: false,
      statuses: EXECUTION_STATUSES,
      disclaimer: `${MAINNET_ONLY_LABEL}. Dry quotes are previews only. Live deposit requests require INTENTS_ALLOW_LIVE=true plus explicit human confirmation, and this service never signs or sends a transfer.`,
    };
  }

  async quote(request: IntentQuoteRequest): Promise<IntentQuoteResult> {
    if (!this.available) {
      throw intentsUnavailable(
        this.unavailableReason ?? 'NEAR Intents 1Click is disabled (INTENTS_ENABLED is not true)',
      );
    }
    if (!request.dry) {
      if (!this.config.allowLive) {
        throw new MendError(
          'UPSTREAM_UNAVAILABLE',
          'Live Intents quotes are disabled; only dry previews may be requested',
          {
            provider: this.provider,
            mainnetOnly: true,
            allowLive: false,
            humanConfirmationRequired: true,
          },
        );
      }
      if (request.confirmLive !== true) {
        throw new MendError(
          'INVALID_STATE',
          'Live Intents execution requires explicit human confirmation (confirmLive: true)',
          {
            provider: this.provider,
            mainnetOnly: true,
            humanConfirmationRequired: true,
            allowLive: true,
          },
        );
      }
    }

    const refundTo = request.refundTo ?? request.recipient;
    if (!request.dry && !request.refundTo) {
      throw new MendError('VALIDATION_ERROR', 'Live Intents requests require an explicit refundTo address', {
        mainnetOnly: true,
        humanConfirmationRequired: true,
      });
    }

    const params: QuoteParams = {
      originAsset: request.srcAsset,
      destinationAsset: request.dstAsset,
      amount: request.amountIn,
      recipient: request.recipient,
      refundTo,
      recipientType: 'DESTINATION_CHAIN',
      depositType: 'ORIGIN_CHAIN',
      refundType: 'ORIGIN_CHAIN',
      slippageTolerance: 50,
      referral: 'mend',
    };

    try {
      const result = request.dry
        ? await this.client.getDryQuote(params)
        : await this.client.createDepositQuote(params, { confirmMainnet: true });
      const quote = result.response.quote;
      const view = buildQuoteView(result, {
        ...(request.workOrderId ? { workOrderId: request.workOrderId } : {}),
        authenticated: Boolean(this.config.apiKey),
        now: this.now(),
      });
      const raw: Record<string, unknown> = {
        correlationId: result.response.correlationId ?? null,
        timestamp: result.response.timestamp,
        responseSignature: result.response.signature,
        signatureVerified: result.verified,
        quoteKind: view.quoteKind,
        quote: {
          amountIn: quote.amountIn,
          amountInUsd: quote.amountInUsd,
          amountOut: quote.amountOut,
          amountOutUsd: quote.amountOutUsd,
          minAmountOut: quote.minAmountOut,
          timeEstimate: quote.timeEstimate ?? null,
          ...(request.dry
            ? {}
            : {
                depositAddress: quote.depositAddress ?? null,
                depositMemo: quote.depositMemo ?? null,
                deadline: quote.deadline ?? null,
                timeWhenInactive: quote.timeWhenInactive ?? null,
              }),
        },
      };

      const estimatedFeesUsd = feesUsd(result);
      return {
        amountOut: quote.amountOut,
        ...(estimatedFeesUsd !== undefined ? { feesUsd: estimatedFeesUsd } : {}),
        ...(!request.dry && quote.depositAddress ? { depositAddress: quote.depositAddress } : {}),
        ...(!request.dry && quote.depositMemo ? { depositMemo: quote.depositMemo } : {}),
        ...(!request.dry && quote.deadline ? { deadline: quote.deadline } : {}),
        raw,
        quoteKind: view.quoteKind,
        label: view.label,
        mainnetOnly: true,
        mainnetLabel: MAINNET_ONLY_LABEL,
        isPayment: false,
        canBePresentedAsPayment: false,
        signatureVerified: result.verified,
        view,
      };
    } catch (error) {
      throw toMendError(error);
    }
  }

  async status(request: IntentStatusRequest): Promise<IntentStatusResult> {
    if (!this.available) {
      throw intentsUnavailable(
        this.unavailableReason ?? 'NEAR Intents 1Click is disabled (INTENTS_ENABLED is not true)',
      );
    }
    if (!request.depositAddress) {
      throw new MendError(
        'UPSTREAM_UNAVAILABLE',
        'This quote has no deposit address (dry preview). There is no on-chain status to fetch and no payment exists.',
        { mainnetOnly: true, dryPreview: true },
      );
    }
    try {
      const result = await this.client.getStatus(request.depositAddress, {
        ...(request.depositMemo ? { depositMemo: request.depositMemo } : {}),
        requireSignature: true,
      });
      const tracked = trackStatus(result, {
        now: this.now(),
        ...(request.deadline ? { deadline: request.deadline } : {}),
      });
      const transaction = result.response.swapDetails.destinationChainTxHashes.find((tx) => tx.hash.length > 0);
      return {
        status: tracked.state,
        ...(transaction?.hash ? { destinationTxHash: transaction.hash } : {}),
        ...(transaction?.explorerUrl ? { explorerUrl: transaction.explorerUrl } : {}),
        raw: {
          correlationId: result.response.correlationId ?? null,
          rawStatus: tracked.rawStatus,
          flowState: tracked.flowState,
          verified: result.verified,
          destinationTxHashes: tracked.destinationTxHashes,
        },
        verified: result.verified,
        flowState: tracked.flowState,
        rawStatus: tracked.rawStatus,
      };
    } catch (error) {
      throw toMendError(error);
    }
  }
}

export function createIntentsAdapter(
  config: AppConfig['intents'],
  options: OneClickIntentsAdapterOptions = {},
): IntentsAdapter {
  return new OneClickIntentsAdapter(config, options);
}
