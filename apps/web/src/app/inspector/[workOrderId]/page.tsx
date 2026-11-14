import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadCase } from '@/lib/server-api';
import { InspectorConsole } from './InspectorConsole';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}): Promise<Metadata> {
  const { workOrderId } = await params;
  const { caseData } = await loadCase(workOrderId);
  return {
    title: caseData ? `Inspector · ${caseData.assetId}` : 'Inspector console',
    description: 'Evidence checklist, AI completeness suggestions and human-only inspection decisions.',
  };
}

export default async function InspectorPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const { caseData, source, apiConfigured, fallbackReason } = await loadCase(workOrderId);
  if (!caseData) notFound();
  return (
    <InspectorConsole
      caseData={caseData}
      dataSource={source}
      apiConfigured={apiConfigured}
      fallbackReason={fallbackReason}
    />
  );
}
