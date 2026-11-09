import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CASES, getCase } from '@/lib/fixtures';
import { InspectorConsole } from './InspectorConsole';

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
    title: caseData ? `Inspector · ${caseData.assetId}` : 'Inspector console',
    description: 'Evidence checklist, AI completeness suggestions and human-only inspection decisions.',
  };
}

export default async function InspectorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const caseData = getCase(workOrderId);
  if (!caseData) notFound();
  return <InspectorConsole caseData={caseData} />;
}
