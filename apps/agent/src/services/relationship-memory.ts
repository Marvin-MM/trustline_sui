import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { walrusService } from './walrus';

const memoryLogger = logger.child({ module: 'relationship-memory' });
export const RELATIONSHIP_MEMORY_PERSIST_EVENT = 'RELATIONSHIP_MEMORY_PERSIST_REQUESTED';

const MEMORY_EVENT_NAMES = new Set([
  'RelationshipCreatedEvent',
  'MilestoneCreatedEvent',
  'DeliverableSubmittedEvent',
  'DeliverableVerifiedEvent',
  'DeliverableRejectedEvent',
  'MilestoneConditionMetEvent',
  'MilestoneReleasedEvent',
  'MilestoneCancelledEvent',
  'RelationshipCancelledEvent',
  'DisputeRaisedEvent',
  'DisputeResolvedEvent',
  'AgentCapGrantedEvent',
  'AgentCapRevokedEvent',
  'OperatorCapGrantedEvent',
  'CompletionAttestationMintedEvent',
]);

function eventName(type: string): string {
  return type.split('::').at(-1) ?? type;
}

function value(payload: Record<string, unknown>, snake: string, camel = snake): unknown {
  return payload[snake] ?? payload[camel];
}

function asString(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'bigint') return String(input);
  if (Array.isArray(input)) return Buffer.from(input as number[]).toString('hex');
  if (typeof input === 'object' && 'bytes' in input) {
    return asString((input as { bytes: unknown }).bytes);
  }
  return String(input);
}

function asOptionalInt(input: unknown): number | null {
  const parsed = Number(asString(input));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function summaryFor(name: string, milestoneIndex: number | null): string {
  const milestone = milestoneIndex === null ? '' : `Milestone ${milestoneIndex + 1} `;
  const summaries: Record<string, string> = {
    RelationshipCreatedEvent: 'Payment relationship created and funded.',
    MilestoneCreatedEvent: `${milestone}configured.`,
    DeliverableSubmittedEvent: `${milestone}deliverable submitted.`,
    DeliverableVerifiedEvent: `${milestone}deliverable verified.`,
    DeliverableRejectedEvent: `${milestone}deliverable rejected for revision.`,
    MilestoneConditionMetEvent: `${milestone}release condition satisfied.`,
    MilestoneReleasedEvent: `${milestone}payment released to the recipient.`,
    MilestoneCancelledEvent: `${milestone}cancelled and refunded to the payer.`,
    RelationshipCancelledEvent: 'Remaining pending milestones cancelled.',
    DisputeRaisedEvent: `${milestone}dispute raised.`,
    DisputeResolvedEvent: `${milestone}dispute resolved.`,
    AgentCapGrantedEvent: 'Scoped automation capability granted.',
    AgentCapRevokedEvent: 'Scoped automation capability revoked.',
    OperatorCapGrantedEvent: 'Workspace operator capability granted.',
    CompletionAttestationMintedEvent: `${milestone}completion attestation minted.`,
  };
  return summaries[name] ?? name.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function relationshipObjectId(payload: Record<string, unknown>): string {
  return asString(value(payload, 'relationship_id', 'relationshipId'));
}

export async function indexRelationshipMemoryEvent(params: {
  sourceEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  sender: string;
  occurredAt?: Date;
}): Promise<void> {
  const name = eventName(params.eventType);
  if (!MEMORY_EVENT_NAMES.has(name)) return;

  const objectId = relationshipObjectId(params.payload);
  if (!objectId) return;
  const relationship = await prisma.paymentRelationship.findUnique({
    where: { suiObjectId: objectId },
    select: { id: true, tenantId: true, walrusMemorySpaceId: true },
  });
  if (!relationship) return;

  const milestoneIndex = asOptionalInt(value(params.payload, 'milestone_index', 'milestoneIndex'));
  await prisma.$transaction(async (tx) => {
    const entry = await tx.relationshipMemoryEntry.upsert({
      where: { sourceEventId: params.sourceEventId },
      update: {},
      create: {
        sourceEventId: params.sourceEventId,
        relationshipId: relationship.id,
        tenantId: relationship.tenantId,
        eventType: name,
        summary: summaryFor(name, milestoneIndex),
        factualPayload: params.payload as Prisma.InputJsonObject,
        milestoneIndex,
        actorWallet: params.sender || null,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });

    if (entry.storageStatus === 'STORED') return;
    const pendingPersistence = await tx.outboxEvent.findFirst({
      where: {
        aggregateId: entry.id,
        eventType: RELATIONSHIP_MEMORY_PERSIST_EVENT,
        published: false,
        error: null,
      },
      select: { id: true },
    });
    if (!pendingPersistence) {
      await tx.outboxEvent.create({
        data: {
          aggregateId: entry.id,
          aggregateType: 'RelationshipMemoryEntry',
          eventType: RELATIONSHIP_MEMORY_PERSIST_EVENT,
          payload: { sourceEventId: params.sourceEventId },
        },
      });
    }
  });
}

export async function persistRelationshipMemoryEntry(entryId: string): Promise<void> {
  const entry = await prisma.relationshipMemoryEntry.findUnique({
    where: { id: entryId },
    include: {
      relationship: {
        select: { walrusMemorySpaceId: true },
      },
    },
  });
  if (!entry) return;

  const canonical = JSON.stringify({
    version: 1,
    sourceEventId: entry.sourceEventId,
    relationshipId: entry.relationshipId,
    eventType: entry.eventType,
    summary: entry.summary,
    milestoneIndex: entry.milestoneIndex,
    actorWallet: entry.actorWallet,
    occurredAt: entry.occurredAt.toISOString(),
    payload: entry.factualPayload,
  });
  const bytes = Buffer.byteLength(canonical);

  if (entry.storageStatus !== 'STORED') {
    await prisma.relationshipMemoryEntry.update({
      where: { id: entry.id },
      data: { storageStatus: 'UPLOADING', storageError: null },
    });
    try {
      const { blobId } = await walrusService.uploadBlob(Buffer.from(canonical), 'application/json');
      await prisma.$transaction([
        prisma.relationshipMemoryEntry.update({
          where: { id: entry.id },
          data: {
            walrusBlobId: blobId,
            storageStatus: 'STORED',
            storageError: null,
            byteSize: bytes,
          },
        }),
        prisma.usageRecord.create({
          data: {
            walletAddress: entry.actorWallet || 'system',
            tenantId: entry.tenantId,
            relationshipId: entry.relationshipId,
            resourceType: 'WALRUS_BYTES',
            quantity: BigInt(bytes),
            estimatedCostUsd: 0,
            recordedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Walrus storage failed';
      await prisma.relationshipMemoryEntry.update({
        where: { id: entry.id },
        data: { storageStatus: 'FAILED', storageError: message, byteSize: bytes },
      });
      memoryLogger.warn({ sourceEventId: entry.sourceEventId, error: message }, 'Factual memory stored locally; Walrus indexing pending retry');
      throw error;
    }
  }

  try {
    await walrusService.writeMemoryEntry(entry.relationship.walrusMemorySpaceId, {
      content: canonical,
      metadata: {
        relationshipId: entry.relationshipId,
        sourceEventId: entry.sourceEventId,
      },
    });
  } catch (error) {
    memoryLogger.warn({
      sourceEventId: entry.sourceEventId,
      error: error instanceof Error ? error.message : 'MemWal indexing failed',
    }, 'Walrus blob stored; semantic indexing will be retried by the outbox');
    throw error;
  }
}

export async function backfillRelationshipMemory(): Promise<number> {
  const events = await prisma.blockchainEvent.findMany({
    orderBy: { createdAt: 'asc' },
  });
  let indexed = 0;
  for (const event of events) {
    if (!MEMORY_EVENT_NAMES.has(eventName(event.eventType))) continue;
    await indexRelationshipMemoryEvent({
      sourceEventId: event.suiEventId,
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
      sender: event.sender,
      occurredAt: event.createdAt,
    });
    indexed++;
  }
  return indexed;
}
