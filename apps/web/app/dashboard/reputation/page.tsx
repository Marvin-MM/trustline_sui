import type { Metadata } from 'next';
import { ReputationPageClient } from '@/app/[tenantSlug]/reputation/reputation-client';

export const metadata: Metadata = {
  title: 'Wallet Reputation',
  description: 'Portable recipient reputation owned by your connected wallet.',
};

export default function PersonalReputationPage() {
  return <ReputationPageClient />;
}
