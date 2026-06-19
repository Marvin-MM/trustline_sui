import type { Metadata } from 'next';
import { MemoryPageClient } from './memory-client';

export const metadata: Metadata = { title: 'Relationship Memory' };

export default async function MemoryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; relationshipId: string }>;
}) {
  const { tenantSlug, relationshipId } = await params;
  return <MemoryPageClient tenantSlug={tenantSlug} relationshipId={relationshipId} />;
}
