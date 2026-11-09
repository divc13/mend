import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CASES, getCase } from '@/lib/fixtures';
import { BidRoom } from './BidRoom';

export function generateStaticParams() {
  return CASES.map((item) => ({ workOrderId: item.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}): Promise<Metadata> {
  const { workOrderId } = await params;
  const caseData = getCase(workOrderId);
  return {
    title: caseData ? `Sealed bids · ${caseData.assetId}` : 'Sealed bid room',
    description: 'Sealed contractor offers, reveal status and deterministic score comparison.',
  };
}

export default async function BidsPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const caseData = getCase(workOrderId);
  if (!caseData) notFound();
  return <BidRoom caseData={caseData} />;
}
