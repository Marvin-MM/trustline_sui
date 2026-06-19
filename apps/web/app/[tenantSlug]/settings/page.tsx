import type { Metadata } from 'next';
import { SettingsPageClient } from './settings-client';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <SettingsPageClient tenantSlug={tenantSlug} />;
}
