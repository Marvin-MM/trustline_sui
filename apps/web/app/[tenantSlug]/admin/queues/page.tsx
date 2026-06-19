import { AdminPageClient } from '../admin-client';

export const metadata = { title: 'Queue Monitor' };

export default async function AdminQueuesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <AdminPageClient tenantSlug={tenantSlug} initialTab="Queue Monitor" />;
}
