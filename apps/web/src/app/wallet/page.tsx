import type { Metadata } from 'next';
import { WalletConsole } from './WalletConsole';

export const metadata: Metadata = {
  title: 'Testnet wallet',
  description:
    'Create a NEAR testnet wallet, collect 100 test mUSDC from the MEND faucet and inspect balance and storage. LIVE TESTNET — TEST VALUE ONLY. MAINNET is never selectable.',
};

export default function WalletPage() {
  return <WalletConsole />;
}
