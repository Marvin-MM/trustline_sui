/**
 * Notification routes.
 *
 * Current transport is polling. The response schema is intentionally stable so
 * SSE can reuse it later via /api/v1/notifications/stream.
 */

import { Elysia } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { prisma } from '../db/client';

export const notificationRoutes = new Elysia({ prefix: '/api/v1/notifications' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const notifications = await prisma.notification.findMany({
      where: {
        recipientWallet: auth.walletAddress,
      },
      include: {
        relationship: { select: { suiObjectId: true } },
        tenant: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.notificationType,
      title: notification.subject,
      body: notification.bodyHtml.replace(/<[^>]*>/g, ''),
      isRead: notification.readAt !== null,
      metadata: {
        relationshipId: notification.relationshipId,
        relationshipObjectId: notification.relationship?.suiObjectId ?? null,
        tenantSlug: notification.tenant?.slug ?? null,
        provider: notification.provider,
        sent: notification.sent,
        sentAt: notification.sentAt,
        error: notification.error,
      },
      createdAt: notification.createdAt,
    }));
  })

  .patch('/:notificationId/read', async ({ params, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const updated = await prisma.notification.updateMany({
      where: { id: params.notificationId, recipientWallet: auth.walletAddress },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) { set.status = 404; return { error: 'Notification not found' }; }
    return { read: true };
  })

  .post('/read-all', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const updated = await prisma.notification.updateMany({
      where: { recipientWallet: auth.walletAddress, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  });
