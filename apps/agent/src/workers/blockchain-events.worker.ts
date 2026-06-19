/**
 * BullMQ worker for processing blockchain events.
 * Acquires distributed locks on milestone events.
 * Dead letter queue: blockchain-events-dlq.
 */

import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { distributedLock } from '../lib/distributed-lock';
import { logger } from '../lib/logger';
import { tracer, SpanStatusCode, queueFailedCounter } from '../tracing';
import { applyBlockchainEvent } from './event-handlers';

const beLogger = logger.child({ module: 'blockchain-events-worker' });

function bullMqConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const dlq = new Queue('blockchain-events-dlq', { connection: bullMqConnection() });

function extractRelationshipId(payload: Record<string, unknown>): string | undefined {
  return (payload['relationship_id'] ?? payload['relationshipId']) as string | undefined;
}

async function handleEvent(data: {
  suiEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  sender: string;
  timestampMs: string;
}): Promise<void> {
  const span = tracer.startSpan('blockchain-events.handle', {
    attributes: { 'bondflow.event.type': data.eventType, 'bondflow.event.id': data.suiEventId },
  });

  try {
    const eventTypeParts = data.eventType.split('::');
    const eventName = eventTypeParts[eventTypeParts.length - 1] ?? data.eventType;

    const milestoneEvents = ['MilestoneConditionMetEvent', 'MilestoneReleasedEvent', 'DisputeRaisedEvent', 'DisputeResolvedEvent'];
    const isMilestoneEvent = milestoneEvents.some(e => eventName.includes(e));

    if (isMilestoneEvent) {
      const relId = extractRelationshipId(data.payload);
      const milestoneIndex = (data.payload['milestone_index'] ?? data.payload['milestoneIndex']) as number | undefined;
      if (relId && milestoneIndex !== undefined) {
        const lockResource = `bondflow:lock:milestone:${relId}:${milestoneIndex}`;
        const result = await distributedLock.withLockOrSkip(lockResource, 30000, async () => {
          await processEvent(eventName, data);
        });
        if (result === null) {
          beLogger.debug({ suiEventId: data.suiEventId }, 'Milestone event skipped (lock held)');
        }
        span.setStatus({ code: SpanStatusCode.OK });
        return;
      }
    }

    await processEvent(eventName, data);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

async function processEvent(eventName: string, data: {
  suiEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  sender: string;
}): Promise<void> {
  await applyBlockchainEvent({
    suiEventId: data.suiEventId,
    eventType: data.eventType,
    payload: data.payload,
    sender: data.sender,
    markProcessed: true,
  });
  beLogger.info({ eventName, suiEventId: data.suiEventId }, 'Blockchain event processed');
}

export function startBlockchainEventsWorker(): Worker {
  const worker = new Worker('blockchain-events', async (job) => {
    await handleEvent(job.data as {
      suiEventId: string; eventType: string;
      payload: Record<string, unknown>; sender: string; timestampMs: string;
    });
  }, {
    connection: bullMqConnection(),
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  });

  worker.on('failed', async (job, error) => {
    beLogger.error({ jobId: job?.id, error: error.message }, 'Blockchain event job failed');
    queueFailedCounter.add(1, { queue_name: 'blockchain-events' });
    if (job && (job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 5)) {
      await dlq.add('dead-letter', { originalJob: job.data, error: error.message, failedAt: new Date().toISOString() });
      beLogger.error({ jobId: job.id }, 'Job moved to DLQ');
    }
  });

  beLogger.info('Blockchain events worker started');
  return worker;
}
