'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, Search, X } from 'lucide-react';
import { relationshipsApi } from '@/lib/api/relationships';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { RelationshipCard } from '@/components/relationships/relationship-card';
import { RelationshipCardSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

export function AssignedRelationshipsClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.relationships.assigned(page),
    queryFn: () => relationshipsApi.listAssigned({ page, limit: 10 }),
    staleTime: 30_000,
  });

  const relationships = (data?.data ?? []).filter((relationship) => {
    const term = search.trim().toLowerCase();
    return !term
      || relationship.memo.toLowerCase().includes(term)
      || relationship.payerWallet.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned to Me"
        description="Work and payment milestones assigned directly to your wallet. No workspace membership is required."
        icon={BriefcaseBusiness}
        actions={
          <div className="flex items-center justify-end h-10">
            <div className={cn("relative transition-all duration-300 ease-in-out flex justify-end", isSearchOpen ? "w-[280px] sm:w-[320px]" : "w-10")}>
              {isSearchOpen ? (
                <>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by memo or wallet..."
                    className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 shadow-sm transition-all"
                  />
                  <button 
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearch('');
                    }}
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
          </div>
        }
      />

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-muted-foreground">
        Open a relationship to review its requirements and upload proof for deliverable milestones.
        Completion attestations are minted automatically when a milestone is released; recipients do not mint them manually.
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <RelationshipCardSkeleton key={index} />)}
        </div>
      ) : relationships.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={search ? 'No matching assignments' : 'Nothing assigned yet'}
          description={search
            ? 'Try a different memo or payer wallet.'
            : 'When someone creates a TrustLine relationship using this wallet as the recipient, it will appear here automatically.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {relationships.map((relationship, index) => (
              <RelationshipCard
                key={relationship.id}
                relationship={relationship}
                index={index}
                href={ROUTES.personalRelationshipDetail(relationship.id)}
              />
            ))}
          </div>
          {(data?.pagination.total ?? 0) > 10 && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Page {page} of {data?.pagination.totalPages ?? 1}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-card transition-colors shadow-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={page >= (data?.pagination.totalPages ?? 1)}
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
