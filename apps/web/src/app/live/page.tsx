import type { Metadata } from 'next';
import { LiveConsole } from './LiveConsole';

export const metadata: Metadata = {
  title: 'Live testnet run',
  description:
    'Run the MEND canonical scenario against NEAR testnet and inspect ordered steps with real transaction hashes. LIVE TESTNET — TEST VALUE ONLY. Replay is always available when live is not.',
};

export default function LivePage() {
  return <LiveConsole />;
}
