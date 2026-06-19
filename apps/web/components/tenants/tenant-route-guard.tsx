'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/constants/routes';

export function TenantRouteGuard({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, hasSessionBootstrapped, tenantSlug: activeTenantSlug } = useAuthStore();

  useEffect(() => {
    if (!hasSessionBootstrapped) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.auth());
      return;
    }
    if (!activeTenantSlug) return;
    if (activeTenantSlug !== tenantSlug) {
      router.replace(ROUTES.tenantDashboard(activeTenantSlug));
    }
  }, [activeTenantSlug, hasSessionBootstrapped, isAuthenticated, router, tenantSlug]);

  if (!hasSessionBootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          Restoring session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
