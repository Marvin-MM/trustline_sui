/**
 * Outbox worker — polls OutboxEvent table every 5 seconds.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED for safe multi-instance processing.
 */

import { prisma } from '../db/client';
import { emailService } from '../services/email';
import { logger } from '../lib/logger';
import { tracer, SpanStatusCode } from '../tracing';
import type { NotificationType } from '@prisma/client';

const obLogger = logger.child({ module: 'outbox-worker' });
const POLL_INTERVAL_MS = 5000;
const MAX_FAILURES = 3;
const LOCK_MS = 60000;

interface OutboxEventRow {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: unknown;
}

interface OutboxPayload {
  recipientEmail: string;
  recipientWallet: string;
  notificationType: NotificationType;
  subject: string;
  bodyHtml: string;
  tenantId?: string;
  relationshipId?: string;
}

export class OutboxWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    obLogger.info('Outbox worker starting');
    this.backfillSkippedInAppNotifications().catch((error) =>
      obLogger.error({ error: (error as Error).message }, 'In-app notification backfill failed'),
    );
    this.intervalId = setInterval(() => {
      this.processOutbox().catch(err =>
        obLogger.error({ error: (err as Error).message }, 'Outbox processing failed'),
      );
    }, POLL_INTERVAL_MS);
  }

  private async backfillSkippedInAppNotifications(): Promise<void> {
    const skipped = await prisma.outboxEvent.findMany({
      where: { error: 'Skipped: recipient has no notification email' },
      orderBy: { createdAt: 'asc' },
    });
    for (const event of skipped) {
      const payload = event.payload as unknown as OutboxPayload;
      await prisma.notification.upsert({
        where: { sourceOutboxEventId: event.id },
        update: {},
        create: {
          sourceOutboxEventId: event.id,
          recipientEmail: payload.recipientEmail ?? '',
          recipientWallet: payload.recipientWallet,
          tenantId: payload.tenantId ?? null,
          relationshipId: payload.relationshipId ?? null,
          notificationType: payload.notificationType,
          subject: payload.subject,
          bodyHtml: payload.bodyHtml,
          provider: 'RESEND',
        },
      });
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { error: null },
      });
    }
    if (skipped.length > 0) {
      obLogger.info({ count: skipped.length }, 'Backfilled skipped in-app notifications');
    }
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    obLogger.info('Outbox worker stopped');
  }

  private async processOutbox(): Promise<void> {
    const span = tracer.startSpan('outbox.process');
    try {
      const events = await prisma.$transaction(async (tx) => {
      // Raw SQL: FOR UPDATE SKIP LOCKED — Prisma does not support this natively
      const rows = await tx.$queryRaw<OutboxEventRow[]>`
        SELECT id, "aggregateId", "aggregateType", "eventType", payload
        FROM "OutboxEvent"
        WHERE published = false
          AND error IS NULL
          AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
          AND "attemptCount" < ${MAX_FAILURES}
        ORDER BY "createdAt" ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length > 0) {
        await tx.outboxEvent.updateMany({
          where: { id: { in: rows.map(row => row.id) } },
          data: {
            lockedUntil: new Date(Date.now() + LOCK_MS),
            lastAttemptAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });
      }
      return rows;
    });

      for (const event of events) {
        try {
          const payload = event.payload as OutboxPayload;
          const notification = await prisma.notification.upsert({
            where: { sourceOutboxEventId: event.id },
            update: {},
            create: {
              sourceOutboxEventId: event.id,
              recipientEmail: payload.recipientEmail ?? '',
              recipientWallet: payload.recipientWallet,
              tenantId: payload.tenantId ?? null,
              relationshipId: payload.relationshipId ?? null,
              notificationType: payload.notificationType,
              subject: payload.subject,
              bodyHtml: payload.bodyHtml,
              provider: 'RESEND',
            },
          });
          if (!payload.recipientEmail) {
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                published: true,
                publishedAt: new Date(),
                lockedUntil: null,
                error: null,
              },
            });
            obLogger.info({ eventId: event.id }, 'In-app notification published without email delivery');
            continue;
          }

          await emailService.sendEmail({
            to: payload.recipientEmail,
            subject: payload.subject,
            html: payload.bodyHtml,
            recipientWallet: payload.recipientWallet,
            notificationType: payload.notificationType,
            notificationId: notification.id,
            tenantId: payload.tenantId ?? null,
            relationshipId: payload.relationshipId ?? null,
          });

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { published: true, publishedAt: new Date(), lockedUntil: null },
          });

          obLogger.debug({ eventId: event.id }, 'Outbox event published');
        } catch (error) {
          const current = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
          const count = current?.attemptCount ?? 1;

          if (count >= MAX_FAILURES) {
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { error: `Failed ${count} times: ${(error as Error).message}`, lockedUntil: null },
            });
            obLogger.error({ eventId: event.id, count }, 'Outbox event permanently failed — manual review required');
          } else {
            await prisma.outboxEvent.update({ where: { id: event.id }, data: { lockedUntil: null } });
            obLogger.warn({ eventId: event.id, count, error: (error as Error).message }, 'Outbox event failed, retrying');
          }
        }
      }
      span.setAttribute('bondflow.outbox.count', events.length);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}

export const outboxWorker = new OutboxWorker();
