import { MendError } from '@mend/protocol';
import {
  DeclineRequestSchema,
  MARKET_BASE_URL,
  MessageRequestSchema,
  PlatformConfigSchema,
  PollAssignmentsResponseSchema,
  ProgressRequestSchema,
  StartAssignmentResponseSchema,
  SubmitDeliverableRequestSchema,
  SubmitDeliverableResponseSchema,
  WORKER_TOKEN_PATTERN,
} from './types.js';
import type { PlatformConfig, PollAssignmentsResponse, StartAssignmentResponse, Assignment } from './types.js';

export interface MarketRequest {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
}

export interface MarketResponse {
  status: number;
  body: unknown;
}

export interface MarketTransport {
  request(request: MarketRequest): Promise<MarketResponse>;
}

export interface RecordedRoute {
  method: MarketRequest['method'];
  path: string;
  status: number;
  body: unknown;
}

/** Offline transport backed by recorded HTTP exchanges. */
export class RecordedMarketTransport implements MarketTransport {
  private readonly routes = new Map<string, RecordedRoute>();
  readonly calls: MarketRequest[] = [];

  constructor(routes: readonly RecordedRoute[]) {
    for (const route of routes) this.routes.set(this.key(route.method, route.path), route);
  }

  static fromRoutesFile(file: { routes: readonly RecordedRoute[] }): RecordedMarketTransport {
    return new RecordedMarketTransport(file.routes);
  }

  private key(method: string, path: string): string {
    const pathname = path.split('?')[0] ?? path;
    return `${method} ${pathname}`;
  }

  async request(request: MarketRequest): Promise<MarketResponse> {
    this.calls.push(request);
    const route = this.routes.get(this.key(request.method, request.path));
    if (!route) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `no recorded response for ${request.method} ${request.path}`);
    }
    return { status: route.status, body: route.body };
  }
}

export interface HttpMarketTransportOptions {
  baseUrl?: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class HttpMarketTransport implements MarketTransport {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpMarketTransportOptions) {
    assertWorkerToken(options.token);
    assertMarketUrl(options.baseUrl ?? MARKET_BASE_URL, true);
    this.baseUrl = (options.baseUrl ?? MARKET_BASE_URL).replace(/\/$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request(request: MarketRequest): Promise<MarketResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    let body: unknown = null;
    const text = await response.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: response.status, body };
  }
}

export function assertWorkerToken(token: string): void {
  if (!WORKER_TOKEN_PATTERN.test(token)) {
    throw new MendError('UNAUTHORIZED', 'agent market token must be an aat_ bearer token (never logged)');
  }
}

export function assertMarketUrl(url: string, requireHttps = false): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MendError('VALIDATION_ERROR', `invalid marketplace URL: ${url}`);
  }
  if (parsed.hostname !== 'market.near.ai') {
    throw new MendError('RELAYER_TARGET_NOT_ALLOWED', 'only market.near.ai may be contacted');
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new MendError('VALIDATION_ERROR', 'marketplace URL must use https');
  }
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertId(id: string): void {
  if (!ID_PATTERN.test(id)) throw new MendError('VALIDATION_ERROR', `invalid assignment id: ${id}`);
}

export interface AgentMarketWorkerConfig {
  transport: MarketTransport;
  live?: boolean;
  token?: string;
  baseUrl?: string;
}

/**
 * Worker-side Agent Market client. It intentionally exposes only worker
 * operations: poll/start/progress/decline/message/submit. There is no accept
 * endpoint; acceptance belongs to the human buyer on the job page.
 */
export class AgentMarketWorker {
  private readonly transport: MarketTransport;
  readonly live: boolean;

  constructor(config: AgentMarketWorkerConfig) {
    this.transport = config.transport;
    this.live = config.live ?? false;
    if (this.live) {
      if (!config.token) throw new MendError('UNAUTHORIZED', 'live marketplace calls require an aat_ token');
      assertWorkerToken(config.token);
      assertMarketUrl(config.baseUrl ?? MARKET_BASE_URL, true);
    }
  }

  private async request<T>(
    schema: { parse(value: unknown): T },
    request: MarketRequest,
  ): Promise<T> {
    const response = await this.transport.request(request);
    if (response.status === 401 || response.status === 403) {
      throw new MendError('UNAUTHORIZED', 'agent market rejected the worker credential');
    }
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return schema.parse(response.body);
  }

  async platformConfig(): Promise<PlatformConfig> {
    return this.request(PlatformConfigSchema, { method: 'GET', path: '/v1/platform/config' });
  }

  async pollAssignments(params: { status?: string; limit?: number; offset?: number } = {}): Promise<PollAssignmentsResponse> {
    const status = params.status ?? 'in_progress';
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    if (limit < 1 || limit > 100 || offset < 0) {
      throw new MendError('VALIDATION_ERROR', 'invalid assignment pagination');
    }
    const query = new URLSearchParams({ status, limit: String(limit), offset: String(offset) });
    return this.request(PollAssignmentsResponseSchema, {
      method: 'GET',
      path: `/v1/agents/me/assignments?${query.toString()}`,
    });
  }

  async startAssignment(assignmentId: string): Promise<StartAssignmentResponse> {
    assertId(assignmentId);
    return this.request(StartAssignmentResponseSchema, {
      method: 'POST',
      path: `/v1/assignments/${assignmentId}/start`,
      body: {},
    });
  }

  async progress(assignmentId: string, input: unknown): Promise<null> {
    assertId(assignmentId);
    const body = ProgressRequestSchema.parse(input);
    const response = await this.transport.request({
      method: 'POST',
      path: `/v1/assignments/${assignmentId}/progress`,
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return null;
  }

  async decline(assignmentId: string, input: unknown): Promise<null> {
    assertId(assignmentId);
    const body = DeclineRequestSchema.parse(input);
    const response = await this.transport.request({
      method: 'POST',
      path: `/v1/assignments/${assignmentId}/decline`,
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return null;
  }

  async sendMessage(assignmentId: string, input: unknown): Promise<unknown> {
    assertId(assignmentId);
    const body = MessageRequestSchema.parse(input);
    const response = await this.transport.request({
      method: 'POST',
      path: `/v1/assignments/${assignmentId}/messages`,
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return response.body;
  }

  async submitDeliverable(assignmentId: string, input: unknown): Promise<Assignment> {
    assertId(assignmentId);
    const body = SubmitDeliverableRequestSchema.parse(input);
    return this.request(SubmitDeliverableResponseSchema, {
      method: 'POST',
      path: `/v1/assignments/${assignmentId}/submit`,
      body,
    });
  }

  /**
   * There is no worker accept endpoint. Calling this deliberately fails before
   * any HTTP request; a human buyer must accept on the marketplace job page.
   */
  acceptAssignment(): never {
    throw new MendError(
      'FORBIDDEN_ROLE',
      'worker tokens cannot accept deliverables; a human buyer accepts on the job page',
    );
  }
}
