'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GitBranch, Plus, Search, Filter, X } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { relationshipsApi } from '@/lib/api/relationships';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/layout/page-header';
import { RelationshipCard } from '@/components/relationships/relationship-card';
import { RelationshipCardSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { RelationshipStatus } from '@bondflow/types';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: Array<{ label: string; value: RelationshipStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Indexing', value: RelationshipStatus.PENDING_ON_CHAIN },
  { label: 'Active', value: RelationshipStatus.ACTIVE },
  { label: 'Completed', value: RelationshipStatus.COMPLETED },
  { label: 'Cancelled', value: RelationshipStatus.CANCELLED },
  { label: 'Failed', value: RelationshipStatus.FAILED_ON_CHAIN },
];

export function RelationshipsListClient({ tenantSlug }: { tenantSlug: string }) {
  const { tenantId } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RelationshipStatus>('ALL');
  const [scope, setScope] = useState<'workspace' | 'assigned'>('workspace');

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.relationships.list(tenantId, page), scope],
    queryFn: () => scope === 'assigned'
      ? relationshipsApi.listAssigned({ page, limit: 10 })
      : relationshipsApi.list({ page, limit: 10 }),
    staleTime: 60_000,
  });

  const relationships = data?.data ?? [];
  const filtered = relationships.filter((r) => {
    const matchesSearch =
      !search ||
      r.memo.toLowerCase().includes(search.toLowerCase()) ||
      r.recipientWallet.includes(search) ||
      r.payerWallet.includes(search);
    const matchesStatus = statusFilter === 'ALL'
      ? r.status !== RelationshipStatus.FAILED_ON_CHAIN
      : r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relationships"
        description="Manage your payment relationships"
        icon={GitBranch}
        actions={
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
            <div className={cn("relative transition-all duration-300 ease-in-out flex justify-end h-10", isSearchOpen ? "w-full sm:w-[260px] md:w-[320px]" : "w-10 hidden sm:flex")}>
              {isSearchOpen ? (
                <>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by memo..."
                    className="h-full w-full rounded-full border border-border bg-background py-2 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 shadow-sm transition-all"
                  />
                  <button 
                    onClick={() => { setIsSearchOpen(false); setSearch(''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full p-1 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-sm"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>
            <Link
              href={ROUTES.tenantNewRelationship(tenantSlug)}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Relationship
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => { setScope('workspace'); setPage(1); }}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all', scope === 'workspace' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            Workspace
          </button>
          <button
            onClick={() => { setScope('assigned'); setPage(1); }}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all', scope === 'assigned' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            Assigned to Me
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as typeof statusFilter)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                statusFilter === f.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <RelationshipCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={search || statusFilter !== 'ALL' ? 'No matching relationships' : 'No relationships yet'}
          description={
            search || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filters.'
              : scope === 'assigned'
                ? 'Relationships assigned to your wallet will appear here, even when you are not a workspace member.'
                : 'Create your first payment relationship to get started.'
          }
          action={
            !search && statusFilter === 'ALL' ? (
              <Link
                href={ROUTES.tenantNewRelationship(tenantSlug)}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                <Plus className="h-4 w-4" />
                Create Relationship
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((rel, i) => (
              <RelationshipCard key={rel.id} relationship={rel} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {(data?.pagination.total ?? 0) > 10 && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Showing {((page - 1) * 10) + 1}–{Math.min(page * 10, data?.pagination.total ?? 0)} of {data?.pagination.total ?? 0}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card transition-colors shadow-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 10 >= (data?.pagination.total ?? 0)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
