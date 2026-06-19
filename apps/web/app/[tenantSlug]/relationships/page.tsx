import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { RelationshipsListClient } from './relationships-client';
import { RelationshipCardSkeleton } from '@/components/ui/skeletons';

export const metadata: Metadata = { title: 'Relationships' };

export default async function RelationshipsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <RelationshipCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <RelationshipsListClient tenantSlug={tenantSlug} />
      </Suspense>
    </HydrationBoundary>
  );
}
