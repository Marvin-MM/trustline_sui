import { AdminPageClient } from '../admin-client';

export const metadata = { title: 'Prompt Versions' };

export default async function AdminPromptsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <AdminPageClient tenantSlug={tenantSlug} initialTab="Prompt Management" />;
}
