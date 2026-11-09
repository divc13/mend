import { MendError } from '@mend/protocol';
import type { AppConfig } from '../config.js';

export interface IntentQuoteRequest {
  dry: boolean;
  srcChain: string;
  srcAsset: string;
  dstAsset: string;
  amountIn: string;
  recipient: string;
  workOrderId?: string;
  refundTo?: string;
}

export interface IntentQuoteResult {
  amountOut: string;
  feesUsd?: number;
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
  raw: Record<string, unknown>;
}

export interface IntentStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'INCOMPLETE' | 'EXPIRED';
  destinationTxHash?: string;
  explorerUrl?: string;
  raw: Record<string, unknown>;
}

export interface IntentsAdapter {
  readonly provider: string;
  readonly mainnetOnly: true;
  readonly available: boolean;
  readonly unavailableReason?: string;
  quote(request: IntentQuoteRequest): Promise<IntentQuoteResult>;
  status(quoteId: string): Promise<IntentStatusResult>;
}

export interface IntentsCapabilities {
  provider: string;
  available: boolean;
  mainnetOnly: true;
  reason?: string;
  disclaimer: string;
}

/**
 * The R0-C Intents research file was not present when this worker ran. Rather
 * than invent fields for a live mainnet API, the adapter reports unavailable.
 * `quote` and `status` throw a protocol UPSTREAM_UNAVAILABLE error with details
 * the UI can render honestly.
 */
export class UnvalidatedIntentsAdapter implements IntentsAdapter {
  readonly provider = 'NEAR Intents / 1Click';
  readonly mainnetOnly = true as const;
  readonly available = false;
  readonly unavailableReason: string;

  constructor(config: AppConfig['intents']) {
    this.unavailableReason = config.unavailableReason
      ?? 'NEAR Intents/1Click adapter was not validated (orchestration/research/R0-C-intents.md missing). Refusing to invent request fields or call a mainnet endpoint.';
  }

  capabilities(): IntentsCapabilities {
    return {
      provider: this.provider,
      available: false,
      mainnetOnly: true,
      reason: this.unavailableReason,
      disclaimer: 'NEAR Intents operates on mainnet only. No quote, deposit or transfer is initiated by this adapter.',
    };
  }

  quote(): Promise<IntentQuoteResult> {
    return Promise.reject(new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, {
      provider: this.provider,
      available: false,
      mainnetOnly: true,
    }));
  }

  status(): Promise<IntentStatusResult> {
    return Promise.reject(new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, {
      provider: this.provider,
      available: false,
      mainnetOnly: true,
    }));
  }
}

export function createIntentsAdapter(config: AppConfig['intents']): IntentsAdapter {
  return new UnvalidatedIntentsAdapter(config);
}
