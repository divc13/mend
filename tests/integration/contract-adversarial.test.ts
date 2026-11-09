import { describe, expect, it } from 'vitest';

import { commandAvailable, readRepoFile, run } from '../security/support/repo.js';

/**
 * T07.1 contract adversarial suite.
 *
 * The contract track already ships unit tests that drive the hub through
 * `near-sdk` mocking. This suite:
 *   1. records the exact Rust test that covers each required attack, and
 *      fails if that test disappears or stops passing;
 *   2. runs an independent crate (tests/integration/contract-adversarial) that
 *      imports the hub and calls only its public API, so the required attacks
 *      are not verified solely by the implementation author's own tests.
 *
 * `stale score` is the only item without a fully independent black-box test:
 * the public API never lets a caller mutate the revealed bid set after scoring,
 * so the contract's own `award_only_rank_one_and_stale_score_rejected` test is
 * the authoritative proof. The independent crate still proves wrong-policy,
 * wrong-WASM and rank-1-only refusals.
 */

const REQUIRED_ATTACKS: ReadonlyArray<{
  attack: string;
  hubTests: readonly string[];
  independentTests: readonly string[];
  note?: string;
}> = [
  {
    attack: 'self-approval',
    hubTests: ['ai_roles_cannot_award_accept_or_refund', 'role_and_dao_authorization_boundaries'],
    independentTests: [
      'wrong_policy_wrong_wasm_and_non_rank_one_award_are_rejected',
      'ai_roles_cannot_accept_or_release_funds',
    ],
  },
  {
    attack: 'contractor self-inspection',
    hubTests: ['contractor_cannot_inspect_own_work_and_inspector_must_be_rostered'],
    independentTests: ['contractor_cannot_inspect_or_accept_their_own_work'],
  },
  {
    attack: 'inspector self-award',
    hubTests: ['role_and_dao_authorization_boundaries'],
    independentTests: ['inspector_cannot_self_award_and_rosters_must_be_disjoint'],
  },
  {
    attack: 'replay / double payment',
    hubTests: [
      'happy_path_100_80_20_72_8_released',
      'dispute_refund_cannot_double_pay',
      'dispute_after_completion_refunds_held_holdback_once',
    ],
    independentTests: ['replay_and_double_payment_are_rejected', 'cancel_refund_cannot_double_pay'],
  },
  {
    attack: 'wrong token',
    hubTests: ['funding_rejects_wrong_token_msg_sponsor_and_paused_state'],
    independentTests: ['wrong_token_paused_and_replayed_funding_are_refunded_without_credit'],
  },
  {
    attack: 'stale score',
    hubTests: ['award_only_rank_one_and_stale_score_rejected'],
    independentTests: ['wrong_policy_wrong_wasm_and_non_rank_one_award_are_rejected'],
    note: 'stale bid-set mutation is not reachable through the public API after reveal; the contract test is authoritative',
  },
  {
    attack: 'wrong policy',
    hubTests: ['record_score_validates_policy_input_and_completeness', 'award_only_rank_one_and_stale_score_rejected'],
    independentTests: ['wrong_policy_wrong_wasm_and_non_rank_one_award_are_rejected'],
  },
  {
    attack: 'early / late reveal',
    hubTests: [
      'commit_and_reveal_validate_roster_duplicates_and_windows',
      'commit_after_deadline_and_early_close_fail',
    ],
    independentTests: ['early_and_late_reveals_and_early_close_are_rejected'],
  },
  {
    attack: 'pause bypass',
    hubTests: ['pause_blocks_mutations_and_unpause_restores_exact_state'],
    independentTests: ['pause_blocks_agent_actions_and_unpause_restores_the_same_state'],
  },
  {
    attack: 'passport transfer',
    hubTests: ['passport_transfers_and_approvals_always_fail'],
    independentTests: ['passport_transfer_and_approval_always_fail'],
  },
  {
    attack: 'warranty no-new-funds',
    hubTests: ['failed_durability_reopens_same_work_order_and_remediation_releases_holdback_once'],
    independentTests: ['warranty_reopening_creates_no_new_funds_and_releases_holdback_once'],
  },
];

const crateSource = readRepoFile('tests', 'integration', 'contract-adversarial', 'tests', 'attacks.rs');
const hubTests = readRepoFile('contracts', 'hub', 'src', 'tests.rs');
const cargoAvailable = commandAvailable('cargo');

function assertRustTestExists(source: string, name: string, where: string): void {
  const pattern = new RegExp(`fn\\s+${name}\\s*\\(`);
  expect(pattern.test(source), `missing Rust test ${name} in ${where}`).toBe(true);
}

function passedTestNames(output: string): Set<string> {
  const names = new Set<string>();
  for (const line of output.split('\n')) {
    const match = /^test\s+(\S+)\s+\.\.\.\s+ok$/.exec(line.trim());
    if (match?.[1]) names.add(match[1].split('::').pop() ?? match[1]);
  }
  return names;
}

describe('contract adversarial coverage map', () => {
  it('maps every required attack to an existing on-chain test', () => {
    expect(REQUIRED_ATTACKS.map((entry) => entry.attack)).toEqual([
      'self-approval',
      'contractor self-inspection',
      'inspector self-award',
      'replay / double payment',
      'wrong token',
      'stale score',
      'wrong policy',
      'early / late reveal',
      'pause bypass',
      'passport transfer',
      'warranty no-new-funds',
    ]);

    for (const entry of REQUIRED_ATTACKS) {
      for (const name of entry.hubTests) assertRustTestExists(hubTests, name, 'contracts/hub/src/tests.rs');
      for (const name of entry.independentTests) {
        assertRustTestExists(crateSource, name, 'tests/integration/contract-adversarial/tests/attacks.rs');
      }
      expect(entry.hubTests.length + entry.independentTests.length).toBeGreaterThan(0);
    }
  });

  it('runs the contract crate and all mapped tests pass', (ctx) => {
    if (!cargoAvailable) {
      ctx.skip('SKIP: cargo is not installed; cannot run the contract crate in this checkout');
      return;
    }
    const result = run('cargo', ['test', '--manifest-path', 'contracts/Cargo.toml', '--workspace'], 900_000);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, `cargo test failed:\n${output.slice(-8_000)}`).toBe(0);

    const passed = passedTestNames(output);
    for (const entry of REQUIRED_ATTACKS) {
      for (const name of entry.hubTests) {
        expect(passed.has(name), `mapped hub test did not pass: ${name}`).toBe(true);
      }
    }
    expect(output).toMatch(/test result: ok\. \d+ passed; 0 failed/);
  });

  it('runs the independent black-box adversarial crate and every attack passes', (ctx) => {
    if (!cargoAvailable) {
      ctx.skip('SKIP: cargo is not installed; cannot run the independent contract crate');
      return;
    }
    const result = run(
      'cargo',
      ['test', '--manifest-path', 'tests/integration/contract-adversarial/Cargo.toml'],
      900_000,
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, `independent contract tests failed:\n${output.slice(-8_000)}`).toBe(0);

    const passed = passedTestNames(output);
    const independentNames = new Set(REQUIRED_ATTACKS.flatMap((entry) => entry.independentTests));
    for (const name of independentNames) {
      expect(passed.has(name), `independent adversarial test did not pass: ${name}`).toBe(true);
    }
    expect(output).toMatch(/13 passed; 0 failed/);
  });
});
