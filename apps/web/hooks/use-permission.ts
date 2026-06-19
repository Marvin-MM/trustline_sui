'use client';

import { useAuthStore } from '@/stores/auth.store';
import { Permission } from '@bondflow/types';

/**
 * Check if the current user has a specific permission.
 * Reads derived tenantPermissions from auth store.
 * Frontend enforcement is UX-only — backend is authoritative.
 *
 * Never call this in Server Components — client-only.
 */
export function useHasPermission(permission: Permission): boolean {
  const { tenantPermissions } = useAuthStore();
  return tenantPermissions.has(permission);
}

/**
 * Returns the full set of current permissions.
 */
export function usePermissions(): ReadonlySet<Permission> {
  return useAuthStore((s) => s.tenantPermissions);
}

/**
 * Throws an error if the user lacks the required permission.
 * Use in page-level components where the entire page is gated.
 */
export function useRequirePermission(permission: Permission): void {
  const has = useHasPermission(permission);
  if (!has) {
    throw new Error(`Insufficient permission: ${permission}`);
  }
}
