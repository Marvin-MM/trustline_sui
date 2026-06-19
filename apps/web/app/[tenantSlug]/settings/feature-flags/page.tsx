import { SettingsPageClient } from '../settings-client';

export const metadata = { title: 'Feature Flags' };

export default async function FeatureFlagsSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <SettingsPageClient tenantSlug={tenantSlug} initialTab="Feature Flags" />;
}
