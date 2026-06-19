import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = { title: 'Reputation' };

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  void tenantSlug;
  redirect(ROUTES.personalReputation());
}
