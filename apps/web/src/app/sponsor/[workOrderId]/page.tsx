import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CASES, getCase } from '@/lib/fixtures';
import { SponsorConsole } from './SponsorConsole';

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
    title: caseData ? `Sponsor · ${caseData.assetId}` : 'Sponsor & Intents',
    description: 'Intents quote, fees, deposit instructions and honest execution status. Dry quotes are not payments.',
  };
}

export default async function SponsorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const caseData = getCase(workOrderId);
  if (!caseData) notFound();
  return <SponsorConsole caseData={caseData} />;
}
