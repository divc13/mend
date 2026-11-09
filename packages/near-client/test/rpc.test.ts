import { describe, expect, it } from 'vitest';
import { NearClientError, NearRpcClient, loadNearClientConfig } from '../src/index.js';
import type { RpcTransport, SignedTransactionRequest, TransactionSigner } from '../src/index.js';

class MockTransport implements RpcTransport {
  calls: Array<{ method: string; params: unknown }> = [];
  constructor(private readonly responder: (method: string, params: unknown) => unknown) {}

  async request(method: string, params: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    return this.responder(method, params);
  }
}

function queryResult(value: unknown) {
  return {
    jsonrpc: '2.0',
    id: 'test',
    result: {
      result: Array.from(Buffer.from(JSON.stringify(value), 'utf8')),
      logs: [],
      block_height: 123,
      block_hash: 'abc',
    },
  };
}

describe('near RPC client', () => {
  it('views a contract method using JSON-RPC call_function', async () => {
    const transport = new MockTransport(() => queryResult({ ok: true }));
    const client = new NearRpcClient(loadNearClientConfig({}), transport);
    const result = await client.view<{ ok: boolean }>('mend-hub.testnet', 'get_config', {});
    expect(result.value).toEqual({ ok: true });
    expect(result.blockHeight).toBe(123);
    expect(transport.calls[0]?.method).toBe('query');
  });

  it('blocks a real RPC view without the explicit live flag', async () => {
    const client = new NearRpcClient(loadNearClientConfig({}));
    await expect(client.view('mend-hub.testnet', 'get_config')).rejects.toMatchObject({
      code: 'LIVE_CALLS_DISABLED',
    });
  });

  it('surfaces RPC errors instead of inventing state', async () => {
    const transport = new MockTransport(() => ({
      jsonrpc: '2.0',
      id: 'test',
      result: { error: { message: 'ERR_NO_PROPOSAL' } },
    }));
    const client = new NearRpcClient(loadNearClientConfig({}), transport);
    await expect(client.view('mend-dao.sputnikv2.testnet', 'get_proposal', { id: 999 })).rejects.toThrow(
      NearClientError,
    );
  });

  it('reads access key lists for verification', async () => {
    const transport = new MockTransport(() => ({
      jsonrpc: '2.0',
      id: 'test',
      result: { keys: [], block_height: 5 },
    }));
    const client = new NearRpcClient(loadNearClientConfig({}), transport);
    const list = await client.viewAccessKeys('contractor-a.mend.testnet');
    expect(list).toEqual({ keys: [], block_height: 5 });
  });

  it('reads block height', async () => {
    const transport = new MockTransport(() => ({ jsonrpc: '2.0', id: 'test', result: { header: { height: 77 } } }));
    const client = new NearRpcClient(loadNearClientConfig({}), transport);
    await expect(client.blockHeight()).resolves.toBe(77);
  });

  it('never sends a transaction while live calls are disabled', async () => {
    const transport = new MockTransport(() => queryResult({}));
    const client = new NearRpcClient(loadNearClientConfig({}), transport);
    const signer: TransactionSigner = {
      accountId: 'coordinator-ai.mend.testnet',
      async signAndSend() {
        throw new Error('must not be called');
      },
    };
    await expect(
      client.call(
        {
          signerId: 'coordinator-ai.mend.testnet',
          receiverId: 'mend-hub.testnet',
          actions: [{ methodName: 'create_work_order', args: {}, gas: '30000000000000', deposit: '0' }],
        },
        signer,
      ),
    ).rejects.toMatchObject({ code: 'LIVE_CALLS_DISABLED' });
  });

  it('rejects deposit-bearing calls even when a signer is present', async () => {
    const client = new NearRpcClient(loadNearClientConfig({ MEND_LIVE_CALLS: '1' }), new MockTransport(() => queryResult({})));
    let called = false;
    const signer: TransactionSigner = {
      accountId: 'coordinator-ai.mend.testnet',
      async signAndSend(_request: SignedTransactionRequest) {
        called = true;
        return { transactionHash: 'x', success: true, logs: [] };
      },
    };
    await expect(
      client.call(
        {
          signerId: 'coordinator-ai.mend.testnet',
          receiverId: 'mend-hub.testnet',
          actions: [{ methodName: 'fund_work_order', args: {}, gas: '30000000000000', deposit: '1' }],
        },
        signer,
      ),
    ).rejects.toMatchObject({ code: 'KEY_NOT_ALLOWED' });
    expect(called).toBe(false);
  });

  it('rejects multiple actions for a function-call-key client', async () => {
    const client = new NearRpcClient(loadNearClientConfig({ MEND_LIVE_CALLS: '1' }), new MockTransport(() => queryResult({})));
    const signer: TransactionSigner = {
      accountId: 'coordinator-ai.mend.testnet',
      async signAndSend() {
        return { transactionHash: 'x', success: true, logs: [] };
      },
    };
    await expect(
      client.call(
        {
          signerId: 'coordinator-ai.mend.testnet',
          receiverId: 'mend-hub.testnet',
          actions: [
            { methodName: 'create_work_order', args: {}, gas: '30000000000000', deposit: '0' },
            { methodName: 'commit_bid', args: {}, gas: '30000000000000', deposit: '0' },
          ],
        },
        signer,
      ),
    ).rejects.toMatchObject({ code: 'KEY_NOT_ALLOWED' });
  });

  it('delegates a valid zero-deposit call to the external signer', async () => {
    const client = new NearRpcClient(loadNearClientConfig({ MEND_LIVE_CALLS: '1' }), new MockTransport(() => queryResult({})));
    const signer: TransactionSigner = {
      accountId: 'coordinator-ai.mend.testnet',
      async signAndSend(request: SignedTransactionRequest) {
        return { transactionHash: 'tx-1', success: true, logs: [`${request.actions.length} action`] };
      },
    };
    const result = await client.call(
      {
        signerId: 'coordinator-ai.mend.testnet',
        receiverId: 'mend-hub.testnet',
        actions: [{ methodName: 'create_work_order', args: {}, gas: '30000000000000', deposit: '0' }],
      },
      signer,
    );
    expect(result).toEqual({ transactionHash: 'tx-1', success: true, logs: ['1 action'] });
  });
});
