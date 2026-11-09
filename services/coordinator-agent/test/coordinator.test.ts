import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AssetSchema, MendError, WorkOrderSchema, sha256Hex, stableStringify } from '@mend/protocol';
import { CoordinatorAgent } from '../src/index.js';
import type { CoordinatorIntake } from '../src/index.js';

const fixture = (name: string): { intake: CoordinatorIntake } =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/agents/coordinator/${name}`, import.meta.url), 'utf8')) as {
    intake: CoordinatorIntake;
  };

const CLOCK = () => '2026-11-10T08:00:00.000Z';

function agent() {
  return new CoordinatorAgent({
    actor: 'coordinator-ai.mend.testnet',
    fundingToken: 'mend-usdc.testnet',
    clock: CLOCK,
  });
}

describe('coordinator agent', () => {
  it('produces a schema-valid draft asset and DRAFT work order', () => {
    const proposal = agent().propose(fixture('intake.json').intake);
    expect(proposal.draftAsset.id).toBe('BENCH-001');
    expect(proposal.draftWorkOrder.id).toBe('WO-BENCH-001-0001');
    expect(proposal.draftWorkOrder.status).toBe('DRAFT');
    expect(proposal.draftWorkOrder.budgetMicro).toBe('100000000');
    expect(proposal.draftWorkOrder.awardedBidId).toBeUndefined();
    expect(proposal.draftWorkOrder.contractorId).toBeUndefined();
    expect(() => AssetSchema.parse(proposal.draftAsset)).not.toThrow();
    expect(() => WorkOrderSchema.parse(proposal.draftWorkOrder)).not.toThrow();
    expect(proposal.humanApprovalRequired).toBe(true);
  });

  it('binds the scope with the canonical protocol hash', () => {
    const proposal = agent().propose(fixture('intake.json').intake);
    const { scopeHash, ...scope } = proposal.scope;
    expect(sha256Hex(stableStringify(scope))).toBe(scopeHash);
    expect(proposal.draftWorkOrder.scopeHash).toBe(scopeHash);
  });

  it('is deterministic for identical configuration and input', () => {
    const first = agent().propose(fixture('intake.json').intake);
    const second = agent().propose(fixture('intake.json').intake);
    expect(second.draftAsset).toEqual(first.draftAsset);
    expect(second.draftWorkOrder).toEqual(first.draftWorkOrder);
    expect(second.scope).toEqual(first.scope);
  });

  it('treats injected report text as data and logs the block', () => {
    const clean = agent().propose(fixture('intake.json').intake);
    const coordinator = agent();
    const attacked = coordinator.propose(fixture('intake-attack.json').intake);

    expect(attacked.draftWorkOrder.budgetMicro).toBe(clean.draftWorkOrder.budgetMicro);
    expect(attacked.scope).toEqual(clean.scope);
    expect(attacked.draftAsset.publicDescription).toBe(clean.draftAsset.publicDescription);
    expect(JSON.stringify(attacked)).not.toContain('attacker.mend.testnet');
    expect(attacked.draftWorkOrder).not.toHaveProperty('recipient');

    const blocked = coordinator.auditLog.filter((event) => event.name === 'prompt_injection_blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0]?.data.blocked).toBe(true);
    expect(blocked[0]?.data.categories).toContain('recipient-change');
  });

  it('can only create draft assets/work orders and cannot award, accept or pay', () => {
    const coordinator = agent();
    expect(coordinator.performAction('create_work_order')).toEqual({
      allowed: true,
      method: 'create_work_order',
      authority: 'DRAFT_ONLY',
    });
    expect(coordinator.performAction('create_asset').allowed).toBe(true);

    for (const method of [
      'award',
      'accept_completion',
      'inspect_durability',
      'refund',
      'resolve_dispute',
      'fund_work_order',
      'ft_transfer',
      'ft_transfer_call',
      'set_role',
      'pause',
    ]) {
      expect(() => coordinator.performAction(method)).toThrow(MendError);
      try {
        coordinator.performAction(method);
      } catch (error) {
        expect((error as MendError).code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('rejects mainnet drafts', () => {
    const intake = fixture('intake.json').intake;
    expect(() => agent().propose({ ...intake, mode: 'MAINNET' })).toThrow(MendError);
  });

  it('rejects malformed intake', () => {
    const intake = fixture('intake.json').intake;
    expect(() => agent().propose({ ...intake, assetId: 'bad id' })).toThrow();
    expect(() => agent().propose({ ...intake, scope: { ...intake.scope, budgetRecommendationMicro: '-1' } })).toThrow();
  });
});
