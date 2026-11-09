import type { Metadata } from 'next';
import { ReportStatusClient } from './ReportStatusClient';

export const metadata: Metadata = {
  title: 'Private report status',
  description: 'Private status for a MEND report. The token stays in the link and is never shown publicly.',
};

export const dynamic = 'force-dynamic';

export default async function ReportStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: token } = await searchParams;
  return <ReportStatusClient token={token} />;
}
