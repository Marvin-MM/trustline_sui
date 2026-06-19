import type { Metadata } from 'next';
import { AdminPageClient } from './admin-client';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <AdminPageClient tenantSlug={tenantSlug} />;
}
