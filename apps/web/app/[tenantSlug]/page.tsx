import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { TenantDashboardClient } from './tenant-dashboard-client';
import { StatsCardSkeleton } from '@/components/ui/skeletons';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Next.js 15: params must be awaited
export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const queryClient = getQueryClient();
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatsCardSkeleton key={i} />
              ))}
            </div>
          </div>
        }
      >
        <TenantDashboardClient tenantSlug={tenantSlug} />
      </Suspense>
    </HydrationBoundary>
  );
}
