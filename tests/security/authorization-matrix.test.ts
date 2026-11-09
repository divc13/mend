import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ROLES } from '@mend/protocol';

import { exists, fetchWithTimeout, repoPath } from '../security/support/repo.js';
import {
  AI_SUBJECTS,
  ALLOWED,
  MUTATING_HUB_METHODS,
  API_MUTATIONS,
  SUBJECTS,
  apiMatrixCells,
  assertMatrixInvariants,
  isAllowed,
  matrixCells,
  roleMatrixFor,
  type MutatingHubMethod,
} from './authorization-matrix.js';

const openapi = JSON.parse(
  readFileSync(repoPath('packages', 'protocol', 'generated', 'openapi.json'), 'utf8'),
) as { paths?: Record<string, Record<string, unknown>> };

function mutatingOpenApiPaths(): string[] {
  const verbs = new Set(['post', 'put', 'patch', 'delete']);
  return Object.entries(openapi.paths ?? {})
    .filter(([, operations]) => Object.keys(operations).some((verb) => verbs.has(verb.toLowerCase())))
    .map(([path]) => path);
}


const LIVE_WORK_ORDER_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  dao_authorize: ['DAO'],
  fund: ['SPONSOR'],
  open_bidding: ['STEWARD'],
  close_bidding: ['STEWARD'],
  award: ['STEWARD'],
  start_work: ['CONTRACTOR'],
  submit_completion: ['CONTRACTOR'],
  accept_completion: ['INSPECTOR'],
  inspect_durability: ['INSPECTOR'],
  open_dispute: ['STEWARD', 'INSPECTOR', 'CONTRACTOR'],
  resolve_dispute: ['DAO'],
  cancel_work_order: ['STEWARD'],
  refund: ['DAO', 'STEWARD'],
  pause: ['ADMIN', 'DAO'],
  unpause: ['ADMIN', 'DAO'],
};

function accountFor(subject: string): string {
  return `qa-${subject.toLowerCase().replace(/_/g, '-')}.mend.testnet`;
}

describe('API authorization matrix — every mutation x every role', () => {
  it('covers every mutating hub method and every subject with no missing cells', () => {
    expect(MUTATING_HUB_METHODS.length).toBeGreaterThanOrEqual(25);
    expect(SUBJECTS).toEqual(['ANON', ...ROLES, 'ORACLE', 'OWNER']);
    const cells = matrixCells();
    expect(cells.length).toBe(MUTATING_HUB_METHODS.length * SUBJECTS.length);
    for (const cell of cells) expect(typeof cell.allowed).toBe('boolean');

    for (const method of MUTATING_HUB_METHODS) {
      const row = roleMatrixFor(method);
      expect(Object.keys(row).sort()).toEqual([...SUBJECTS].sort());
    }
  });

  it('has no separation-of-duties violations', () => {
    expect(assertMatrixInvariants()).toEqual([]);
  });

  it('denies AI roles every money, acceptance and authority action', () => {
    const deniedForAi: MutatingHubMethod[] = [
      'award',
      'accept_completion',
      'inspect_durability',
      'refund',
      'resolve_dispute',
      'record_score',
      'request_score',
      'set_role',
      'pause',
      'unpause',
      'set_outlayer_config',
      'dao_authorize',
      'cancel_work_order',
      'submit_completion',
      'start_work',
      'fund_work_order',
      'ft_on_transfer',
      'nft_transfer',
    ];
    for (const method of deniedForAi) {
      for (const ai of AI_SUBJECTS) {
        expect(isAllowed(method, ai), `${ai} must not ${method}`).toBe(false);
      }
    }
    // REVIEWER_AI and COORDINATOR_AI may only create drafts (coordinator).
    expect(isAllowed('create_work_order', 'COORDINATOR_AI')).toBe(true);
    expect(isAllowed('create_asset', 'COORDINATOR_AI')).toBe(true);
    expect(isAllowed('create_work_order', 'REVIEWER_AI')).toBe(false);
  });

  it('enforces contractor/inspector/steward/DAO/relayer boundaries', () => {
    for (const denied of [
      'accept_completion',
      'inspect_durability',
      'award',
      'refund',
      'resolve_dispute',
      'record_score',
    ] as const) {
      expect(isAllowed(denied, 'CONTRACTOR'), `contractor must not ${denied}`).toBe(false);
    }
    for (const denied of ['award', 'refund', 'resolve_dispute', 'set_role', 'record_score'] as const) {
      expect(isAllowed(denied, 'INSPECTOR'), `inspector must not ${denied}`).toBe(false);
    }
    // A steward proposes and awards but cannot perform the physical inspection.
    expect(isAllowed('award', 'STEWARD')).toBe(true);
    expect(isAllowed('accept_completion', 'STEWARD')).toBe(false);
    expect(isAllowed('inspect_durability', 'STEWARD')).toBe(false);

    // DAO authorizes policy and resolves disputes; it does not pick winners.
    expect(isAllowed('dao_authorize', 'DAO')).toBe(true);
    expect(isAllowed('resolve_dispute', 'DAO')).toBe(true);
    expect(isAllowed('award', 'DAO')).toBe(false);
    expect(isAllowed('accept_completion', 'DAO')).toBe(false);

    // Relayer is limited to the protocol allowlist.
    expect(isAllowed('commit_bid', 'RELAYER')).toBe(true);
    expect(isAllowed('reveal_bid', 'RELAYER')).toBe(true);
    expect(isAllowed('submit_completion', 'RELAYER')).toBe(true);
    for (const denied of ['award', 'refund', 'accept_completion', 'set_role', 'pause'] as const) {
      expect(isAllowed(denied, 'RELAYER'), `relayer must not ${denied}`).toBe(false);
    }

    // Anonymous callers and passports can never mutate value.
    for (const method of MUTATING_HUB_METHODS) {
      if (method === 'fund_work_order' || method === 'ft_on_transfer') continue;
      expect(isAllowed(method, 'ANON'), `anonymous caller must not ${method}`).toBe(false);
    }
    expect(isAllowed('nft_transfer', 'OWNER')).toBe(false);
    expect(ALLOWED.nft_transfer).toEqual([]);
  });

  it('declares every mutating endpoint present in the frozen OpenAPI document', () => {
    expect(API_MUTATIONS.map((operation) => operation.path).sort()).toEqual(mutatingOpenApiPaths().sort());
    const cells = apiMatrixCells();
    expect(cells.length).toBe(API_MUTATIONS.length * SUBJECTS.length);
    for (const cell of cells) expect(typeof cell.allowed).toBe('boolean');
  });

  it('keeps public report intake and quote preview free of authority', () => {
    const report = API_MUTATIONS.find((operation) => operation.path === '/v1/reports');
    expect(report?.allowed).toEqual([...SUBJECTS]);
    // Reporting is not authority: no report submission path may move money or
    // accept work, regardless of the caller's role.
    expect(report?.operationId).toBe('createReport');

    const quote = API_MUTATIONS.find((operation) => operation.path === '/v1/intents/quote');
    expect(quote?.allowed).toEqual(['SPONSOR', 'ADMIN']);
    for (const ai of AI_SUBJECTS) expect(quote?.allowed).not.toContain(ai);
    for (const financial of ['STEWARD', 'DAO', 'CONTRACTOR', 'INSPECTOR'] as const) {
      expect(quote?.allowed).not.toContain(financial);
    }
  });

  it('enforces every mutating API endpoint x every live role without creating records', async (ctx) => {
    const apiBase = process.env.MEND_API_URL ?? 'http://localhost:4000';
    const health = await fetchWithTimeout(`${apiBase}/health`, 2_000);
    if (!health?.ok) {
      ctx.skip(`SKIP: API at ${apiBase} is unreachable; live endpoint x role matrix cannot run`);
      return;
    }

    const results: Array<{ path: string; subject: string; status: number; expectedAllowed: boolean }> = [];
    for (const operation of API_MUTATIONS) {
      for (const subject of SUBJECTS) {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (subject !== 'ANON') {
          headers['x-mend-role'] = subject;
          headers['x-mend-account'] = accountFor(subject);
        }
        const response = await fetchWithTimeout(`${apiBase}${operation.path}`, 5_000, {
          method: 'POST',
          headers,
          body: '{}',
        });
        if (!response) continue;
        results.push({
          path: operation.path,
          subject,
          status: response.status,
          expectedAllowed: operation.allowed.includes(subject),
        });
      }
    }

    // An empty body must never create a record, for allowed or denied roles.
    expect(results.every((row) => row.status !== 201)).toBe(true);

    const mismatches = results.filter((row) => {
      if (row.expectedAllowed) return row.status === 401 || row.status === 403;
      return row.status !== 401 && row.status !== 403;
    });
    expect(mismatches).toEqual([]);

    for (const row of results) {
      if (['REVIEWER_AI', 'REPORTER', 'ORACLE', 'OWNER'].includes(row.subject)) {
        // Reports are intentionally walletless: every subject may submit a
        // report, but a malformed body must still be rejected without a record.
        if (row.path === '/v1/reports') {
          expect([400, 401, 403, 422]).toContain(row.status);
        } else {
          expect([401, 403], `${row.path} x ${row.subject}`).toContain(row.status);
        }
      }
    }
  });

  it('enforces every work-order action x every live role without mutating data', async (ctx) => {
    const apiBase = process.env.MEND_API_URL ?? 'http://localhost:4000';
    const health = await fetchWithTimeout(`${apiBase}/health`, 2_000);
    if (!health?.ok) {
      ctx.skip(`SKIP: API at ${apiBase} is unreachable; live work-order action matrix cannot run`);
      return;
    }

    const results: Array<{ action: string; subject: string; status: number; expectedAllowed: boolean }> = [];
    for (const [action, allowed] of Object.entries(LIVE_WORK_ORDER_ACTIONS)) {
      for (const subject of SUBJECTS) {
        const expectedAllowed = (allowed as readonly string[]).includes(subject);
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (subject !== 'ANON') {
          // ORACLE and OWNER are not API roles; the API must reject them.
          headers['x-mend-role'] = subject;
          headers['x-mend-account'] = accountFor(subject);
        }
        const response = await fetchWithTimeout(
          `${apiBase}/v1/work-orders/WO-DOES-NOT-EXIST-9999/actions/${action}`,
          5_000,
          { method: 'POST', headers, body: '{}' },
        );
        if (!response) continue;
        results.push({ action, subject, status: response.status, expectedAllowed });
      }
    }

    // No request may create/modify a work order: the target does not exist.
    expect(results.every((row) => row.status !== 200 && row.status !== 201 && row.status !== 202)).toBe(true);

    const mismatches = results.filter((row) => {
      if (row.expectedAllowed) return row.status === 401 || row.status === 403;
      return row.status !== 401 && row.status !== 403;
    });
    expect(mismatches).toEqual([]);

    // AI, reporter and unknown roles must never reach a mutation handler.
    for (const row of results) {
      if (['COORDINATOR_AI', 'REVIEWER_AI', 'REPORTER', 'ORACLE', 'OWNER'].includes(row.subject)) {
        expect([401, 403], `${row.action} x ${row.subject}`).toContain(row.status);
      }
    }
  });

});
