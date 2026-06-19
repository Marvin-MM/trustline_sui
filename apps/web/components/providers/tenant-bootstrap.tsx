'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { tenantsApi } from '@/lib/api/tenants';
import type { TenantRole } from '@bondflow/types';

const TENANT_STORAGE_KEY = 'bondflow:active-tenant';
const PUBLIC_PATHS = new Set(['/', '/auth']);
const NON_TENANT_SEGMENTS = new Set(['', 'auth', 'dashboard']);
const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

/**
 * TenantBootstrap — restores tenant context on page refresh.
 *
 * On initial render after auth, reads the stored tenant ID from localStorage,
 * fetches tenant memberships, and sets the active tenant in Zustand.
 * This prevents a flash of wrong-tenant state on page reload.
 *
 * Renders no UI — purely a bootstrap effect.
 */
export function TenantBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    isAuthenticated,
    hasSessionBootstrapped,
    setAuth,
    clearAuth,
    setActiveTenant,
    setAuthenticating,
    setSessionBootstrapped,
    tenantSlug: activeTenantSlug,
  } = useAuthStore();

  useEffect(() => {
    const pathTenantSlug = getTenantSlugFromPath(pathname);
    const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    const needsTenantSync =
      hasSessionBootstrapped
      && isAuthenticated
      && (
        (pathTenantSlug && activeTenantSlug !== pathTenantSlug)
        || (!pathTenantSlug && isDashboardPath && activeTenantSlug)
      );
    if (hasSessionBootstrapped && !needsTenantSync) return;
    if (PUBLIC_PATHS.has(pathname)) {
      setSessionBootstrapped(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      setAuthenticating(true);

      try {
        let authenticated = isAuthenticated;

        if (!authenticated) {
          try {
            const refreshed = await refreshSession();
            if (cancelled) return;

            setAuth({
              walletAddress: refreshed.user.walletAddress,
              accessToken: refreshed.accessToken,
              userId: refreshed.user.id,
              isPlatformAdmin: refreshed.user.isPlatformAdmin,
            });
            authenticated = true;
          } catch {
            if (cancelled) return;
            clearAuth();
            return;
          }
        }

        if (!authenticated) return;

        const memberships = await tenantsApi.list();
        if (cancelled) return;

        const byPath = pathTenantSlug
          ? memberships.find((m) => m.tenantSlug === pathTenantSlug)
          : null;
        const storedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
        const byStoredTenant = storedTenantId
          ? memberships.find((m) => m.tenantId === storedTenantId)
          : null;
        const active = byPath ?? byStoredTenant ?? (pathTenantSlug ? memberships[0] : null);

        if (!active) {
          localStorage.removeItem(TENANT_STORAGE_KEY);
          setActiveTenant({ tenantId: null, tenantSlug: null, tenantRole: null, tenantName: null });
          return;
        }

        localStorage.setItem(TENANT_STORAGE_KEY, active.tenantId);
        setActiveTenant({
          tenantId: active.tenantId,
          tenantSlug: active.tenantSlug,
          tenantRole: active.role as TenantRole,
          tenantName: active.tenantName,
        });
      } finally {
        if (!cancelled) {
          setAuthenticating(false);
          setSessionBootstrapped(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clearAuth,
    activeTenantSlug,
    hasSessionBootstrapped,
    isAuthenticated,
    pathname,
    setActiveTenant,
    setAuth,
    setAuthenticating,
    setSessionBootstrapped,
  ]);

  return <>{children}</>;
}

function getTenantSlugFromPath(pathname: string): string | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  if (NON_TENANT_SEGMENTS.has(firstSegment)) return null;
  return firstSegment;
}

async function refreshSession(): Promise<{
  accessToken: string;
  user: {
    id: string;
    walletAddress: string;
    isPlatformAdmin: boolean;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Session refresh failed');
  }

  return response.json();
}
