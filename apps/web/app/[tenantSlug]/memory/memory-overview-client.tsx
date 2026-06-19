'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Brain, GitBranch, Search } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { relationshipsApi } from '@/lib/api/relationships';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { formatRelativeTime } from '@/lib/utils';

export function MemoryOverviewClient({ tenantSlug }: { tenantSlug: string }) {
  const { tenantId } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.relationships.list(tenantId, 1),
    queryFn: () => relationshipsApi.list({ page: 1, limit: 25 }),
    staleTime: 60_000,
  });

  const relationships = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory Spaces"
        description="Open relationship memory timelines and AI insight panels."
        icon={Brain}
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : relationships.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No memory spaces yet"
          description="Create a relationship to start building an encrypted memory timeline."
          action={
            <Link
              href={ROUTES.tenantNewRelationship(tenantSlug)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              <GitBranch className="h-4 w-4" />
              Create Relationship
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {relationships.map((relationship) => (
            <Link
              key={relationship.id}
              href={ROUTES.tenantMemory(tenantSlug, relationship.id)}
              className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/40 hover:bg-muted/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {relationship.memo || 'Untitled relationship'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {formatRelativeTime(relationship.updatedAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-brand/10 p-2 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Brain className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                View timeline and stream AI insights
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
