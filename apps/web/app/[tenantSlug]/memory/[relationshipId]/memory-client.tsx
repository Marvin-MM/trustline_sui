'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Sparkles } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { memoryApi } from '@/lib/api/memory';
import { relationshipsApi } from '@/lib/api/relationships';
import { PageHeader } from '@/components/layout/page-header';
import { MemoryTimeline } from '@/components/memory/memory-timeline';
import { MemoryInsightPanel } from '@/components/memory/memory-insight-panel';
import { MemoryEntrySkeleton } from '@/components/ui/skeletons';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';

interface MemoryPageClientProps {
  tenantSlug: string;
  relationshipId: string;
}

export function MemoryPageClient({ tenantSlug, relationshipId }: MemoryPageClientProps) {
  const [insightOpen, setInsightOpen] = useState(false);

  const { data: relationship } = useQuery({
    queryKey: queryKeys.relationships.detail(relationshipId),
    queryFn: () => relationshipsApi.getById(relationshipId),
    staleTime: 60_000,
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: queryKeys.memory.all(relationshipId),
    queryFn: async () => {
      const first = await memoryApi.getEntries(relationshipId, { page: 1, limit: 50 });
      return first.data;
    },
    staleTime: 60_000,
    enabled: !!relationshipId,
  });

  const latestHealth = entries?.[0]?.relationshipHealth ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relationship Memory"
        description={relationship?.memo ?? 'Memory entries stored on Walrus'}
        icon={Brain}
        breadcrumbs={[
          { label: 'Relationships', href: ROUTES.tenantRelationships(tenantSlug) },
          { label: relationship?.memo ?? '...', href: ROUTES.tenantRelationshipDetail(tenantSlug, relationshipId) },
          { label: 'Memory' },
        ]}
        actions={
          <button
            onClick={() => setInsightOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <MemoryEntrySkeleton key={i} />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No memory entries yet"
          description="Memory entries are created automatically by the AI agent as activity occurs in this relationship."
        />
      ) : (
        <ComponentErrorBoundary>
          <MemoryTimeline entries={entries} />
        </ComponentErrorBoundary>
      )}

      {insightOpen && (
        <MemoryInsightPanel
          relationshipId={relationshipId}
          health={latestHealth}
          onClose={() => setInsightOpen(false)}
        />
      )}
    </div>
  );
}
