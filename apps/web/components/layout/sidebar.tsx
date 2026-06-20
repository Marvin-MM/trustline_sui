'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  Brain,
  Star,
  BarChart3,
  Shield,
  ListTodo,
  Plus,
  Zap,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useHasPermission } from '@/hooks/use-permission';
import { Permission, TenantRole } from '@bondflow/types';
import { ROUTES } from '@/constants/routes';
import { TenantSwitcher } from '@/components/tenants/tenant-switcher';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: Permission;
  allowPlatformAdmin?: boolean;
  exactMatch?: boolean;
}

function NavGroup({ title, items }: { title?: string; items: NavItem[] }) {
  const pathname = usePathname();
  const { isPlatformAdmin } = useAuthStore();
  const getPermission = useHasPermission; // Cannot call hook in loop directly, so handled differently.

  // Filter items based on permissions
  const visibleItems = items.filter((item) => {
    // Note: To properly use hooks, we should render NavItemComponent which calls useHasPermission internally.
    return true; // We'll let the individual NavLink components handle returning null if they don't have permission.
  });

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup>
      {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const hasPermission = useHasPermission(item.requiredPermission ?? Permission.RELATIONSHIP_READ);
  const { isPlatformAdmin } = useAuthStore();

  if (item.requiredPermission && !hasPermission && !(item.allowPlatformAdmin && isPlatformAdmin)) {
    return null;
  }

  const isActive = item.exactMatch
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link href={item.href}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { tenantSlug, tenantRole, isAuthenticated, isPlatformAdmin, hasSessionBootstrapped } = useAuthStore();
  const canCreateRelationship = useHasPermission(Permission.RELATIONSHIP_CREATE);

  const isTenantAdmin = tenantRole === TenantRole.ADMIN || tenantRole === TenantRole.OWNER;
  const hasTenant = Boolean(tenantSlug);

  const mainNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: tenantSlug ? ROUTES.tenantDashboard(tenantSlug) : ROUTES.dashboard(),
      icon: LayoutDashboard,
      exactMatch: true,
    },
    ...(tenantSlug
      ? [
          {
            label: 'Relationships',
            href: ROUTES.tenantRelationships(tenantSlug),
            icon: GitBranch,
            requiredPermission: Permission.RELATIONSHIP_READ,
          },
          {
            label: 'Memory',
            href: ROUTES.tenantMemoryOverview(tenantSlug),
            icon: Brain,
            requiredPermission: Permission.MEMORY_READ,
          },
          {
            label: 'Analytics',
            href: ROUTES.tenantAnalytics(tenantSlug),
            icon: BarChart3,
            requiredPermission: Permission.USAGE_READ,
          },
        ]
      : [
          {
            label: 'Assigned to Me',
            href: ROUTES.personalRelationships(),
            icon: ListTodo,
            requiredPermission: Permission.RELATIONSHIP_READ,
          },
          {
            label: 'Reputation',
            href: ROUTES.personalReputation(),
            icon: Star,
            requiredPermission: Permission.REPUTATION_READ,
          },
        ]),
  ];

  const settingsNavItems: NavItem[] = tenantSlug
    ? [
        {
          label: 'Settings',
          href: ROUTES.tenantSettings(tenantSlug),
          icon: Settings2,
          requiredPermission: Permission.TENANT_MANAGE,
        },
      ]
    : [];

  const adminNavItems: NavItem[] = tenantSlug
    ? [
        {
          label: 'Admin',
          href: ROUTES.tenantAdmin(tenantSlug),
          icon: Shield,
          requiredPermission: Permission.ADMIN_PANEL,
          allowPlatformAdmin: true,
        },
      ]
    : [];

  const showSettingsSection = hasTenant && isTenantAdmin;
  const showAdminSection = hasTenant && isPlatformAdmin;

  if (!hasSessionBootstrapped || !isAuthenticated) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="group/header relative flex h-12 items-center px-1 mb-2">
          {/* Logo container, hidden when collapsed */}
          <Link href="/" className="flex flex-1 items-center gap-2 overflow-hidden transition-all duration-300 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:w-0 pl-1">
            <Image 
              src="/logos/trustline-logo.png" 
              alt="Trustline Logo" 
              width={120} 
              height={28} 
              className="object-contain" 
            />
          </Link>
          
          {/* The Sidebar toggle. Sits at the end of the header when expanded, or centered when collapsed. */}
          <div className="group/logo-toggle flex shrink-0 items-center justify-center group-data-[state=collapsed]:w-full group-data-[state=expanded]:w-auto group-data-[state=collapsed]:absolute group-data-[state=collapsed]:inset-0">
            {/* The Logo when collapsed */}
            <Link href="/" className="flex items-center justify-center group-data-[state=expanded]:hidden absolute inset-0 opacity-100 transition-opacity duration-200 group-hover/logo-toggle:opacity-0 z-10">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg shadow-sm">
                <Image 
                  src="/logos/turstline-logo-1.png" 
                  alt="Trustline Icon" 
                  width={24} 
                  height={24} 
                  className="object-contain" 
                />
              </div>
            </Link>
            
            {/* The Trigger button */}
            <SidebarTrigger className="z-20 transition-opacity duration-200 group-data-[state=collapsed]:opacity-0 group-hover/logo-toggle:!opacity-100 group-data-[state=expanded]:opacity-40 group-data-[state=expanded]:hover:!opacity-100" />
          </div>
        </div>
        
        <div className="mt-2 px-1">
          <TenantSwitcher />
        </div>

        {tenantSlug && canCreateRelationship && (
          <SidebarMenu className="mt-2 px-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="New Relationship"
                className="bg-brand text-white hover:bg-brand/90 hover:text-white active:bg-brand/80 active:text-white data-[state=open]:hover:bg-brand/90 data-[state=open]:hover:text-white"
              >
                <Link href={ROUTES.tenantNewRelationship(tenantSlug)}>
                  <Plus />
                  <span>New Relationship</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

      </SidebarHeader>

      <SidebarContent>
        <NavGroup items={mainNavItems} />
      </SidebarContent>

      <SidebarFooter>
        {(showSettingsSection || showAdminSection) && (
          <SidebarMenu>
            {showAdminSection && adminNavItems.map(item => <NavLink key={item.href} item={item} />)}
            {showSettingsSection && settingsNavItems.map(item => <NavLink key={item.href} item={item} />)}  
          </SidebarMenu>
        )}
        {/* You can add UserNav or other footer elements here in the future */}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Export the old name for backward compatibility during migration, though we can change imports.
export { AppSidebar as Sidebar };
