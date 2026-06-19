import { AdminPageClient } from '../admin-client';

export const metadata = { title: 'Transaction Monitor' };

export default async function AdminTransactionsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <AdminPageClient tenantSlug={tenantSlug} initialTab="Transactions" />;
}
