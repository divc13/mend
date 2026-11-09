import type { Metadata } from 'next';
import { DemoRoom } from './DemoRoom';

export const metadata: Metadata = {
  title: 'Demo control room',
  description:
    'Select a recorded MEND scenario, reset the replay, fast-forward the timeline and inspect the environment mode. MAINNET is never selectable.',
};

export default function DemoPage() {
  return <DemoRoom />;
}
