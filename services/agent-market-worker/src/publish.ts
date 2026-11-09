import { MendError } from '@mend/protocol';
import type { MarketRequest, MarketTransport } from './client.js';

export const SELF_HIRE_DISCLOSURE = 'Self-hire test; not independent market reputation.';
export const ADVISORY_DISCLOSURE =
  'Advisory completeness review only. It does not certify physical quality or safety. A human inspector makes the final decision.';

export const MEND_EVIDENCE_REVIEW_AGENT = {
  handle: 'mend-evidence-review',
  name: 'MEND Evidence Review',
  category: 'operations',
  runtime: 'http',
  slaSeconds: 300,
  priceAmount: '0.10',
  description: ADVISORY_DISCLOSURE,
  disclosure: SELF_HIRE_DISCLOSURE,
} as const;

export function buildRegistrationRequest(): Record<string, unknown> {
  return {
    handle: MEND_EVIDENCE_REVIEW_AGENT.handle,
    name: MEND_EVIDENCE_REVIEW_AGENT.name,
    category: MEND_EVIDENCE_REVIEW_AGENT.category,
    runtime: MEND_EVIDENCE_REVIEW_AGENT.runtime,
    sla_seconds: MEND_EVIDENCE_REVIEW_AGENT.slaSeconds,
  };
}

export function buildPricingPlan(): Record<string, unknown> {
  return {
    model: 'per_call',
    price_amount: MEND_EVIDENCE_REVIEW_AGENT.priceAmount,
    sla_seconds: MEND_EVIDENCE_REVIEW_AGENT.slaSeconds,
  };
}

export function buildListingPatch(): Record<string, unknown> {
  return { listing_status: 'live' };
}

export function buildAgentProfile(): Record<string, unknown> {
  return {
    handle: MEND_EVIDENCE_REVIEW_AGENT.handle,
    name: MEND_EVIDENCE_REVIEW_AGENT.name,
    category: MEND_EVIDENCE_REVIEW_AGENT.category,
    runtime: MEND_EVIDENCE_REVIEW_AGENT.runtime,
    description: MEND_EVIDENCE_REVIEW_AGENT.description,
    advisoryOnly: true,
    humanDecisionRequired: true,
    selfHire: true,
    reputationDisclaimer: SELF_HIRE_DISCLOSURE,
    limitations: [
      'No physical certification',
      'No final acceptance authority',
      'No payment authority',
    ],
  };
}

export interface PublishPlan {
  requiresHumanOwnerSession: true;
  emailVerificationRequired: true;
  disclosure: string;
  steps: Array<{ step: string; method: MarketRequest['method']; path: string; body?: unknown }>;
}

export function buildPublishPlan(accountId: string, agentId: string): PublishPlan {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(accountId) || !/^[A-Za-z0-9_-]{1,80}$/.test(agentId)) {
    throw new MendError('VALIDATION_ERROR', 'invalid marketplace account or agent id');
  }
  return {
    requiresHumanOwnerSession: true,
    emailVerificationRequired: true,
    disclosure: SELF_HIRE_DISCLOSURE,
    steps: [
      {
        step: 'create-draft-listing',
        method: 'POST',
        path: `/v1/accounts/${accountId}/agents`,
        body: buildRegistrationRequest(),
      },
      {
        step: 'set-per-call-price',
        method: 'POST',
        path: `/v1/agents/${agentId}/pricing-plans`,
        body: buildPricingPlan(),
      },
      { step: 'publish-listing', method: 'PATCH', path: `/v1/agents/${agentId}`, body: buildListingPatch() },
    ],
  };
}

/** Owner-session publisher. Offline tests use a recorded transport; no secrets are stored here. */
export class AgentMarketPublisher {
  private readonly transport: MarketTransport;

  constructor(transport: MarketTransport) {
    this.transport = transport;
  }

  async register(accountId: string): Promise<unknown> {
    const plan = buildPublishPlan(accountId, 'pending-agent-id');
    const step = plan.steps[0];
    if (!step) throw new MendError('VALIDATION_ERROR', 'missing registration step');
    const response = await this.transport.request({ method: step.method, path: step.path, body: step.body });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return response.body;
  }

  async setPricing(agentId: string): Promise<unknown> {
    const plan = buildPublishPlan('account-placeholder', agentId);
    const step = plan.steps[1];
    if (!step) throw new MendError('VALIDATION_ERROR', 'missing pricing step');
    const response = await this.transport.request({ method: step.method, path: step.path, body: step.body });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return response.body;
  }

  async publish(agentId: string): Promise<unknown> {
    const plan = buildPublishPlan('account-placeholder', agentId);
    const step = plan.steps[2];
    if (!step) throw new MendError('VALIDATION_ERROR', 'missing publish step');
    const response = await this.transport.request({ method: step.method, path: step.path, body: step.body });
    if (response.status < 200 || response.status >= 300) {
      throw new MendError('UPSTREAM_UNAVAILABLE', `agent market returned HTTP ${response.status}`);
    }
    return response.body;
  }
}
