/**
 * RBAC authorization middleware.
 * requirePermission(permission) returns a beforeHandle guard checking tenant role.
 * Platform admins bypass all RBAC checks.
 */

import { Elysia } from 'elysia';
import { Permission, ROLE_PERMISSIONS, PERSONAL_MODE_PERMISSIONS, TenantRole } from '@bondflow/types';
import { tenantMiddleware } from './tenant.middleware';
import type { AuthUser } from './auth.middleware';
import type { TenantCtx } from './tenant.middleware';
import { logger } from '../lib/logger';

const rbacLogger = logger.child({ module: 'rbac-middleware' });

export function hasPermission(auth: AuthUser | null, tenantContext: TenantCtx, permission: Permission): boolean {
  if (!auth) return false;
  if (auth.isPlatformAdmin) return true;
  if (tenantContext.isPersonalMode) return PERSONAL_MODE_PERMISSIONS.has(permission);
  if (!tenantContext.tenantRole) return false;
  return ROLE_PERMISSIONS[tenantContext.tenantRole as TenantRole]?.has(permission) ?? false;
}

export function permissionGuard(permission: Permission) {
  return (ctx: unknown) => {
    const { auth, tenantContext, set } = ctx as { auth: AuthUser | null; tenantContext: TenantCtx; set: { status: number | string } };
    if (!auth) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Authentication required', statusCode: 401 };
    }
    if (tenantContext.error) {
      set.status = 403;
      return { error: 'Forbidden', message: tenantContext.error, statusCode: 403 };
    }
    if (!hasPermission(auth, tenantContext, permission)) {
      rbacLogger.warn({ permission, role: tenantContext.tenantRole, personal: tenantContext.isPersonalMode }, 'Permission denied');
      set.status = 403;
      return { error: 'Forbidden', message: `Missing permission "${permission}"`, statusCode: 403 };
    }
    return undefined;
  };
}

export function ownerOnlyGuard() {
  return (ctx: unknown) => {
    const { auth, tenantContext, set } = ctx as { auth: AuthUser | null; tenantContext: TenantCtx; set: { status: number | string } };
    if (!auth) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Authentication required', statusCode: 401 };
    }
    if (auth.isPlatformAdmin) return;
    if (tenantContext.error) {
      set.status = 403;
      return { error: 'Forbidden', message: tenantContext.error, statusCode: 403 };
    }
    if (tenantContext.tenantRole !== TenantRole.OWNER) {
      set.status = 403;
      return { error: 'Forbidden', message: 'OWNER role required', statusCode: 403 };
    }
    return undefined;
  };
}

export function requirePermission(permission: Permission) {
  return new Elysia({ name: `rbac-${permission}` })
    .use(tenantMiddleware)
    .onBeforeHandle(permissionGuard(permission));
}
