import { SettingsPageClient } from '../settings-client';

export const metadata = { title: 'Members' };

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <SettingsPageClient tenantSlug={tenantSlug} initialTab="Members" />;
}
