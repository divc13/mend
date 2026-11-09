import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MendError } from '@mend/protocol';
import {
  AgentMarketPublisher,
  AgentMarketWorker,
  HttpMarketTransport,
  RecordedMarketTransport,
  SELF_HIRE_DISCLOSURE,
  buildAgentProfile,
  buildPublishPlan,
  buildRedactedBrief,
  buildRegistrationRequest,
  formatDeliverable,
} from '../src/index.js';
import type { RecordedRoute } from '../src/index.js';

const root = new URL('../../../fixtures/agents/agent-market/', import.meta.url);
const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

function routes(): RecordedMarketTransport {
  return RecordedMarketTransport.fromRoutesFile(
    readJson('routes.json') as { routes: readonly RecordedRoute[] },
  );
}

function worker(transport = routes()) {
  return new AgentMarketWorker({ transport });
}

describe('agent market worker', () => {
  it('reads the recorded platform configuration (5% fee, email verification)', async () => {
    const config = await worker().platformConfig();
    expect(config.platform_fee_bps).toBe(500);
    expect(config.email_verification_required).toBe(true);
  });

  it('polls, starts, messages and submits a job', async () => {
    const transport = routes();
    const client = worker(transport);
    const poll = await client.pollAssignments();
    expect(poll.assignments[0]?.assignment.assignmentId).toBe('asg-0001');
    expect(poll.assignments[0]?.assignment.status).toBe('in_progress');

    const started = await client.startAssignment('asg-0001');
    expect(started.startedAt).toBe('2026-11-10T11:15:00.000Z');

    await client.sendMessage('asg-0001', { body: 'Reviewing the redacted manifest.' });
    const submitted = await client.submitDeliverable('asg-0001', {
      deliverableMarkdown: '# Evidence completeness review\n\nMissing: materials_receipt.',
    });
    expect(submitted.status).toBe('submitted');

    const paths = transport.calls.map((call) => call.path.split('?')[0]);
    expect(paths).toEqual([
      '/v1/agents/me/assignments',
      '/v1/assignments/asg-0001/start',
      '/v1/assignments/asg-0001/messages',
      '/v1/assignments/asg-0001/submit',
    ]);
    expect(paths.some((path) => path?.includes('accept'))).toBe(false);
  });

  it('has no worker accept capability and never sends an accept request', async () => {
    const transport = routes();
    const client = worker(transport);
    expect(() => client.acceptAssignment()).toThrow(MendError);
    await client.startAssignment('asg-0001');
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.path).not.toContain('accept');
  });

  it('validates worker tokens and refuses arbitrary marketplace hosts', () => {
    expect(
      () =>
        new AgentMarketWorker({
          transport: routes(),
          live: true,
          token: 'aat_short',
          baseUrl: 'https://market.near.ai',
        }),
    ).toThrow(MendError);
    expect(
      () =>
        new HttpMarketTransport({
          token: `aat_${'a'.repeat(32)}`,
          baseUrl: 'https://evil.example',
        }),
    ).toThrow(MendError);
    expect(
      () =>
        new HttpMarketTransport({
          token: 'aat_not_hex_but_long_enough_1234567890',
          baseUrl: 'https://market.near.ai',
        }),
    ).toThrow(MendError);
  });

  it('builds a redacted brief with hashes only', () => {
    const fixture = readJson('brief.json') as { brief: unknown };
    const { brief, auditEvents } = buildRedactedBrief(fixture.brief, {
      actor: 'reviewer-ai.mend.testnet',
      timestamp: '2026-11-10T11:15:00.000Z',
    });
    expect(brief.work_order_id).toBe('WO-BENCH-001-0001');
    expect(brief.submitted_items).toHaveLength(2);
    expect(JSON.stringify(brief)).not.toMatch(/https?:\/\//);
    expect(brief).not.toHaveProperty('notes');
    expect(auditEvents).toHaveLength(0);
  });

  it('blocks injected brief notes and omits them from the payload', () => {
    const fixture = readJson('brief-attack.json') as { brief: unknown };
    const { brief, auditEvents } = buildRedactedBrief(fixture.brief, {
      actor: 'reviewer-ai.mend.testnet',
      timestamp: '2026-11-10T11:15:00.000Z',
    });
    expect(auditEvents.some((event) => event.name === 'prompt_injection_blocked')).toBe(true);
    const serialized = JSON.stringify(brief);
    expect(serialized).not.toContain('attacker.mend.testnet');
    expect(serialized).not.toContain('Ignore previous');
  });

  it('rejects private media URLs, file paths and precise locations', () => {
    const fixture = readJson('brief-private.json') as { brief: unknown };
    expect(() =>
      buildRedactedBrief(fixture.brief, { actor: 'reviewer-ai.mend.testnet' }),
    ).toThrow(MendError);
  });

  it('builds registration, pricing and publish metadata with disclosures', () => {
    const registration = buildRegistrationRequest();
    expect(registration).toMatchObject({
      handle: 'mend-evidence-review',
      name: 'MEND Evidence Review',
      runtime: 'http',
      sla_seconds: 300,
    });
    const profile = buildAgentProfile();
    expect(profile.selfHire).toBe(true);
    expect(profile.reputationDisclaimer).toBe(SELF_HIRE_DISCLOSURE);
    expect(String(profile.description)).toContain('Advisory completeness review only');

    const plan = buildPublishPlan('account-0001', 'agent-0001');
    expect(plan.requiresHumanOwnerSession).toBe(true);
    expect(plan.steps.map((step) => step.method)).toEqual(['POST', 'POST', 'PATCH']);
    expect(plan.steps[0]?.path).toBe('/v1/accounts/account-0001/agents');
  });

  it('registers, prices and publishes through recorded owner routes', async () => {
    const transport = routes();
    const publisher = new AgentMarketPublisher(transport);
    const registered = (await publisher.register('account-0001')) as { agentId: string };
    expect(registered.agentId).toBe('agent-0001');
    await publisher.setPricing('agent-0001');
    const published = (await publisher.publish('agent-0001')) as { listing_status: string };
    expect(published.listing_status).toBe('live');
    expect(transport.calls.map((call) => call.method)).toEqual(['POST', 'POST', 'PATCH']);
  });

  it('formats an advisory deliverable with a machine-readable block', () => {
    const { deliverableMarkdown, machineReadable } = formatDeliverable({
      workOrderId: 'WO-BENCH-001-0001',
      evidenceId: 'EV-0001',
      missingChecklistItems: ['fastener_closeup', 'materials_receipt', 'completion_note'],
      limitations: ['Completeness only', 'No physical inspection'],
    });
    expect(deliverableMarkdown).toContain('Missing checklist items: fastener_closeup, materials_receipt, completion_note.');
    expect(deliverableMarkdown).toContain('```json');
    expect(machineReadable.advisory_only).toBe(true);
    expect(machineReadable.human_decision_required).toBe(true);
    expect(machineReadable.not_a_certification).toBe(true);
    expect(Buffer.byteLength(deliverableMarkdown, 'utf8')).toBeLessThan(256 * 1024);
  });

  it('rejects invalid worker payloads before sending', async () => {
    const transport = routes();
    const client = worker(transport);
    await expect(client.submitDeliverable('asg-0001', { deliverableMarkdown: '' })).rejects.toThrow();
    await expect(client.submitDeliverable('asg-0001', { deliverableMarkdown: 'ok', files: ['1', '2', '3', '4', '5', '6'] })).rejects.toThrow();
    await expect(client.progress('asg-0001', { message: 'x'.repeat(281) })).rejects.toThrow();
    expect(transport.calls).toHaveLength(0);
  });
});
