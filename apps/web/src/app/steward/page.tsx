import type { Metadata } from 'next';
import { loadCases } from '@/lib/server-api';
import { StewardConsole } from './StewardConsole';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Steward console',
  description:
    'Human steward scope, budget, DAO reference and deterministic award confirmation for MEND work orders.',
};

export default async function StewardPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string | string[] }>;
}) {
  const { case: requestedCase } = await searchParams;
  const { cases, source, apiConfigured, fallbackReason } = await loadCases();
  const initialCaseId = Array.isArray(requestedCase) ? requestedCase[0] : requestedCase;

  return (
    <StewardConsole
      cases={cases}
      dataSource={source}
      apiConfigured={apiConfigured}
      fallbackReason={fallbackReason}
      initialCaseId={initialCaseId}
    />
  );
}
