import type { z } from 'zod';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatJsonOptions<T> {
  /** Trusted system instructions. Never include untrusted report text here. */
  system: string;
  /** User payload. Untrusted text must be wrapped by promptGuard helpers. */
  user: string;
  /** Strict output schema. Extra keys are rejected by `.strict()` schemas. */
  schema: z.ZodType<T>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Client-established freshness nonce where the provider supports it. */
  nonce?: string;
}

export interface ChatJsonRecord<T> {
  data: T;
  model: string;
  responseId: string;
  /** Exact UTF-8 request body bytes (string form) sent to the provider. */
  requestBodyText: string;
  /** Exact UTF-8 response body bytes (string form) received from the provider. */
  responseBodyText: string;
  requestHash: string;
  responseHash: string;
  transport: 'live' | 'recorded';
  usage?: unknown;
}

export interface JsonChatClient {
  chatJson<T>(options: ChatJsonOptions<T>): Promise<ChatJsonRecord<T>>;
}
