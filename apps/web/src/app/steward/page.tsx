import type { Metadata } from 'next';
import { StewardConsole } from './StewardConsole';

export const metadata: Metadata = {
  title: 'Steward console',
  description:
    'Human steward scope, budget, DAO reference and deterministic award confirmation for MEND work orders.',
};

export default function StewardPage() {
  return <StewardConsole />;
}
