import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { walrusService } from './walrus';

const memoryLogger = logger.child({ module: 'relationship-memory' });

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
  const entry = await prisma.relationshipMemoryEntry.upsert({
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
  const staleClaimBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claim = await prisma.relationshipMemoryEntry.updateMany({
    where: {
      id: entry.id,
      OR: [
        { storageStatus: { in: ['PENDING', 'FAILED'] } },
        { storageStatus: 'UPLOADING', updatedAt: { lt: staleClaimBefore } },
      ],
    },
    data: { storageStatus: 'UPLOADING', storageError: null },
  });
  if (claim.count === 0) return;

  const canonical = JSON.stringify({
    version: 1,
    sourceEventId: params.sourceEventId,
    relationshipId: relationship.id,
    eventType: name,
    summary: entry.summary,
    milestoneIndex,
    actorWallet: params.sender || null,
    occurredAt: entry.occurredAt.toISOString(),
    payload: params.payload,
  });
  const bytes = Buffer.byteLength(canonical);

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
          walletAddress: params.sender || 'system',
          tenantId: relationship.tenantId,
          relationshipId: relationship.id,
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
    memoryLogger.warn({ sourceEventId: params.sourceEventId, error: message }, 'Factual memory stored locally; Walrus indexing pending retry');
    return;
  }

  try {
    await walrusService.writeMemoryEntry(relationship.walrusMemorySpaceId, {
      content: canonical,
      metadata: {
        relationshipId: relationship.id,
        sourceEventId: params.sourceEventId,
      },
    });
  } catch (error) {
    memoryLogger.warn({
      sourceEventId: params.sourceEventId,
      error: error instanceof Error ? error.message : 'MemWal indexing failed',
    }, 'Walrus blob stored; optional semantic indexing failed');
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
