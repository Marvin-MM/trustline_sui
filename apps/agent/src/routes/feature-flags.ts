/**
 * Tenant-scoped feature flag routes for regular frontend reads.
 * Platform-wide mutation remains under /api/v1/admin/feature-flags.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { permissionGuard } from '../middleware/rbac.middleware';
import { Permission } from '@bondflow/types';
import { featureFlagService } from '../services/feature-flags';

export const featureFlagRoutes = new Elysia({ prefix: '/api/v1/feature-flags' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/', async ({ auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    return featureFlagService.listForTenant(tenantContext.tenantId);
  }, { beforeHandle: permissionGuard(Permission.TENANT_READ) })

  .patch('/:key', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    if (body.enabled) {
      await featureFlagService.enable(params.key, tenantContext.tenantId);
    } else {
      await featureFlagService.disable(params.key, tenantContext.tenantId);
    }
    const flags = await featureFlagService.listForTenant(tenantContext.tenantId);
    return flags.find((flag) => flag.key === params.key) ?? { key: params.key, enabled: body.enabled, tenantId: tenantContext.tenantId };
  }, {
    beforeHandle: permissionGuard(Permission.FEATURE_FLAG_MANAGE),
    body: t.Object({ enabled: t.Boolean() }),
  });
