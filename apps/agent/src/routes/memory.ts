/**
 * Memory routes — read entries and generate AI insights.
 */

import { Elysia } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { permissionGuard } from '../middleware/rbac.middleware';
import { checkRateLimit, RateLimitTier } from '../lib/rate-limiter';
import { Permission } from '@bondflow/types';
import { memoryManagementService } from '../services/memory-management';

export const memoryRoutes = new Elysia({ prefix: '/api/v1/memory' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/:relationshipId', async ({ params, query, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const page = Math.max(1, parseInt(query['page'] ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query['limit'] ?? '50')));
    const result = await memoryManagementService.getMemory(auth, tenantContext.tenantId, params.relationshipId, page, limit);
    if (!result) { set.status = 404; return { error: 'Relationship not found' }; }
    return result;
  }, { beforeHandle: permissionGuard(Permission.MEMORY_READ) })

  .get('/:relationshipId/insights', async ({ params, query, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const rl = await checkRateLimit(auth.walletAddress, RateLimitTier.AI_PIPELINE);
    if (!rl.allowed) { set.status = 429; return { error: 'Rate limit exceeded', retryAfter: rl.retryAfter }; }
    const question = query['question'] ?? 'What is the overall health of this relationship?';
    const result = await memoryManagementService.getInsights(auth, tenantContext.tenantId, params.relationshipId, question);
    if (!result) { set.status = 404; return { error: 'Relationship not found' }; }
    return result;
  }, { beforeHandle: permissionGuard(Permission.MEMORY_READ) });
