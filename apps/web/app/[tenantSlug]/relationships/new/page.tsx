import type { Metadata } from 'next';
import { CreateRelationshipClient } from './create-relationship-client';

export const metadata: Metadata = { title: 'New Relationship' };

export default async function NewRelationshipPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <CreateRelationshipClient tenantSlug={tenantSlug} />;
}
