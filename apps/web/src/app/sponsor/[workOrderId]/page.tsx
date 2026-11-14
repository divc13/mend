import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCase } from '@/lib/server-api';
import { SponsorConsole } from './SponsorConsole';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}): Promise<Metadata> {
  const { workOrderId } = await params;
  const { caseData } = await loadCase(workOrderId);
  return {
    title: caseData ? `Sponsor · ${caseData.assetId}` : 'Sponsor & Intents',
    description: 'Intents quote, fees, deposit instructions and honest execution status. Dry quotes are not payments.',
  };
}

export default async function SponsorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const { caseData, source, apiConfigured, fallbackReason } = await loadCase(workOrderId);
  if (!caseData) notFound();
  return (
    <SponsorConsole
      caseData={caseData}
      dataSource={source}
      apiConfigured={apiConfigured}
      fallbackReason={fallbackReason}
    />
  );
}
