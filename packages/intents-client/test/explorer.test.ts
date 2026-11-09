import { describe, expect, it } from 'vitest';
import { buildChainAddressLink, buildChainTxLink, buildIntentExplorerLink } from '../src/explorer.js';
import { MAINNET_ONLY_LABEL } from '../src/mainnet-guard.js';

describe('explorer link builders', () => {
  it('builds per-chain transaction links', () => {
    expect(buildChainTxLink('near', 'abc123')?.url).toBe('https://nearblocks.io/txns/abc123');
    expect(buildChainTxLink('eth', '0xdead')?.url).toBe('https://etherscan.io/tx/0xdead');
    expect(buildChainTxLink('base', '0xbeef')?.url).toBe('https://basescan.org/tx/0xbeef');
    expect(buildChainTxLink('arb', '0x1')?.url).toBe('https://arbiscan.io/tx/0x1');
    expect(buildChainTxLink('sol', 'sig')?.url).toBe('https://orb.helius.dev/tx/sig');
    expect(buildChainTxLink('btc', 'hash')?.url).toBe('https://mempool.space/tx/hash');
  });

  it('builds per-chain address links', () => {
    expect(buildChainAddressLink('near', 'mend.near')?.url).toBe('https://nearblocks.io/address/mend.near');
    expect(buildChainAddressLink('base', '0xabc')?.url).toBe('https://basescan.org/address/0xabc');
  });

  it('uses the API explorerUrl when it is non-empty', () => {
    expect(buildChainTxLink('near', 'abc', 'https://example.com/tx/abc')?.url).toBe('https://example.com/tx/abc');
    expect(buildChainAddressLink('near', 'abc', 'https://example.com/address/abc')?.url).toBe('https://example.com/address/abc');
  });

  it('falls back to the chain map when explorerUrl is an empty string', () => {
    expect(buildChainTxLink('near', 'abc', '')?.url).toBe('https://nearblocks.io/txns/abc');
    expect(buildChainTxLink('near', 'abc', '   ')?.url).toBe('https://nearblocks.io/txns/abc');
  });

  it('returns undefined for an unknown chain rather than inventing a link', () => {
    expect(buildChainTxLink('not-a-chain', 'abc')).toBeUndefined();
    expect(buildChainAddressLink('not-a-chain', 'abc')).toBeUndefined();
  });

  it('builds the 1Click swap explorer link with an optional memo', () => {
    const plain = buildIntentExplorerLink('0xabc');
    expect(plain.url).toBe('https://explorer.near-intents.org/transactions/0xabc');
    const withMemo = buildIntentExplorerLink('0xabc', 'MEMO 1');
    expect(withMemo.url).toBe('https://explorer.near-intents.org/transactions/0xabc?depositMemo=MEMO%201');
  });

  it('labels every link as mainnet-only', () => {
    expect(buildChainTxLink('near', 'abc')?.label).toBe(MAINNET_ONLY_LABEL);
    expect(buildIntentExplorerLink('0xabc').label).toBe(MAINNET_ONLY_LABEL);
  });
});
