import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEFAULT_RPC_URL,
  HUB_ACCOUNT,
  LIVE_STATE_PATH,
  collectReferencedHashes,
  ftTransferEvents,
  readLiveState,
  txStatus,
  txSucceeded,
  viewCall,
} from './support.mjs';

const state = readLiveState();
const skip = state ? false : `BLOCKED: live-state.json not found at ${LIVE_STATE_PATH}`;
const rpcUrl = state?.rpcUrl ?? DEFAULT_RPC_URL;
const workOrderId = state?.workOrder?.workOrderId;
const assetId = state?.workOrder?.assetId ?? state?.asset?.assetId;
const options = { rpcUrl };

describe('NEAR testnet RPC verification of the deployed MEND lifecycle', () => {
  test('hub views match live-state.json and report CLOSED with exact escrow amounts', { skip, timeout: 120_000 }, async () => {
    const [workOrder, escrow, payments, warranty, asset, passport] = await Promise.all([
      viewCall(HUB_ACCOUNT, 'get_work_order', { work_order_id: workOrderId }, options),
      viewCall(HUB_ACCOUNT, 'get_escrow', { work_order_id: workOrderId }, options),
      viewCall(HUB_ACCOUNT, 'get_payments', { work_order_id: workOrderId }, options),
      viewCall(HUB_ACCOUNT, 'get_warranty', { work_order_id: workOrderId }, options),
      viewCall(HUB_ACCOUNT, 'get_asset', { asset_id: assetId }, options),
      viewCall(HUB_ACCOUNT, 'nft_token', { token_id: state.asset.passportTokenId }, options),
    ]);

    assert.equal(workOrder.ok, true);
    assert.equal(workOrder.value.id, workOrderId);
    assert.equal(workOrder.value.status, 'CLOSED');
    assert.equal(workOrder.value.funded, '100000000');
    assert.equal(workOrder.value.completionPaid, true);
    assert.equal(workOrder.value.holdbackReleased, true);

    assert.equal(escrow.ok, true);
    assert.equal(escrow.value.funding, '100000000');
    assert.equal(escrow.value.refunded, '20000000');
    assert.equal(escrow.value.completionPaid, '72000000');
    assert.equal(escrow.value.holdbackReleased, '8000000');
    assert.equal(escrow.value.escrowed, '0');
    assert.equal(escrow.value.holdbackHeld, '0');

    assert.equal(payments.ok, true);
    assert.equal(payments.value.length, 3);
    const byKind = Object.fromEntries(payments.value.map((payment) => [payment.kind, payment]));
    assert.equal(byKind.REFUND.amount, '20000000');
    assert.equal(byKind.REFUND.recipient, 'mend-sponsor.testnet');
    assert.equal(byKind.COMPLETION.amount, '72000000');
    assert.equal(byKind.COMPLETION.recipient, 'mend-contractor-b.testnet');
    assert.equal(byKind.HOLDBACK.amount, '8000000');
    assert.equal(byKind.HOLDBACK.recipient, 'mend-contractor-b.testnet');
    // The deployed hub records payments as PENDING because it cannot observe the
    // asynchronous NEP-141 receipt. The ft_transfer events below are the proof.
    for (const payment of payments.value) assert.equal(payment.status, 'PENDING');

    assert.equal(warranty.ok, true);
    assert.equal(warranty.value.workOrderId, workOrderId);
    assert.equal(warranty.value.workOrderState, 'CLOSED');
    assert.equal(warranty.value.state, 'NONE');
    assert.equal(warranty.value.reopenCount, 0);
    assert.equal(warranty.value.completionPaid, true);
    assert.equal(warranty.value.holdbackReleased, true);
    assert.equal(warranty.value.holdbackReleasedAmount, '8000000');
    assert.equal(warranty.value.holdbackHeld, '0');

    assert.equal(asset.ok, true);
    assert.equal(asset.value.id, assetId);
    assert.equal(asset.value.passportTokenId, state.asset.passportTokenId);
    assert.ok(asset.value.workOrderIds.includes(workOrderId));

    assert.equal(passport.ok, true);
    assert.equal(passport.value.token_id, state.asset.passportTokenId);
    assert.equal(passport.value.owner_id, HUB_ACCOUNT);

    // The on-chain values must match the deployment worker's evidence file.
    assert.equal(state.workOrder.status, workOrder.value.status);
    assert.equal(state.workOrder.escrow.funding, escrow.value.funding);
    assert.equal(state.workOrder.escrow.refunded, escrow.value.refunded);
    assert.equal(state.workOrder.escrow.completionPaid, escrow.value.completionPaid);
    assert.equal(state.workOrder.escrow.holdbackReleased, escrow.value.holdbackReleased);
    assert.equal(state.workOrder.warranty.state, warranty.value.state);
    assert.equal(state.workOrder.warranty.workOrderState, warranty.value.workOrderState);
    assert.equal(state.asset.passportOwner, passport.value.owner_id);
    assert.equal(state.asset.transferable, false);
  });

  test('every recorded transaction hash resolves successfully on testnet RPC', { skip, timeout: 240_000 }, async () => {
    const transactions = state.transactions ?? [];
    assert.ok(transactions.length >= 50, `expected the full lifecycle, found ${transactions.length} transactions`);

    const byHash = new Map(transactions.map((transaction) => [transaction.hash, transaction]));
    const referenced = collectReferencedHashes(state);
    for (const hash of referenced) {
      assert.ok(
        byHash.has(hash),
        `transaction ${hash} is referenced by live-state.json but has no signer metadata in transactions[]`,
      );
    }

    const queue = [...transactions];
    const verified = [];
    const failures = [];

    async function worker() {
      for (;;) {
        const transaction = queue.shift();
        if (!transaction) return;
        try {
          const result = await txStatus(transaction.hash, transaction.signer, options);
          if (!txSucceeded(result)) {
            failures.push(`${transaction.step} ${transaction.hash}: ${JSON.stringify(result.status)}`);
          } else {
            verified.push(transaction.hash);
          }
        } catch (error) {
          failures.push(`${transaction.step} ${transaction.hash}: ${error.message}`);
        }
      }
    }

    await Promise.all(Array.from({ length: 4 }, worker));

    assert.deepEqual(failures, [], `unresolved or failed testnet transactions:\n${failures.join('\n')}`);
    assert.equal(verified.length, transactions.length);
    assert.equal(new Set(verified).size, transactions.length);
    for (const hash of verified) {
      assert.match(hash, /^[1-9A-HJ-NP-Za-km-z]{32,88}$/);
    }
  });

  test('payment transactions emit the exact NEP-141 ft_transfer amounts', { skip, timeout: 120_000 }, async () => {
    const expected = [
      {
        label: 'refund',
        hash: state.workOrder.awardTx,
        sender: 'mend-steward.testnet',
        amount: '20000000',
        recipient: 'mend-sponsor.testnet',
      },
      {
        label: 'completion',
        hash: state.workOrder.completionAcceptTx,
        sender: 'mend-inspector.testnet',
        amount: '72000000',
        recipient: 'mend-contractor-b.testnet',
      },
      {
        label: 'holdback',
        hash: state.workOrder.durabilityTx,
        sender: 'mend-inspector-2.testnet',
        amount: '8000000',
        recipient: 'mend-contractor-b.testnet',
      },
    ];

    for (const item of expected) {
      const result = await txStatus(item.hash, item.sender, options);
      assert.ok(txSucceeded(result), `${item.label} transaction ${item.hash} did not succeed`);
      const transfers = ftTransferEvents(result);
      const match = transfers.find(
        (transfer) => transfer.amount === item.amount && transfer.new_owner_id === item.recipient,
      );
      assert.ok(
        match,
        `${item.label} transaction ${item.hash} did not emit ft_transfer ${item.amount} to ${item.recipient}; saw ${JSON.stringify(transfers)}`,
      );
      assert.equal(match.old_owner_id, HUB_ACCOUNT);
    }
  });

  test('the passport is owned by the hub and nft_transfer is rejected', { skip, timeout: 120_000 }, async () => {
    const token = await viewCall(HUB_ACCOUNT, 'nft_token', { token_id: state.asset.passportTokenId }, options);
    assert.equal(token.ok, true);
    assert.equal(token.value.owner_id, HUB_ACCOUNT);
    assert.equal(token.value.token_id, state.asset.passportTokenId);

    // A view call executes the contract method read-only. nft_transfer panics
    // before writing, so the RPC returns a contract error and no transfer.
    const transfer = await viewCall(
      HUB_ACCOUNT,
      'nft_transfer',
      { receiver_id: 'mend-sponsor.testnet', token_id: state.asset.passportTokenId },
      { ...options, allowFailure: true },
    );
    assert.equal(transfer.ok, false, 'nft_transfer must not succeed');
    assert.match(
      transfer.error,
      /wasm execution failed|WasmTrap|TRANSFER_DISABLED|non-transferable/i,
      `unexpected nft_transfer error: ${transfer.error}`,
    );

    const after = await viewCall(HUB_ACCOUNT, 'nft_token', { token_id: state.asset.passportTokenId }, options);
    assert.equal(after.value.owner_id, HUB_ACCOUNT);
  });
});
