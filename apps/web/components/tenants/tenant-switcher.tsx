'use client';

import { useState, useEffect } from 'react';
import { ChevronsUpDown, Building2, User, Plus, Check, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/auth.store';
import { tenantsApi, type TenantMembershipDto } from '@/lib/api/tenants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { ROUTES } from '@/constants/routes';
import { TenantRole } from '@bondflow/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { MODAL_IDS, useUIStore } from '@/stores/ui.store';

const TENANT_STORAGE_KEY = 'bondflow:active-tenant';

const ROLE_COLORS: Record<TenantRole, string> = {
  [TenantRole.OWNER]: 'text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-900/30',
  [TenantRole.ADMIN]: 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30',
  [TenantRole.MEMBER]: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30',
  [TenantRole.VIEWER]: 'text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-800',
};

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

/**
 * TenantSwitcher — dropdown in the sidebar to switch between tenant workspaces.
 * Switching: updates Zustand, persists to localStorage, invalidates tenant queries, navigates.
 */
export function TenantSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantId, tenantName, tenantRole, isPlatformAdmin, setActiveTenant, clearTenant } = useAuthStore();
  const { openModal } = useUIStore();
  const [open, setOpen] = useState(false);

  const { data: memberships = [] } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: tenantsApi.list,
  });

  const { isMobile, openMobile, state } = useSidebar();

  useEffect(() => {
    if (isMobile && !openMobile) {
      setOpen(false);
    } else if (!isMobile && state === 'collapsed') {
      setOpen(false);
    }
  }, [isMobile, openMobile, state]);

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
    setOpen(false);
  };

  const switchToPersonal = () => {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    clearTenant();
    invalidateTenantScopedQueries(queryClient);
    router.push(ROUTES.dashboard());
    setOpen(false);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{tenantName ?? 'Personal'}</span>
                <span className="truncate text-xs text-muted-foreground capitalize">
                  {isPlatformAdmin && tenantId ? 'platform admin' : tenantRole ? tenantRole.toLowerCase() : 'wallet workspace'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            usePortal={false}
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Workspaces</DropdownMenuLabel>
            {isPlatformAdmin && (
              <div className="mx-2 mb-1 flex items-center gap-1.5 rounded-lg bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                <Shield className="h-3.5 w-3.5" />
                Platform admin view
              </div>
            )}

            {/* Personal mode */}
            <DropdownMenuItem
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted',
                !tenantId && 'bg-brand/10 text-brand'
              )}
              onSelect={switchToPersonal}
            >
              <User className="h-4 w-4 shrink-0" />
              <span className="flex-1">Personal</span>
              {!tenantId && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>

            {/* Tenant list */}
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.tenantId}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted',
                  tenantId === m.tenantId && 'bg-brand/10 text-brand'
                )}
                onSelect={() => switchTenant(m)}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-xs uppercase">
                  {m.tenantName[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{m.tenantName}</p>
                  <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', m.platformAdmin ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : ROLE_COLORS[m.role])}>
                    {m.platformAdmin ? 'platform admin' : m.role.toLowerCase()}
                  </span>
                </div>
                {tenantId === m.tenantId && <Check className="h-3.5 w-3.5 shrink-0" />}
              </DropdownMenuItem>
            ))}

            {memberships.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-sm font-medium text-foreground">No workspaces yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Your personal inbox still works without one.</p>
              </div>
            )}

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-muted"
              onSelect={() => { openModal(MODAL_IDS.CREATE_TENANT); setOpen(false); }}
            >
              <Plus className="h-4 w-4" />
              Create workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
