/**
 * Tenant resolution middleware.
 * Resolves X-Tenant-ID header, validates membership, attaches tenantContext globally.
 */

import { Elysia } from 'elysia';
import { prisma } from '../db/client';
import { authMiddleware } from './auth.middleware';
import type { TenantRole } from '@prisma/client';

export interface TenantCtx {
  tenantId: string | null;
  tenantRole: TenantRole | null;
  isPersonalMode: boolean;
  error?: string;
}

export const tenantMiddleware = new Elysia({ name: 'tenant-middleware' })
  .use(authMiddleware)
  .derive({ as: 'global' }, async ({ request, auth }): Promise<{ tenantContext: TenantCtx }> => {
    if (!auth) {
      return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true } };
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true } };
    }

    if (auth.isPlatformAdmin) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true, error: 'Tenant not found' } };
      }
      if (!tenant.isActive) {
        return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true, error: 'Tenant is inactive' } };
      }
      return {
        tenantContext: {
          tenantId,
          tenantRole: 'OWNER',
          isPersonalMode: false,
        },
      };
    }

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: auth.userId } },
      include: { tenant: true },
    });

    if (!tenantUser) {
      return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true, error: 'User is not a member of the requested tenant' } };
    }
    if (!tenantUser.tenant.isActive) {
      return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true, error: 'Tenant is inactive' } };
    }
    if (!tenantUser.acceptedAt) {
      return { tenantContext: { tenantId: null, tenantRole: null, isPersonalMode: true, error: 'Tenant invitation has not been accepted' } };
    }

    return {
      tenantContext: {
        tenantId: tenantUser.tenantId,
        tenantRole: tenantUser.role,
        isPersonalMode: false,
      },
    };
  })
  .onBeforeHandle((ctx: unknown) => {
    const { tenantContext, set } = ctx as { tenantContext: TenantCtx; set: { status: number | string } };
    if (tenantContext.error) {
      set.status = 403;
      return { error: 'Forbidden', message: tenantContext.error, statusCode: 403 };
    }
    return undefined;
  });
