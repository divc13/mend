import { describe, expect, it } from 'vitest';
import {
  NearClientError,
  assertCannotCall,
  assertFunctionCallKeyRestricted,
  buildFunctionCallKeyPlan,
  findUnsafeAgentKeys,
  verifyFunctionCallKey,
} from '../src/index.js';
import type { AccessKeyList, AccessKeyView, FunctionCallKeySpec } from '../src/index.js';

const PUBLIC_KEY = 'ed25519:5BZbX1hYq8m9N2vR4tL7cK3pQ6sD8fG1jHaZxCvBnMq';
const ACCOUNT = 'contractor-a.mend.testnet';
const HUB = 'mend-hub.testnet';

function keyView(overrides: Partial<AccessKeyView['access_key']> = {}, permission = true): AccessKeyView {
  return {
    public_key: PUBLIC_KEY,
    access_key: {
      nonce: 1,
      permission: permission
        ? {
            FunctionCall: {
              allowance: '250000000000000000000000',
              receiver_id: HUB,
              method_names: ['commit_bid', 'reveal_bid', 'start_work', 'submit_completion'],
            },
          }
        : 'FullAccess',
      ...overrides,
    },
  };
}

describe('function-call key provisioning', () => {
  it('produces an explicit non-empty plan for a contractor', () => {
    const plan = buildFunctionCallKeyPlan({
      role: 'CONTRACTOR',
      accountId: ACCOUNT,
      publicKey: PUBLIC_KEY,
      receiverId: HUB,
      network: 'testnet',
    });
    expect(plan.spec.methodNames).toEqual(['commit_bid', 'reveal_bid', 'start_work', 'submit_completion']);
    expect(plan.json.permission.FunctionCall.receiver_id).toBe(HUB);
    expect(plan.commands.join('\n')).toContain('grant-function-call-access');
    expect(JSON.stringify(plan)).not.toMatch(/BEGIN (RSA |ED25519 )?PRIVATE KEY|"private_key"|"secretKey"/i);
  });

  it('does not give the reviewer agent an on-chain key', () => {
    expect(() =>
      buildFunctionCallKeyPlan({
        role: 'REVIEWER_AI',
        accountId: 'reviewer-ai.mend.testnet',
        publicKey: PUBLIC_KEY,
        receiverId: HUB,
        network: 'testnet',
      }),
    ).toThrow(NearClientError);
  });

  it('rejects mainnet, bad accounts and unbounded allowance', () => {
    expect(() =>
      buildFunctionCallKeyPlan({
        role: 'CONTRACTOR',
        accountId: ACCOUNT,
        publicKey: PUBLIC_KEY,
        receiverId: HUB,
        network: 'mainnet',
      }),
    ).toThrow(/mainnet/i);
    expect(() =>
      buildFunctionCallKeyPlan({
        role: 'CONTRACTOR',
        accountId: 'bad account',
        publicKey: PUBLIC_KEY,
        receiverId: HUB,
        network: 'testnet',
      }),
    ).toThrow(NearClientError);
    expect(() =>
      buildFunctionCallKeyPlan({
        role: 'CONTRACTOR',
        accountId: ACCOUNT,
        publicKey: PUBLIC_KEY,
        receiverId: HUB,
        network: 'testnet',
        allowanceNear: '5',
      }),
    ).toThrow(/cap/i);
  });

  it('accepts a correct restricted key and proves it cannot accept or release escrow', () => {
    const spec: FunctionCallKeySpec = {
      accountId: ACCOUNT,
      publicKey: PUBLIC_KEY,
      receiverId: HUB,
      methodNames: ['commit_bid', 'reveal_bid', 'start_work', 'submit_completion'],
      allowanceYocto: '250000000000000000000000',
      network: 'testnet',
    };
    const verification = verifyFunctionCallKey(keyView(), spec);
    expect(verification.ok).toBe(true);
    expect(verification.canReleaseEscrow).toBe(false);
    expect(() => assertCannotCall(verification, 'accept_completion')).not.toThrow();
    expect(() => assertCannotCall(verification, 'award')).not.toThrow();
  });

  it('rejects full-access keys', () => {
    const spec: FunctionCallKeySpec = {
      accountId: ACCOUNT,
      publicKey: PUBLIC_KEY,
      receiverId: HUB,
      methodNames: ['commit_bid'],
      allowanceYocto: '250000000000000000000000',
      network: 'testnet',
    };
    const verification = verifyFunctionCallKey(keyView({}, false), spec);
    expect(verification.ok).toBe(false);
    expect(verification.canReleaseEscrow).toBe(true);
    expect(() => assertFunctionCallKeyRestricted(keyView({}, false), spec)).toThrow(/restricted-key/);
  });

  it('rejects empty method lists, wrong receiver and unlimited allowance', () => {
    const spec: FunctionCallKeySpec = {
      accountId: ACCOUNT,
      publicKey: PUBLIC_KEY,
      receiverId: HUB,
      methodNames: ['commit_bid'],
      allowanceYocto: '250000000000000000000000',
      network: 'testnet',
    };
    const emptyMethods = keyView();
    const emptyFc = emptyMethods.access_key.permission;
    if (emptyFc !== 'FullAccess' && emptyFc.FunctionCall) emptyFc.FunctionCall.method_names = [];
    expect(verifyFunctionCallKey(emptyMethods, spec).violations.map((v) => v.code)).toContain('EMPTY_METHODS');

    const wrongReceiver = keyView();
    const wrongFc = wrongReceiver.access_key.permission;
    if (wrongFc !== 'FullAccess' && wrongFc.FunctionCall) wrongFc.FunctionCall.receiver_id = 'evil.testnet';
    expect(verifyFunctionCallKey(wrongReceiver, spec).violations.map((v) => v.code)).toContain('WRONG_RECEIVER');

    const unlimited = keyView();
    const unlimitedFc = unlimited.access_key.permission;
    if (unlimitedFc !== 'FullAccess' && unlimitedFc.FunctionCall) unlimitedFc.FunctionCall.allowance = null;
    expect(verifyFunctionCallKey(unlimited, spec).violations.map((v) => v.code)).toContain('UNLIMITED_ALLOWANCE');

    const acceptance = keyView();
    const acceptanceFc = acceptance.access_key.permission;
    if (acceptanceFc !== 'FullAccess' && acceptanceFc.FunctionCall) {
      acceptanceFc.FunctionCall.method_names = ['commit_bid', 'accept_completion'];
    }
    expect(verifyFunctionCallKey(acceptance, spec).violations.map((v) => v.code)).toContain('FORBIDDEN_METHOD');
  });

  it('flags any full-access key left on an agent account', () => {
    const list: AccessKeyList = { keys: [keyView({}, false), keyView()], block_height: 10 };
    const violations = findUnsafeAgentKeys(list);
    expect(violations.map((v) => v.code)).toContain('FULL_ACCESS_KEY_PRESENT');
  });
});
