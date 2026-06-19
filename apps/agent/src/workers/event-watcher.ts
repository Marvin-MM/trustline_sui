/**
 * Sui event watcher — polls for blockchain events via GraphQL.
 */

import { prisma } from '../db/client';
import { queryEvents, buildSuiEventId } from '../lib/sui-client';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { queueDepthGauge, tracer, SpanStatusCode } from '../tracing';
import { Queue } from 'bullmq';
import { backfillRelationshipMemory } from '../services/relationship-memory';

const ewLogger = logger.child({ module: 'event-watcher' });

function bullMqConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const blockchainEventsQueue = new Queue('blockchain-events', {
  connection: bullMqConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

queueDepthGauge.addCallback(async (observableResult) => {
  const counts = await blockchainEventsQueue.getJobCounts('waiting', 'delayed', 'active');
  observableResult.observe((counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0), { queue_name: 'blockchain-events' });
});

const POLL_INTERVAL_MS = 5000;
const WATCHER_STATE_ID = `package:${env.SUI_PACKAGE_ID}`;

export class EventWatcher {
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    ewLogger.info('Event watcher starting');
    backfillRelationshipMemory()
      .then((indexed) => ewLogger.info({ indexed }, 'Relationship memory backfill completed'))
      .catch((error) => ewLogger.error({ error: (error as Error).message }, 'Relationship memory backfill failed'));
    await this.poll();
    this.intervalId = setInterval(() => {
      this.poll().catch(err => ewLogger.error({ error: (err as Error).message }, 'Poll cycle failed'));
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    await blockchainEventsQueue.close();
    ewLogger.info('Event watcher stopped');
  }

  private async poll(): Promise<void> {
    const span = tracer.startSpan('event-watcher.poll');
    try {
      const state = await prisma.watcherState.findUnique({ where: { id: WATCHER_STATE_ID } });
      let cursor = state?.lastCursor ?? null;
      let totalEvents = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await queryEvents({ packageId: env.SUI_PACKAGE_ID, cursor, limit: 50 });

        for (const event of result.events) {
          const suiEventId = buildSuiEventId(event.id.txDigest, event.id.eventSeq);
          const existing = await prisma.blockchainEvent.findUnique({ where: { suiEventId } });
          if (existing) continue;

          await prisma.blockchainEvent.create({
            data: {
              suiEventId,
              eventType: event.type,
              packageId: env.SUI_PACKAGE_ID,
              sender: event.sender,
              payload: event.parsedJson as object,
            },
          });

          try {
            await blockchainEventsQueue.add('process-event', {
              suiEventId,
              eventType: event.type,
              payload: event.parsedJson,
              sender: event.sender,
              timestampMs: event.timestampMs,
            });
          } catch (queueError) {
            await prisma.blockchainEvent.update({
              where: { suiEventId },
              data: {
                processingError: `enqueue_failed: ${(queueError as Error).message}`,
                retryCount: { increment: 1 },
              },
            });
            throw queueError;
          }

          totalEvents++;
        }

        cursor = result.nextCursor;
        hasMore = result.hasNextPage;
      }

      if (cursor) {
        await prisma.watcherState.upsert({
          where: { id: WATCHER_STATE_ID },
          update: { lastCursor: cursor, lastProcessedAt: new Date() },
          create: { id: WATCHER_STATE_ID, lastCursor: cursor, lastProcessedAt: new Date() },
        });
      }

      if (totalEvents > 0) ewLogger.info({ totalEvents, cursor }, 'Events discovered and enqueued');
      span.setAttribute('bondflow.events.count', totalEvents);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      ewLogger.error({ error: (error as Error).message }, 'Poll failed');
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
    } finally {
      span.end();
    }
  }
}

export const eventWatcher = new EventWatcher();
