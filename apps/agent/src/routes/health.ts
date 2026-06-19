/**
 * Health check routes.
 */

import { Elysia } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { healthChecksService } from '../services/health-checks';

export const healthRoutes = new Elysia({ prefix: '/api/v1/health' })
  .use(authMiddleware)

  .get('/', () => healthChecksService.basic())

  .get('/detailed', async ({ auth, set }) => {
    if (!auth?.isPlatformAdmin) {
      set.status = 403;
      return { error: 'Platform admin access required' };
    }
    return healthChecksService.detailed();
  });
