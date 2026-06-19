import type { Metadata } from 'next';
import { RelationshipDetailClient } from '@/app/[tenantSlug]/relationships/[id]/relationship-detail-client';

export const metadata: Metadata = { title: 'Relationship Detail' };

export default async function PersonalRelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RelationshipDetailClient relationshipId={id} />;
}
