import { MAINNET_ONLY_LABEL } from './mainnet-guard.js';

/**
 * Explorer links. The live 1Click API returned empty `explorerUrl` values even
 * on SUCCESS, so MEND builds links itself from the chain code and hash.
 * Bases are taken from the verified 1Click explorer bundle (R0-C §8.2).
 */

export const EXPLORER_BASES: Record<string, { tx: string; address: string }> = {
  near: { tx: 'https://nearblocks.io/txns/', address: 'https://nearblocks.io/address/' },
  eth: { tx: 'https://etherscan.io/tx/', address: 'https://etherscan.io/address/' },
  base: { tx: 'https://basescan.org/tx/', address: 'https://basescan.org/address/' },
  arb: { tx: 'https://arbiscan.io/tx/', address: 'https://arbiscan.io/address/' },
  btc: { tx: 'https://mempool.space/tx/', address: 'https://mempool.space/address/' },
  sol: { tx: 'https://orb.helius.dev/tx/', address: 'https://orb.helius.dev/account/' },
  ton: { tx: 'https://tonscan.org/tx/', address: 'https://tonscan.org/address/' },
  doge: { tx: 'https://blockchair.com/dogecoin/transaction/', address: 'https://blockchair.com/dogecoin/address/' },
  xrp: { tx: 'https://xrpscan.com/tx/', address: 'https://xrpscan.com/account/' },
  zec: { tx: 'https://3xpl.com/zcash/transaction/', address: 'https://3xpl.com/zcash/address/' },
  gnosis: { tx: 'https://gnosisscan.io/tx/', address: 'https://gnosisscan.io/address/' },
  bera: { tx: 'https://beratrail.io/tx/', address: 'https://beratrail.io/address/' },
  bsc: { tx: 'https://bscscan.com/tx/', address: 'https://bscscan.com/address/' },
  pol: { tx: 'https://polygonscan.com/tx/', address: 'https://polygonscan.com/address/' },
  tron: { tx: 'https://tronscan.org/#/transaction/', address: 'https://tronscan.org/#/address/' },
  sui: { tx: 'https://suiscan.xyz/tx/', address: 'https://suiscan.xyz/address/' },
  op: { tx: 'https://optimistic.etherscan.io/tx/', address: 'https://optimistic.etherscan.io/address/' },
  avax: { tx: 'https://snowtrace.io/tx/', address: 'https://snowtrace.io/address/' },
  cardano: { tx: 'https://cardanoscan.io/transaction/', address: 'https://cardanoscan.io/address/' },
  stellar: { tx: 'https://stellar.expert/explorer/public/tx/', address: 'https://stellar.expert/explorer/public/account/' },
  aptos: { tx: 'https://explorer.aptoslabs.com/txn/', address: 'https://explorer.aptoslabs.com/account/' },
  ltc: { tx: 'https://blockchair.com/litecoin/transaction/', address: 'https://blockchair.com/litecoin/address/' },
  monad: { tx: 'https://monadscan.com/tx/', address: 'https://monadscan.com/address/' },
  xlayer: { tx: 'https://www.oklink.com/x-layer/tx/', address: 'https://www.oklink.com/x-layer/address/' },
  starknet: { tx: 'https://starkscan.co/tx/', address: 'https://starkscan.co/contract/' },
  bch: { tx: 'https://www.oklink.com/bch/tx/', address: 'https://www.oklink.com/bch/address/' },
  adi: { tx: 'https://explorer.adifoundation.ai/tx/', address: 'https://explorer.adifoundation.ai/address/' },
  plasma: { tx: 'https://plasmascan.to/tx/', address: 'https://plasmascan.to/address/' },
  scroll: { tx: 'https://scrollscan.com/tx/', address: 'https://scrollscan.com/address/' },
  aleo: { tx: 'https://explorer.provable.com/transaction/', address: 'https://explorer.provable.com/address/' },
  movement: { tx: 'https://explorer.movementnetwork.xyz/txn/', address: 'https://explorer.movementnetwork.xyz/account/' },
  dash: { tx: 'https://blockchair.com/dash/transaction/', address: 'https://blockchair.com/dash/address/' },
  hypercore: { tx: 'https://hypurrscan.io/evm/tx/', address: 'https://hypurrscan.io/address/' },
  fogo: { tx: 'https://fogoscan.com/tx/', address: 'https://fogoscan.com/account/' },
  miden: { tx: 'https://explorer.mainnet.miden.io/tx/', address: 'https://explorer.mainnet.miden.io/account/' },
  qtc: { tx: 'https://explorer.quantus.com/transactions/', address: 'https://explorer.quantus.com/accounts/' },
  prl: { tx: 'https://explorer.pearlresearch.ai/tx/', address: 'https://explorer.pearlresearch.ai/address/' },
  hood: { tx: 'https://robinhoodchain.blockscout.com/tx/', address: 'https://robinhoodchain.blockscout.com/address/' },
};

export const INTENTS_EXPLORER_BASE = 'https://explorer.near-intents.org/transactions/';

export interface ExplorerLink {
  url: string;
  /** Every 1Click explorer surface is mainnet-only. */
  label: typeof MAINNET_ONLY_LABEL;
  chain: string;
  kind: 'tx' | 'address' | 'intents-swap';
}

function nonEmpty(value: string | undefined | null): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Use the API-provided explorerUrl when populated; otherwise build from chain + hash. */
export function buildChainTxLink(chain: string, hash: string, apiExplorerUrl?: string | null): ExplorerLink | undefined {
  const provided = nonEmpty(apiExplorerUrl);
  if (provided) return { url: provided, label: MAINNET_ONLY_LABEL, chain, kind: 'tx' };
  const base = EXPLORER_BASES[chain.toLowerCase()]?.tx;
  if (!base) return undefined;
  return { url: `${base}${encodeURIComponent(hash)}`, label: MAINNET_ONLY_LABEL, chain, kind: 'tx' };
}

export function buildChainAddressLink(chain: string, address: string, apiExplorerUrl?: string | null): ExplorerLink | undefined {
  const provided = nonEmpty(apiExplorerUrl);
  if (provided) return { url: provided, label: MAINNET_ONLY_LABEL, chain, kind: 'address' };
  const base = EXPLORER_BASES[chain.toLowerCase()]?.address;
  if (!base) return undefined;
  return { url: `${base}${encodeURIComponent(address)}`, label: MAINNET_ONLY_LABEL, chain, kind: 'address' };
}

export function buildIntentExplorerLink(depositAddress: string, depositMemo?: string | null): ExplorerLink {
  const base = `${INTENTS_EXPLORER_BASE}${encodeURIComponent(depositAddress)}`;
  const memo = nonEmpty(depositMemo);
  return {
    url: memo ? `${base}?depositMemo=${encodeURIComponent(memo)}` : base,
    label: MAINNET_ONLY_LABEL,
    chain: 'near',
    kind: 'intents-swap',
  };
}
