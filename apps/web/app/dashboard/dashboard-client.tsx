'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Building2, Check, Mail, Plus, Shield, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { tenantsApi, type TenantMembershipDto } from '@/lib/api/tenants';
import { relationshipsApi } from '@/lib/api/relationships';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { MODAL_IDS, useUIStore } from '@/stores/ui.store';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { RelationshipCard } from '@/components/relationships/relationship-card';

const TENANT_STORAGE_KEY = 'bondflow:active-tenant';
const TENANT_SCOPED_QUERY_PREFIXES = [
  'relationships',
  'tenants',
  'feature-flags',
  'memory',
  'reputation',
  'agent-actions',
  'audit-log',
  'notifications',
];

function invalidateTenantScopedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    predicate: (q) => {
      const first = q.queryKey[0];
      return typeof first === 'string' && TENANT_SCOPED_QUERY_PREFIXES.includes(first);
    },
  });
}

export function PersonalDashboardClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantId, isPlatformAdmin, setActiveTenant } = useAuthStore();
  const { openModal } = useUIStore();

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: tenantsApi.list,
    staleTime: 60_000,
  });
  const { data: assigned, isLoading: assignedLoading } = useQuery({
    queryKey: queryKeys.relationships.assigned(1),
    queryFn: () => relationshipsApi.listAssigned({ page: 1, limit: 3 }),
    staleTime: 30_000,
  });
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: queryKeys.tenants.invitations(),
    queryFn: tenantsApi.listPendingInvitations,
    staleTime: 30_000,
  });
  const acceptInvitation = useMutation({
    mutationFn: (tenantIdToAccept: string) => tenantsApi.acceptInvitation(tenantIdToAccept),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.invitations() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.list() });
      toast.success('Workspace invitation accepted');
    },
    onError: () => toast.error('Could not accept invitation'),
  });
  const declineInvitation = useMutation({
    mutationFn: tenantsApi.declineInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.invitations() });
      toast.success('Invitation declined');
    },
    onError: () => toast.error('Could not decline invitation'),
  });

  const switchTenant = (membership: TenantMembershipDto) => {
    localStorage.setItem(TENANT_STORAGE_KEY, membership.tenantId);
    setActiveTenant({
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      tenantRole: membership.role,
      tenantName: membership.tenantName,
    });
    invalidateTenantScopedQueries(queryClient);
    router.push(ROUTES.tenantDashboard(membership.tenantSlug));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Personal"
        description="Your wallet-level inbox and relationships. Workspaces are optional team environments."
        actions={
          <button
            type="button"
            onClick={() => openModal(MODAL_IDS.CREATE_TENANT)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Create Workspace
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Access Profile</p>
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-brand" />
              {isPlatformAdmin && <Shield className="h-4 w-4 text-violet-500" />}
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            Personal <span className="text-base font-medium text-muted-foreground">/ {isPlatformAdmin ? 'Admin' : 'User'}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPlatformAdmin ? 'Platform-wide access enabled' : 'Wallet-scoped permissions'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Assigned Work</p>
            <BriefcaseBusiness className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{assignedLoading ? '—' : assigned?.pagination.total ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Relationships addressed to this wallet</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Workspaces</p>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{isLoading ? '—' : memberships.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available to this wallet</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Assigned to Me</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review requirements, upload deliverables, and follow payment verification.
            </p>
          </div>
          <Link
            href={ROUTES.personalRelationships()}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {assignedLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : (assigned?.data.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {assigned?.data.map((relationship, index) => (
              <RelationshipCard
                key={relationship.id}
                relationship={relationship}
                index={index}
                href={ROUTES.personalRelationshipDetail(relationship.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-6">
            <p className="text-sm font-medium text-foreground">No work has been assigned to this wallet yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You do not need to create or join a workspace. A relationship appears here automatically when its recipient address matches this wallet.
            </p>
          </div>
        )}
      </section>

      {(invitationsLoading || invitations.length > 0) && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Workspace Invitations</h2>
            <p className="mt-1 text-sm text-muted-foreground">Invitations are bound to this wallet and require your approval.</p>
          </div>
          {invitationsLoading ? (
            <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-brand/10 p-2 text-brand"><Mail className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{invitation.tenantName}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited as {invitation.role.toLowerCase()} by {invitation.invitedBy.slice(0, 10)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => declineInvitation.mutate(invitation.id)}
                      disabled={declineInvitation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => acceptInvitation.mutate(invitation.tenantId)}
                      disabled={acceptInvitation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces yet"
          description="That is okay. Personal relationships and assigned work are available above. Create a workspace only when you need shared team roles and controls."
          action={
            <button
              type="button"
              onClick={() => openModal(MODAL_IDS.CREATE_TENANT)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Your Workspaces</h2>
            {isPlatformAdmin && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                Platform admin view
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {memberships.map((membership) => {
              const selected = tenantId === membership.tenantId;
              return (
                <button
                  key={membership.tenantId}
                  type="button"
                  onClick={() => switchTenant(membership)}
                  className={cn(
                    'group rounded-xl border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-muted/30 hover:shadow-sm',
                    selected ? 'border-brand/50 ring-1 ring-brand/20' : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 font-semibold uppercase text-brand">
                        {membership.tenantName[0] ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{membership.tenantName}</p>
                        <p className="truncate text-xs text-muted-foreground">/{membership.tenantSlug}</p>
                      </div>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {membership.platformAdmin ? 'platform admin' : membership.role.toLowerCase()}
                    </span>
                    <span className="text-xs font-medium text-brand group-hover:underline">
                      Open workspace
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
