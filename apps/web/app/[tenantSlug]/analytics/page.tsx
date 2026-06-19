import type { Metadata } from 'next';
import { AnalyticsPageClient } from './analytics-client';

export const metadata: Metadata = { title: 'Analytics' };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <AnalyticsPageClient tenantSlug={tenantSlug} />;
}
