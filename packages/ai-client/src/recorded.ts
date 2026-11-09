import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { sha256Hex } from './canonical.js';
import { AiClientError } from './errors.js';
import type { ChatJsonOptions, ChatJsonRecord, JsonChatClient } from './types.js';

export const ReplayLabelSchema = z.literal('REPLAY / SIMULATION');

const RecordedFixtureSchema = z
  .object({
    meta: z
      .object({
        recorded: z.literal(true),
        replayLabel: ReplayLabelSchema,
        kind: z.string().min(1),
        note: z.string().optional(),
        source: z.string().optional(),
      })
      .strict(),
    request: z
      .object({
        model: z.string().min(1),
        messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
      })
      .passthrough(),
    response: z
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
      .passthrough(),
  })
  .strict();

export type RecordedFixture = z.infer<typeof RecordedFixtureSchema>;

/**
 * Offline replay transport. It never performs network I/O and is visibly
 * labeled `REPLAY / SIMULATION` in the returned record metadata.
 */
export class RecordedChatClient implements JsonChatClient {
  readonly fixture: RecordedFixture;

  constructor(fixture: unknown) {
    this.fixture = RecordedFixtureSchema.parse(fixture);
  }

  static fromFile(filePath: string): RecordedChatClient {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', `cannot read recorded fixture: ${filePath}`);
    }
    return new RecordedChatClient(parsed);
  }

  async chatJson<T>(options: ChatJsonOptions<T>): Promise<ChatJsonRecord<T>> {
    const content = this.fixture.response.choices[0]?.message.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', 'recorded fixture has no content');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new AiClientError('NEAR_AI_INVALID_OUTPUT', 'recorded content is not strict JSON');
    }
    const data = options.schema.parse(raw);
    const requestBodyText = JSON.stringify(this.fixture.request);
    const responseBodyText = JSON.stringify(this.fixture.response);

    return {
      data,
      model: this.fixture.response.model ?? this.fixture.request.model,
      responseId: this.fixture.response.id,
      requestBodyText,
      responseBodyText,
      requestHash: sha256Hex(requestBodyText),
      responseHash: sha256Hex(responseBodyText),
      transport: 'recorded',
      usage: this.fixture.response.usage,
    };
  }
}
