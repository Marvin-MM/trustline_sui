/**
 * Admin routes. Routes authorize and delegate operational work to AdminOperationsService.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOperationsService } from '../services/admin-operations';
import { logger } from '../lib/logger';

const aLogger = logger.child({ module: 'routes.admin' });

function requirePlatformAdmin(auth: { isPlatformAdmin: boolean } | null, set: { status?: number | string }) {
  if (!auth?.isPlatformAdmin) {
    set.status = 403;
    return { error: 'Admin access required' };
  }
  return undefined;
}

export const adminRoutes = new Elysia({ prefix: '/api/v1/admin' })
  .use(authMiddleware)

  .get('/queues', async ({ auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.getQueues();
  })

  .get('/queues/dlq', async ({ auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.getDlqJobs();
  })

  .post('/queues/dlq/:jobId/retry', async ({ params, body, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    const result = await adminOperationsService.retryDlqJob(auth!, params.jobId, body.queueName);
    if ('notFound' in result) { set.status = 404; return { error: 'Job not found' }; }
    return { message: 'Job requeued', jobId: result.jobId };
  }, { body: t.Object({ queueName: t.String() }) })

  .get('/transactions', async ({ auth, query, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.listTransactions(query);
  })

  .get('/feature-flags', async ({ auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.listFeatureFlags();
  })

  .post('/feature-flags', async ({ body, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    const result = await adminOperationsService.setFeatureFlag(auth!, body.key, body.enabled, body.tenantId);
    return { message: 'Feature flag set', key: result.key, enabled: result.enabled };
  }, { body: t.Object({ key: t.String(), enabled: t.Boolean(), description: t.String(), tenantId: t.Optional(t.String()) }) })

  .patch('/feature-flags/:key', async ({ params, body, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    await adminOperationsService.setFeatureFlag(auth!, params.key, body.enabled, body.tenantId);
    return { message: 'Feature flag updated' };
  }, { body: t.Object({ enabled: t.Boolean(), tenantId: t.Optional(t.String()) }) })

  .get('/prompts', async ({ auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.listPrompts();
  })

  .post('/prompts', async ({ body, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.createPrompt(auth!, body);
  }, { body: t.Object({ promptKey: t.String(), version: t.String(), content: t.String() }) })

  .patch('/prompts/:id/activate', async ({ params, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    const result = await adminOperationsService.activatePrompt(auth!, params.id);
    if ('notFound' in result) { set.status = 404; return { error: 'Prompt not found' }; }
    aLogger.info({ promptKey: result.promptKey, version: result.version }, 'Prompt activated');
    return { message: 'Prompt activated', promptKey: result.promptKey, version: result.version };
  })

  .get('/usage', async ({ auth, query, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.getUsage(query);
  })

  .get('/audit-log', async ({ auth, query, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    return adminOperationsService.getAuditLog(query);
  })

  .post('/events/replay', async ({ body, auth, set }) => {
    const denied = requirePlatformAdmin(auth, set);
    if (denied) return denied;
    const result = await adminOperationsService.replayEvents(body);
    return { message: `${result.count} events queued for replay`, count: result.count };
  }, { body: t.Object({ fromDate: t.Optional(t.String()), toDate: t.Optional(t.String()), eventTypes: t.Optional(t.Array(t.String())) }) });
