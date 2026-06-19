/**
 * Notification service for creating notifications via the outbox pattern.
 */

import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import type { NotificationType } from '@prisma/client';

const notifLogger = logger.child({ module: 'notification' });

export class NotificationService {
  /**
   * Create an outbox event that will be processed by the outbox worker.
   * This is called INSIDE a Prisma transaction alongside the state change.
   */
  static createOutboxEvent(params: {
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    payload: {
      recipientEmail: string;
      recipientWallet: string;
      notificationType: NotificationType;
      subject: string;
      bodyHtml: string;
      tenantId?: string | null;
      relationshipId?: string | null;
    };
  }) {
    return prisma.outboxEvent.create({
      data: {
        aggregateId: params.aggregateId,
        aggregateType: params.aggregateType,
        eventType: params.eventType,
        payload: params.payload as object,
      },
    });
  }

  /**
   * Create a notification record directly (for non-outbox use cases).
   */
  static async create(params: {
    recipientEmail: string;
    recipientWallet: string;
    notificationType: NotificationType;
    subject: string;
    bodyHtml: string;
    tenantId?: string | null;
    relationshipId?: string | null;
  }) {
    return prisma.notification.create({
      data: {
        recipientEmail: params.recipientEmail,
        recipientWallet: params.recipientWallet,
        notificationType: params.notificationType,
        subject: params.subject,
        bodyHtml: params.bodyHtml,
        provider: 'RESEND',
        tenantId: params.tenantId ?? null,
        relationshipId: params.relationshipId ?? null,
      },
    });
  }
}

export const notificationService = new NotificationService();
