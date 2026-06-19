'use client';

import { useAuthStore } from '@/stores/auth.store';
import type { TenantRole } from '@bondflow/types';

export interface TenantContext {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantRole: TenantRole | null;
  tenantName: string | null;
  isPersonalMode: boolean;
}

/**
 * The canonical hook for reading tenant context in client components.
 * Never read from the auth store directly — always use this hook.
 */
export function useTenant(): TenantContext {
  const { tenantId, tenantSlug, tenantRole, tenantName } = useAuthStore();
  return {
    tenantId,
    tenantSlug,
    tenantRole,
    tenantName,
    isPersonalMode: tenantId === null,
  };
}
