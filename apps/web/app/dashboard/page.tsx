import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { PersonalDashboardClient } from './dashboard-client';
import { StatsCardSkeleton } from '@/components/ui/skeletons';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your BondFlow personal dashboard.',
};

export default async function PersonalDashboardPage() {
  // Server-side prefetch would go here once auth middleware is in place.
  // For now the client fetches via useQuery with the session cookie.
  const queryClient = getQueryClient();
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <PersonalDashboardClient />
      </Suspense>
    </HydrationBoundary>
  );
}
