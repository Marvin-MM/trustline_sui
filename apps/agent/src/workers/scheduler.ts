/**
 * Data retention scheduler. Uses setInterval (production should use pg_cron or Temporal).
 * Hourly: Clean expired IdempotencyKey and WebhookDelivery.
 * Daily: Archive old events/actions, delete old notifications.
 */

import { prisma } from '../db/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { agentAddress, executeTransaction } from '../lib/sui-client';
import { ptbBuilder } from '../services/ptb-builder';
import { applyBlockchainEvent } from './event-handlers';
import { distributedLock } from '../lib/distributed-lock';

const sLogger = logger.child({ module: 'scheduler' });
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const AUTOMATION_INTERVAL_MS = 60_000;

export class Scheduler {
  private hourlyId: ReturnType<typeof setInterval> | null = null;
  private dailyId: ReturnType<typeof setInterval> | null = null;
  private dailyTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private automationId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.hourlyId = setInterval(() => {
      this.hourlyCleanup().catch(e => sLogger.error({ err: (e as Error).message }, 'Hourly cleanup failed'));
    }, HOUR_MS);
    this.automationId = setInterval(() => {
      this.processMaturedAutomation().catch((error) =>
        sLogger.error({ err: (error as Error).message }, 'Relationship automation failed'));
    }, AUTOMATION_INTERVAL_MS);

    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(env.SCHEDULER_CLEANUP_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    this.dailyTimeoutId = setTimeout(() => {
      this.dailyCleanup().catch(e => sLogger.error({ err: (e as Error).message }, 'Daily failed'));
      this.dailyId = setInterval(() => {
        this.dailyCleanup().catch(e => sLogger.error({ err: (e as Error).message }, 'Daily failed'));
      }, DAY_MS);
    }, next.getTime() - now.getTime());

    sLogger.info({ nextDaily: next.toISOString() }, 'Scheduler started');
  }

  stop(): void {
    if (this.hourlyId) { clearInterval(this.hourlyId); this.hourlyId = null; }
    if (this.dailyId) { clearInterval(this.dailyId); this.dailyId = null; }
    if (this.dailyTimeoutId) { clearTimeout(this.dailyTimeoutId); this.dailyTimeoutId = null; }
    if (this.automationId) { clearInterval(this.automationId); this.automationId = null; }
  }

  private milestoneMatured(milestone: {
    conditionType: string;
    conditionValue: string;
    challengeDeadline: Date | null;
  }, now: Date): boolean {
    if (milestone.conditionType === 'DELIVERABLE') {
      return Boolean(milestone.challengeDeadline && milestone.challengeDeadline <= now);
    }
    if (milestone.conditionType !== 'TIME_GATED') return false;
    const raw = milestone.conditionValue.trim();
    const timestamp = /^\d+$/.test(raw)
      ? Number(raw)
      : /^[0-9a-fA-F]{16}$/.test(raw)
        ? Number(BigInt(`0x${raw}`))
        : new Date(raw).getTime();
    return Number.isFinite(timestamp) && timestamp <= now.getTime();
  }

  private async processMaturedAutomation(): Promise<void> {
    const now = new Date();
    const milestones = await prisma.milestone.findMany({
      where: {
        releasePolicy: 'AUTO_AFTER_CHALLENGE',
        OR: [
          { conditionType: 'DELIVERABLE', status: 'CONDITION_MET', challengeDeadline: { lte: now } },
          { conditionType: 'TIME_GATED', status: 'PENDING' },
        ],
        relationship: { status: 'ACTIVE', legacyReadOnly: false, contractVersion: 2 },
      },
      include: {
        relationship: {
          include: {
            capabilities: {
              where: {
                capabilityType: 'AGENT',
                holderWallet: agentAddress,
                revokedAt: null,
                expiresAt: { gt: now },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: 50,
    });

    for (const milestone of milestones) {
      if (!this.milestoneMatured(milestone, now)) continue;
      const cap = milestone.relationship.capabilities[0];
      const permissions = cap?.permissions as { allowedActions?: number[] } | null;
      if (!cap || !permissions?.allowedActions?.includes(1)) continue;
      await distributedLock.withLock(
        `bondflow:auto-release:${milestone.relationshipId}:${milestone.milestoneIndex}`,
        55_000,
        async () => {
          const tx = ptbBuilder.buildAgentAutoReleaseTransaction({
            relationshipId: milestone.relationship.suiObjectId,
            milestoneIndex: milestone.milestoneIndex,
            agentCapId: cap.suiObjectId,
            coinType: milestone.relationship.assetType,
          });
          tx.setSender(agentAddress);
          const executed = await executeTransaction(tx);
          for (const event of executed.events ?? []) {
            await applyBlockchainEvent({
              suiEventId: `${executed.digest}:${event.id.eventSeq}`,
              eventType: event.type,
              payload: (event.parsedJson ?? {}) as Record<string, unknown>,
              sender: event.sender,
              markProcessed: true,
            });
          }
          sLogger.info({
            relationshipId: milestone.relationshipId,
            milestoneIndex: milestone.milestoneIndex,
            digest: executed.digest,
          }, 'Auto-release completed');
        },
      );
    }
  }

  private async hourlyCleanup(): Promise<void> {
    const now = new Date();
    const ik = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } });
    const wh = await prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * HOUR_MS) } } });
    sLogger.info({ idempotencyKeys: ik.count, webhooks: wh.count }, 'Hourly cleanup done');
  }

  private async dailyCleanup(): Promise<void> {
    const now = new Date();
    const evtCut = new Date(now.getTime() - env.BLOCKCHAIN_EVENT_RETENTION_DAYS * DAY_MS);
    const actCut = new Date(now.getTime() - env.AGENT_ACTION_RETENTION_DAYS * DAY_MS);

    const oldEvts = await prisma.blockchainEvent.findMany({ where: { createdAt: { lt: evtCut } }, take: 1000 });
    if (oldEvts.length > 0) {
      await prisma.blockchainEventArchive.createMany({
        data: oldEvts.map(e => ({ suiEventId: e.suiEventId, eventType: e.eventType, packageId: e.packageId, sender: e.sender, payload: e.payload as object, processed: e.processed, processedAt: e.processedAt, processingError: e.processingError, retryCount: e.retryCount, originalCreatedAt: e.createdAt })),
        skipDuplicates: true,
      });
      await prisma.blockchainEvent.deleteMany({ where: { id: { in: oldEvts.map(e => e.id) } } });
    }

    const oldActs = await prisma.agentAction.findMany({ where: { createdAt: { lt: actCut } }, take: 1000 });
    if (oldActs.length > 0) {
      await prisma.agentActionArchive.createMany({
        data: oldActs.map(a => ({ relationshipId: a.relationshipId, tenantId: a.tenantId, actionType: a.actionType, payload: a.payload as object, result: a.result as object, aiModel: a.aiModel, promptVersion: a.promptVersion, tokensUsed: a.tokensUsed, inputTokens: a.inputTokens, outputTokens: a.outputTokens, estimatedCostUsd: a.estimatedCostUsd, durationMs: a.durationMs, success: a.success, errorMessage: a.errorMessage, traceId: a.traceId, originalCreatedAt: a.createdAt })),
        skipDuplicates: true,
      });
      await prisma.agentAction.deleteMany({ where: { id: { in: oldActs.map(a => a.id) } } });
    }

    const notifs = await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 365 * DAY_MS) } } });
    sLogger.info({ events: oldEvts.length, actions: oldActs.length, notifs: notifs.count }, 'Daily cleanup done');
  }
}

export const scheduler = new Scheduler();
