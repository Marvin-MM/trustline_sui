/**
 * BullMQ worker for AI pipeline jobs.
 * Dead letter queue: ai-pipeline-dlq.
 */

import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { runDeliverableVerification } from '../agents/deliverable-verification.agent';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { queueDepthGauge, queueFailedCounter } from '../tracing';
import { AgentRunner } from '../agents/agent-runner';
import { ContentScanOutputSchema, FEATURE_FLAG_KEYS, PROMPT_KEYS, type ContentScanOutput } from '@bondflow/types';
import { featureFlagService } from '../services/feature-flags';
import { AGENT_MODELS } from '../agents/models';

const aiLogger = logger.child({ module: 'ai-pipeline-worker' });

function bullMqConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const dlq = new Queue('ai-pipeline-dlq', { connection: bullMqConnection() });

export const aiPipelineQueue = new Queue('ai-pipeline', {
  connection: bullMqConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
  },
});

queueDepthGauge.addCallback(async (observableResult) => {
  const counts = await aiPipelineQueue.getJobCounts('waiting', 'delayed', 'active');
  observableResult.observe((counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0), { queue_name: 'ai-pipeline' });
});

interface AiPipelineJobData {
  type: string;
  blobId?: string;
  relationshipId?: string;
  milestoneIndex?: number;
  milestoneCondition?: string;
  tenantId?: string;
  uploadId?: string;
  content?: string;
  walletAddress?: string;
}

async function handleJob(data: AiPipelineJobData): Promise<void> {
  if (data.type === 'verify-deliverable') {
    await runDeliverableVerification({
      blobId: data.blobId!,
      relationshipId: data.relationshipId!,
      milestoneIndex: data.milestoneIndex!,
      milestoneCondition: data.milestoneCondition!,
      uploadId: data.uploadId!,
      ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      ...(data.walletAddress ? { walletAddress: data.walletAddress } : {}),
    });
  } else if (data.type === 'content-scan') {
    const uploadId = data.uploadId!;
    const content = data.content ?? '[No content]';
    const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, data.tenantId);
    if (!enabled) {
      aiLogger.info({ uploadId }, 'AI disabled — leaving content scan pending for manual review');
      return;
    }
    try {
      const result = await AgentRunner.run<ContentScanOutput>({
        promptKey: PROMPT_KEYS.CONTENT_SCAN,
        model: AGENT_MODELS.fast,
        userMessage: `Classify this upload content. This is heuristic content classification only and must not be treated as malware clearance.\n\nContent:\n${content.slice(0, 10000)}`,
        outputSchema: ContentScanOutputSchema,
        actionType: 'CONTENT_SCANNED',
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
        metadata: { walletAddress: data.walletAddress ?? 'system', uploadId },
      });
      const scanStatus = result.isSafe ? 'CLEAN' : 'SUSPICIOUS';
      await prisma.deliverableUpload.update({ where: { id: uploadId }, data: { scanStatus } });
      aiLogger.info({ uploadId, scanStatus }, 'Content scan completed');
    } catch (error) {
      aiLogger.error({ error: (error as Error).message, uploadId }, 'Content scan failed');
      await prisma.deliverableUpload.update({ where: { id: uploadId }, data: { scanStatus: 'PENDING' } });
    }
  }
}

export function startAiPipelineWorker(): Worker {
  const worker = new Worker('ai-pipeline', async (job) => {
    await handleJob(job.data as AiPipelineJobData);
  }, {
    connection: bullMqConnection(),
    concurrency: 3,
    limiter: { max: 5, duration: 1000 },
    // New jobs wake an idle worker instantly via Redis pub/sub — drainDelay only
    // controls how often an idle worker re-polls Redis when the queue is empty.
    // Widen both to cut idle Redis command volume (matters on per-command billing).
    drainDelay: 3000,
    stalledInterval: 600000,
  });

  worker.on('failed', async (job, error) => {
    aiLogger.error({ jobId: job?.id, error: error.message }, 'AI pipeline job failed');
    queueFailedCounter.add(1, { queue_name: 'ai-pipeline' });
    if (job && (job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 3)) {
      const data = job.data as AiPipelineJobData;
      if (data.type === 'verify-deliverable' && data.uploadId) {
        await prisma.deliverableUpload.update({
          where: { id: data.uploadId },
          data: {
            verificationStatus: 'FAILED',
            verificationConfidence: 0,
            verificationReason: error.message,
          },
        }).catch((updateError) => {
          aiLogger.error(
            { jobId: job.id, uploadId: data.uploadId, error: (updateError as Error).message },
            'Failed to mark deliverable verification as failed',
          );
        });
      }
      await dlq.add('dead-letter', { originalJob: job.data, error: error.message, failedAt: new Date().toISOString() });
    }
  });

  aiLogger.info('AI pipeline worker started');
  return worker;
}
