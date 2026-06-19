/**
 * BullMQ worker for notification dispatch.
 * Dead letter queue: notifications-dlq.
 */

import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { emailService } from '../services/email';
import { logger } from '../lib/logger';
import { queueDepthGauge, queueFailedCounter } from '../tracing';
import type { NotificationType } from '@prisma/client';

const nLogger = logger.child({ module: 'notifications-worker' });

function bullMqConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const dlq = new Queue('notifications-dlq', { connection: bullMqConnection() });

export const notificationsQueue = new Queue('notifications', {
  connection: bullMqConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

queueDepthGauge.addCallback(async (observableResult) => {
  const counts = await notificationsQueue.getJobCounts('waiting', 'delayed', 'active');
  observableResult.observe((counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0), { queue_name: 'notifications' });
});

interface NotificationJobData {
  recipientEmail: string;
  recipientWallet: string;
  subject: string;
  bodyHtml: string;
  notificationType: NotificationType;
  tenantId?: string;
  relationshipId?: string;
}

export function startNotificationsWorker(): Worker {
  const worker = new Worker('notifications', async (job) => {
    const data = job.data as NotificationJobData;
    await emailService.sendEmail({
      to: data.recipientEmail,
      subject: data.subject,
      html: data.bodyHtml,
      recipientWallet: data.recipientWallet,
      notificationType: data.notificationType,
      tenantId: data.tenantId ?? null,
      relationshipId: data.relationshipId ?? null,
    });
  }, {
    connection: bullMqConnection(),
    concurrency: 5,
  });

  worker.on('failed', async (job, error) => {
    nLogger.error({ jobId: job?.id, error: error.message }, 'Notification job failed');
    queueFailedCounter.add(1, { queue_name: 'notifications' });
    if (job && (job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 3)) {
      await dlq.add('dead-letter', { originalJob: job.data, error: error.message, failedAt: new Date().toISOString() });
    }
  });

  nLogger.info('Notifications worker started');
  return worker;
}
