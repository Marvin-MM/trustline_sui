/**
 * Auth store — wallet session, JWT (memory only), and tenant context.
 *
 * Security rules:
 * - accessToken is stored IN MEMORY ONLY (Zustand state). Never localStorage, never sessionStorage.
 * - Refresh token is stored in an HttpOnly cookie set by the backend. This store never touches it.
 * - tenantPermissions is derived from tenantRole on setActiveTenant — never stored separately.
 */

import { create } from 'zustand';
import { Permission, TenantRole, ROLE_PERMISSIONS, PERSONAL_MODE_PERMISSIONS } from '@bondflow/types';

interface AuthState {
  // Wallet
  walletAddress: string | null;

  // JWT — in-memory ONLY
  accessToken: string | null;

  // Session
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  hasSessionBootstrapped: boolean;

  // User profile
  userId: string | null;
  isPlatformAdmin: boolean;

  // Tenant context
  tenantId: string | null;
  tenantSlug: string | null;
  tenantRole: TenantRole | null;
  tenantPermissions: ReadonlySet<Permission>;
  tenantName: string | null;

  // Actions
  setAuth: (params: {
    walletAddress: string;
    accessToken: string;
    userId: string;
    isPlatformAdmin: boolean;
  }) => void;
  updateAccessToken: (token: string) => void;
  clearAuth: () => void;
  setAuthenticating: (v: boolean) => void;
  setSessionBootstrapped: (v: boolean) => void;
  setActiveTenant: (params: {
    tenantId: string | null;
    tenantSlug: string | null;
    tenantRole: TenantRole | null;
    tenantName: string | null;
  }) => void;
  clearTenant: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  walletAddress: null,
  accessToken: null,
  isAuthenticated: false,
  isAuthenticating: false,
  hasSessionBootstrapped: false,
  userId: null,
  isPlatformAdmin: false,
  tenantId: null,
  tenantSlug: null,
  tenantRole: null,
  tenantPermissions: PERSONAL_MODE_PERMISSIONS,
  tenantName: null,

  setAuth: ({ walletAddress, accessToken, userId, isPlatformAdmin }) =>
    set({
      walletAddress,
      accessToken,
      userId,
      isPlatformAdmin,
      isAuthenticated: true,
      isAuthenticating: false,
      hasSessionBootstrapped: true,
    }),

  updateAccessToken: (token) =>
    set({ accessToken: token }),

  clearAuth: () =>
    set({
      walletAddress: null,
      accessToken: null,
      isAuthenticated: false,
      isAuthenticating: false,
      userId: null,
      isPlatformAdmin: false,
      tenantId: null,
      tenantSlug: null,
      tenantRole: null,
      tenantPermissions: PERSONAL_MODE_PERMISSIONS,
      tenantName: null,
      hasSessionBootstrapped: true,
    }),

  setAuthenticating: (v) => set({ isAuthenticating: v }),
  setSessionBootstrapped: (v) => set({ hasSessionBootstrapped: v }),

  setActiveTenant: ({ tenantId, tenantSlug, tenantRole, tenantName }) => {
    // Derive permissions from role. In personal mode (null role), use MEMBER-equivalent.
    const permissions =
      tenantRole !== null
        ? ROLE_PERMISSIONS[tenantRole]
        : PERSONAL_MODE_PERMISSIONS;

    set({ tenantId, tenantSlug, tenantRole, tenantPermissions: permissions, tenantName });
  },

  clearTenant: () =>
    set({
      tenantId: null,
      tenantSlug: null,
      tenantRole: null,
      tenantPermissions: PERSONAL_MODE_PERMISSIONS,
      tenantName: null,
    }),
}));
