import { z } from 'zod';

import { sha256Hex } from './canonical.js';
import { assertServerRuntime, loadNearAiConfig, type NearAiConfig } from './config.js';
import { AiClientError } from './errors.js';
import type { ChatJsonOptions, ChatJsonRecord, JsonChatClient } from './types.js';

const ChatCompletionResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().optional(),
    choices: z
      .array(
        z
          .object({
            message: z.object({ role: z.string().optional(), content: z.string() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z.unknown().optional(),
  })
  .passthrough();

export interface NearAiSignatureEvidence {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: 'ecdsa' | 'ed25519' | string;
  signature_kind?: 'gateway' | 'provider_tee' | string;
  error_code?: string;
  message?: string;
  [key: string]: unknown;
}

const SignatureEvidenceSchema = z
  .object({
    text: z.string(),
    signature: z.string(),
    signing_address: z.string(),
    signing_algo: z.string(),
    signature_kind: z.string().optional(),
    error_code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export interface NearAiClientOptions {
  config?: NearAiConfig;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

export class NearAiClient implements JsonChatClient {
  readonly config: NearAiConfig;
  readonly #fetch: typeof fetch;

  constructor(options: NearAiClientOptions = {}) {
    assertServerRuntime();
    this.config = options.config ?? loadNearAiConfig(options.env);
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async chatJson<T>(options: ChatJsonOptions<T>): Promise<ChatJsonRecord<T>> {
    if (!this.config.apiKey) {
      throw new AiClientError(
        'NEAR_AI_CONFIG',
        'NEAR_AI_API_KEY is required for live inference; use recorded fixtures offline',
      );
    }

    const body = {
      model: options.model ?? this.config.model,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      temperature: options.temperature ?? 0,
      response_format: { type: 'json_object' },
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };
    const requestBodyText = JSON.stringify(body);

    let response: Response;
    try {
      response = await this.#fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'x-no-aliasing': 'true',
          'Accept-Encoding': 'identity',
        },
        body: requestBodyText,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new AiClientError('NEAR_AI_UNAVAILABLE', 'NEAR AI request failed', {
        cause: error instanceof Error ? error.name : 'unknown',
      });
    }

    const responseBodyText = await response.text();
    if (!response.ok) {
      let upstreamMessage = '';
      try {
        const parsed = JSON.parse(responseBodyText) as { error?: { message?: unknown }; message?: unknown };
        const candidate = parsed.error?.message ?? parsed.message;
        if (typeof candidate === 'string') upstreamMessage = candidate.slice(0, 300);
      } catch {
        // Do not echo arbitrary response bytes into logs/errors.
      }
      throw new AiClientError('NEAR_AI_HTTP_ERROR', `NEAR AI returned HTTP ${response.status}`, {
        status: response.status,
        upstreamMessage: upstreamMessage || undefined,
      });
    }

    let envelope: z.infer<typeof ChatCompletionResponseSchema>;
    try {
      envelope = ChatCompletionResponseSchema.parse(JSON.parse(responseBodyText));
    } catch {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', 'NEAR AI response envelope is invalid');
    }

    const content = envelope.choices[0]?.message.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', 'NEAR AI response has no content');
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', 'NEAR AI content is not strict JSON');
    }

    const data = options.schema.parse(raw);

    return {
      data,
      model: envelope.model ?? body.model,
      responseId: envelope.id,
      requestBodyText,
      responseBodyText,
      requestHash: sha256Hex(requestBodyText),
      responseHash: sha256Hex(responseBodyText),
      transport: 'live',
      usage: envelope.usage,
    };
  }

  /**
   * Fetch the post-hoc response signature. Requires the same API key and the
   * exact chat id returned by `/chat/completions`.
   */
  async fetchSignature(
    chatId: string,
    signingAlgo: 'ecdsa' | 'ed25519' = 'ecdsa',
  ): Promise<NearAiSignatureEvidence> {
    if (!this.config.apiKey) {
      throw new AiClientError('NEAR_AI_CONFIG', 'NEAR_AI_API_KEY is required to fetch a signature');
    }
    const url = new URL(`${this.config.baseUrl}/signature/${encodeURIComponent(chatId)}`);
    url.searchParams.set('signing_algo', signingAlgo);
    let response: Response;
    try {
      response = await this.#fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
          'Accept-Encoding': 'identity',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new AiClientError('NEAR_AI_UNAVAILABLE', 'NEAR AI signature request failed', {
        cause: error instanceof Error ? error.name : 'unknown',
      });
    }
    const responseBodyText = await response.text();
    if (!response.ok) {
      throw new AiClientError('NEAR_AI_UNAVAILABLE', `NEAR AI signature HTTP ${response.status}`, {
        status: response.status,
      });
    }
    try {
      return SignatureEvidenceSchema.parse(JSON.parse(responseBodyText));
    } catch {
      throw new AiClientError('NEAR_AI_UNAVAILABLE', 'NEAR AI signature response is invalid');
    }
  }
}

export function createNearAiClient(options: NearAiClientOptions = {}): NearAiClient {
  return new NearAiClient(options);
}
