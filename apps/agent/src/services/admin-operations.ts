import { Queue } from 'bullmq';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { featureFlagService } from './feature-flags';
import { promptRegistry } from '../lib/prompt-registry';
import { toJsonSafe } from '../lib/json';
import { isAiTokenResourceType } from '../agents/models';

export interface AdminActor {
  userId: string;
  walletAddress: string;
}

function bullMqConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export class AdminOperationsService {
  async getQueues() {
    const queues = ['blockchain-events', 'ai-pipeline', 'notifications'];
    const result: Record<string, unknown> = {};
    for (const name of queues) {
      const queue = new Queue(name, { connection: bullMqConnection() });
      result[name] = await queue.getJobCounts();
      await queue.close();
    }
    return result;
  }

  async getDlqJobs() {
    const dlqs = ['blockchain-events-dlq', 'ai-pipeline-dlq', 'notifications-dlq'];
    const result: Record<string, unknown[]> = {};
    for (const name of dlqs) {
      const queue = new Queue(name, { connection: bullMqConnection() });
      const jobs = await queue.getJobs(['waiting', 'delayed'], 0, 50);
      result[name] = jobs.map((job) => ({ id: job.id, data: job.data, failedReason: job.failedReason, timestamp: job.timestamp }));
      await queue.close();
    }
    return result;
  }

  async retryDlqJob(actor: AdminActor, jobId: string, queueName: string) {
    const dlqQueue = new Queue(`${queueName}-dlq`, { connection: bullMqConnection() });
    const originQueue = new Queue(queueName, { connection: bullMqConnection() });
    try {
      const job = await dlqQueue.getJob(jobId);
      if (!job) return { notFound: true as const };
      const dlqData = job.data as { originalJob?: Record<string, unknown> };
      await originQueue.add('retry', dlqData.originalJob ?? (job.data as Record<string, unknown>));
      await job.remove();
      await prisma.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'DLQ_JOB_RETRIED',
          targetType: 'BullMQJob',
          targetId: jobId,
          metadata: { queueName },
        },
      });
      return { jobId };
    } finally {
      await dlqQueue.close();
      await originQueue.close();
    }
  }

  async listTransactions(query: Record<string, string | undefined>) {
    const page = parseInt(query['page'] ?? '1');
    const limit = parseInt(query['limit'] ?? '20');
    const where: Record<string, unknown> = {};
    if (query['status']) where['status'] = query['status'];
    if (query['txType']) where['txType'] = query['txType'];
    const data = await prisma.submittedTransaction.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.submittedTransaction.count({ where });
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  listFeatureFlags() {
    return prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async setFeatureFlag(actor: AdminActor, key: string, enabled: boolean, tenantId?: string | null) {
    if (enabled) await featureFlagService.enable(key, tenantId);
    else await featureFlagService.disable(key, tenantId);
    await prisma.auditLog.create({
      data: {
        tenantId: tenantId ?? null,
        actorUserId: actor.userId,
        actorWallet: actor.walletAddress,
        action: 'FEATURE_FLAG_CHANGED',
        targetType: 'FeatureFlag',
        targetId: key,
        after: { enabled },
      },
    });
    return { key, enabled };
  }

  listPrompts() {
    return prisma.promptVersion.findMany({ orderBy: [{ promptKey: 'asc' }, { createdAt: 'desc' }] });
  }

  async createPrompt(actor: AdminActor, body: { promptKey: string; version: string; content: string }) {
    const prompt = await prisma.promptVersion.create({ data: body });
    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        actorWallet: actor.walletAddress,
        action: 'PROMPT_CREATED',
        targetType: 'PromptVersion',
        targetId: prompt.id,
        after: { promptKey: prompt.promptKey, version: prompt.version },
      },
    });
    return prompt;
  }

  async activatePrompt(actor: AdminActor, promptId: string) {
    const prompt = await prisma.promptVersion.findUnique({ where: { id: promptId } });
    if (!prompt) return { notFound: true as const };
    await prisma.$transaction(async (tx) => {
      await tx.promptVersion.updateMany({ where: { promptKey: prompt.promptKey, isActive: true }, data: { isActive: false } });
      await tx.promptVersion.update({ where: { id: promptId }, data: { isActive: true, activatedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'PROMPT_ACTIVATED',
          targetType: 'PromptVersion',
          targetId: promptId,
          after: { promptKey: prompt.promptKey, version: prompt.version },
        },
      });
    });
    promptRegistry.clearCache();
    return { promptKey: prompt.promptKey, version: prompt.version };
  }

  async getUsage(query: Record<string, string | undefined>) {
    if (query['detail'] === 'records') {
      const records = await prisma.usageRecord.findMany({ orderBy: { recordedAt: 'desc' }, take: 200 });
      const totalTokens = records.filter((record) => isAiTokenResourceType(record.resourceType)).reduce((acc, record) => acc + record.quantity, 0n);
      return toJsonSafe({ records, summary: { totalTokens: totalTokens.toString(), recordCount: records.length } });
    }
    const aggregates = await prisma.usageAggregation.findMany({
      orderBy: [{ bucketDate: 'desc' }, { tenantId: 'asc' }],
      take: 200,
    });
    return toJsonSafe({ aggregates });
  }

  async getAuditLog(query: Record<string, string | undefined>) {
    const where: Record<string, unknown> = {};
    if (query['tenantId']) where['tenantId'] = query['tenantId'];
    if (query['actorWallet']) where['actorWallet'] = query['actorWallet'];
    if (query['action']) where['action'] = query['action'];
    if (query['targetType']) where['targetType'] = query['targetType'];
    if (query['fromDate'] || query['toDate']) {
      where['createdAt'] = {
        ...(query['fromDate'] ? { gte: new Date(query['fromDate']) } : {}),
        ...(query['toDate'] ? { lte: new Date(query['toDate']) } : {}),
      };
    }
    const page = parseInt(query['page'] ?? '1');
    const limit = Math.min(parseInt(query['limit'] ?? '50'), 100);
    const data = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit });
    const total = await prisma.auditLog.count({ where });
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async replayEvents(body: { fromDate?: string; toDate?: string; eventTypes?: string[] }) {
    const where: Record<string, unknown> = {};
    if (body.fromDate) where['createdAt'] = { gte: new Date(body.fromDate) };
    if (body.toDate) where['createdAt'] = { ...(where['createdAt'] as object ?? {}), lte: new Date(body.toDate) };
    if (body.eventTypes?.length) where['eventType'] = { in: body.eventTypes };
    const events = await prisma.blockchainEvent.findMany({ where, orderBy: { createdAt: 'asc' } });
    const queue = new Queue('blockchain-events', { connection: bullMqConnection() });
    try {
      for (const event of events) {
        await queue.add('replay-event', {
          suiEventId: event.suiEventId,
          eventType: event.eventType,
          payload: event.payload,
          sender: event.sender,
          timestampMs: '0',
        });
      }
    } finally {
      await queue.close();
    }
    return { count: events.length };
  }
}

export const adminOperationsService = new AdminOperationsService();
