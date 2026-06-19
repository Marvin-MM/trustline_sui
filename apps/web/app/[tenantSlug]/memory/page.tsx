import type { Metadata } from 'next';
import { MemoryOverviewClient } from './memory-overview-client';

export const metadata: Metadata = { title: 'Memory Spaces' };

export default async function MemoryOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <MemoryOverviewClient tenantSlug={tenantSlug} />;
}
