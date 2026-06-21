'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings, Users, Zap, Shield, Trash2, Plus, Crown, Eye, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { tenantsApi } from '@/lib/api/tenants';
import { featureFlagsApi } from '@/lib/api/feature-flags';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { AddressDisplay } from '@/components/blockchain/address-display';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useHasPermission } from '@/hooks/use-permission';
import { Permission, TenantRole, FEATURE_FLAG_CATALOG } from '@bondflow/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import { InviteMemberDialog } from '@/components/tenants/invite-member-dialog';

const TABS = ['General', 'Members', 'Feature Flags'] as const;
type Tab = typeof TABS[number];

const ROLE_ICONS = {
  [TenantRole.OWNER]: Crown,
  [TenantRole.ADMIN]: Shield,
  [TenantRole.MEMBER]: UserCog,
  [TenantRole.VIEWER]: Eye,
};

const ROLE_COLORS = {
  [TenantRole.OWNER]: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300',
  [TenantRole.ADMIN]: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
  [TenantRole.MEMBER]: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300',
  [TenantRole.VIEWER]: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400',
};

export function SettingsPageClient({ tenantSlug, initialTab = 'General' }: { tenantSlug: string; initialTab?: Tab }) {
  const queryClient = useQueryClient();
  const { tenantId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const canManageTenant = useHasPermission(Permission.TENANT_MANAGE);
  const canManageFeatureFlags = useHasPermission(Permission.FEATURE_FLAG_MANAGE);
  const canInviteMembers = useHasPermission(Permission.TENANT_MANAGE);
  const canRemoveMembers = useHasPermission(Permission.TENANT_MANAGE);

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.tenants.members(tenantId ?? ''),
    queryFn: () => tenantsApi.getMembers(tenantId!, { page: 1, limit: 50 }),
    enabled: !!tenantId && activeTab === 'Members',
    staleTime: 60_000,
  });

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: queryKeys.featureFlags.byTenant(tenantId),
    queryFn: featureFlagsApi.getAll,
    enabled: activeTab === 'Feature Flags',
    staleTime: 30_000,
  });

  const toggleFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      featureFlagsApi.update(key, enabled),
    onSuccess: (_, { key, enabled }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags.byTenant(tenantId) });
      toast.success(`${key.replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    },
    onError: () => toast.error('Failed to update feature flag'),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => tenantsApi.removeMember(tenantId!, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId ?? '') });
      toast.success('Member removed');
      setRemoveMemberTarget(null);
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const inviteMember = useMutation({
    mutationFn: (params: { walletAddress: string; role: TenantRole; email?: string }) =>
      tenantsApi.inviteMember(tenantId!, params),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId ?? '') });
      toast.success('Invitation created', {
        description: result.invitationDelivery.email === 'queued'
          ? 'The member can accept in TrustLine and will also receive an email.'
          : 'The invitation will appear when that wallet signs in to TrustLine.',
      });
      setInviteOpen(false);
    },
    onError: () => toast.error('Failed to invite member'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage workspace settings, members, and feature flags"
        icon={Settings}
      />

      {/* Tab nav */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'Members' && <Users className="h-3.5 w-3.5" />}
              {tab === 'Feature Flags' && <Zap className="h-3.5 w-3.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* General */}
      {activeTab === 'General' && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-lg">
          <h2 className="text-base font-semibold text-foreground">Workspace Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Workspace Name</p>
              <p className="text-sm font-medium text-foreground">{tenantSlug}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Workspace ID</p>
              <p className="font-mono-num text-xs text-muted-foreground">{tenantId}</p>
            </div>
          </div>
          {!canManageTenant && (
            <p className="text-xs text-muted-foreground italic">You don't have permission to modify settings.</p>
          )}
        </div>
      )}

      {/* Members */}
      {activeTab === 'Members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Members ({members?.pagination.total ?? '—'})</h2>
            {canInviteMembers && (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
              >
                <Plus className="h-4 w-4" />
                Invite Member
              </button>
            )}
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {members?.data.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role];
                return (
                  <motion.div
                    key={member.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                        {member.walletAddress.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <AddressDisplay address={member.walletAddress} truncate size="sm" />
                        {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                        <p className="text-xs text-muted-foreground">
                          {member.status === 'PENDING' ? 'Invited' : 'Joined'} {formatRelativeTime(member.joinedAt)}
                        </p>
                        {member.status === 'PENDING' && (
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-300">Invitation pending</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[member.role])}>
                        <RoleIcon className="h-3 w-3" />
                        {member.role.toLowerCase()}
                      </span>
                      {canRemoveMembers && member.role !== TenantRole.OWNER && (
                        <button
                          onClick={() => setRemoveMemberTarget(member.userId)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Feature Flags */}
      {activeTab === 'Feature Flags' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Feature Flags</h2>
          <p className="text-sm text-muted-foreground">
            Control which features are active for your workspace. Changes take effect immediately.
          </p>

          {flagsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(flags ?? []).map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {FEATURE_FLAG_CATALOG[flag.key as keyof typeof FEATURE_FLAG_CATALOG]?.label ?? flag.key.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {flag.description || FEATURE_FLAG_CATALOG[flag.key as keyof typeof FEATURE_FLAG_CATALOG]?.description}
                    </p>
                    <p className="font-mono-num text-xs text-muted-foreground">{flag.key}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag.mutate({ key: flag.key, enabled: !flag.enabled })}
                    disabled={!canManageFeatureFlags || toggleFlag.isPending}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors disabled:opacity-40',
                      flag.enabled ? 'bg-brand' : 'bg-muted'
                    )}
                    role="switch"
                    aria-checked={flag.enabled}
                    aria-label={`Toggle ${flag.key}`}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      flag.enabled && 'translate-x-5'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove member confirm */}
      <ConfirmDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
        title="Remove Member"
        description="This member will lose access to the workspace immediately. Their past activity will be preserved."
        confirmLabel="Remove"
        variant="destructive"
        loading={removeMember.isPending}
        onConfirm={() => {
          if (removeMemberTarget) removeMember.mutate(removeMemberTarget);
        }}
      />
      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        loading={inviteMember.isPending}
        onInvite={(params) => inviteMember.mutate(params)}
      />
    </div>
  );
}
