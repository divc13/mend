import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCase } from '@/lib/server-api';
import { BidRoom } from './BidRoom';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}): Promise<Metadata> {
  const { workOrderId } = await params;
  const { caseData } = await loadCase(workOrderId);
  return {
    title: caseData ? `Sealed bids · ${caseData.assetId}` : 'Sealed bid room',
    description: 'Sealed contractor offers, reveal status and deterministic score comparison.',
  };
}

export default async function BidsPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const { caseData, source, apiConfigured, fallbackReason } = await loadCase(workOrderId);
  if (!caseData) notFound();
  return (
    <BidRoom
      caseData={caseData}
      dataSource={source}
      apiConfigured={apiConfigured}
      fallbackReason={fallbackReason}
    />
  );
}
