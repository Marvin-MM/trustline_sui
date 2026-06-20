import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import type { Prisma } from '@prisma/client';
import { paymentAsset } from '../lib/payment-asset';
import { bytes32FromExternalId } from '../lib/onchain-bytes';
import { indexRelationshipMemoryEvent } from '../services/relationship-memory';
import { env } from '../config/env';

const eventLogger = logger.child({ module: 'event-handlers' });

type EventPayload = Record<string, unknown>;

function eventName(type: string): string {
  return type.split('::').at(-1) ?? type;
}

function value(payload: EventPayload, snake: string, camel: string = snake): unknown {
  return payload[snake] ?? payload[camel];
}

function asString(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'bigint') return String(input);
  if (Array.isArray(input)) return Buffer.from(input as number[]).toString('hex');
  if (typeof input === 'object' && 'bytes' in input) return asString((input as { bytes: unknown }).bytes);
  return String(input);
}

function asUtf8String(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return Buffer.from(input as number[]).toString('utf8');
  if (typeof input === 'object' && 'bytes' in input) return asUtf8String((input as { bytes: unknown }).bytes);
  return String(input);
}

function asHexBytes(input: unknown): string {
  const raw = asString(input);
  const normalized = raw.startsWith('0x') ? raw.slice(2) : raw;
  return /^[0-9a-fA-F]+$/.test(normalized) ? normalized.toLowerCase() : raw;
}

function externalIdToHex(input: string): string | null {
  try {
    return Buffer.from(bytes32FromExternalId(input)).toString('hex');
  } catch {
    return null;
  }
}

async function findDeliverableUploadForEvent(
  tx: Prisma.TransactionClient,
  relationshipId: string,
  milestoneIndex: number,
  eventBlobId: unknown,
) {
  const eventHex = asHexBytes(eventBlobId);
  if (!eventHex) return null;

  const uploads = await tx.deliverableUpload.findMany({
    where: { relationshipId, milestoneIndex },
    orderBy: { createdAt: 'desc' },
  });

  return uploads.find((upload) => externalIdToHex(upload.walrusBlobId) === eventHex) ?? null;
}

async function originalDeliverableBlobId(
  tx: Prisma.TransactionClient,
  relationshipId: string,
  milestoneIndex: number,
  eventBlobId: unknown,
): Promise<string> {
  const upload = await findDeliverableUploadForEvent(tx, relationshipId, milestoneIndex, eventBlobId);
  return upload?.walrusBlobId ?? asString(eventBlobId);
}

function asInt(input: unknown): number {
  const parsed = Number(asString(input));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBigInt(input: unknown): bigint {
  const raw = asString(input);
  return raw ? BigInt(raw) : 0n;
}

function conditionType(input: unknown): 'MANUAL' | 'TIME_GATED' | 'DELIVERABLE' {
  const numeric = asInt(input);
  if (numeric === 1) return 'TIME_GATED';
  if (numeric === 2) return 'DELIVERABLE';
  return 'MANUAL';
}

function releasePolicy(input: unknown): 'PAYER_APPROVAL' | 'AUTO_AFTER_CHALLENGE' {
  return asInt(input) === 1 ? 'AUTO_AFTER_CHALLENGE' : 'PAYER_APPROVAL';
}

async function updateTerminalRelationshipStatus(
  tx: Prisma.TransactionClient,
  relationshipId: string,
) {
  const milestones = await tx.milestone.findMany({
    where: { relationshipId },
    select: { status: true },
  });
  if (milestones.length === 0 || milestones.some((m) => !['RELEASED', 'CANCELLED'].includes(m.status))) return;
  await tx.paymentRelationship.update({
    where: { id: relationshipId },
    data: { status: milestones.some((m) => m.status === 'RELEASED') ? 'COMPLETED' : 'CANCELLED' },
  });
}

function dateFromMs(input: unknown): Date {
  const ms = Number(asString(input));
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
}

export async function applyBlockchainEvent(params: {
  suiEventId: string;
  eventType: string;
  payload: EventPayload;
  sender: string;
  markProcessed?: boolean;
}): Promise<void> {
  const name = eventName(params.eventType);
  const p = params.payload;

  if (params.markProcessed) {
    const existing = await prisma.blockchainEvent.findUnique({
      where: { suiEventId: params.suiEventId },
      select: { processed: true },
    });
    if (existing?.processed) {
      eventLogger.debug({ eventName: name, suiEventId: params.suiEventId }, 'Blockchain event already processed');
      return;
    }
    if (!existing) {
      await prisma.blockchainEvent.create({
        data: {
          suiEventId: params.suiEventId,
          eventType: params.eventType,
          packageId: env.SUI_PACKAGE_ID,
          sender: params.sender,
          payload: params.payload as Prisma.InputJsonObject,
        },
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (name.includes('RelationshipCreatedEvent')) {
      const relationshipId = asString(value(p, 'relationship_id', 'relationshipId'));
      const milestoneCount = asInt(value(p, 'milestone_count', 'milestoneCount'));
      const digest = params.suiEventId.split(':')[0] ?? '';
      const trackedTransaction = await tx.submittedTransaction.findFirst({
        where: { digest, txType: 'CREATE_RELATIONSHIP', relationshipId: { not: null } },
      });

      const rel = trackedTransaction?.relationshipId
        ? await tx.paymentRelationship.update({
            where: { id: trackedTransaction.relationshipId },
            data: {
              suiObjectId: relationshipId,
              status: 'ACTIVE',
              payerWallet: asString(value(p, 'payer')),
              recipientWallet: asString(value(p, 'recipient')),
              milestoneCount,
              totalLockedAmount: asBigInt(value(p, 'total_locked_amount', 'totalLockedAmount')),
              walrusMemorySpaceId: asString(value(p, 'walrus_memory_space_id', 'walrusMemorySpaceId')),
              memo: asUtf8String(value(p, 'memo')),
              contractVersion: asInt(value(p, 'contract_version', 'contractVersion')) || 2,
              legacyReadOnly: false,
              assetType: paymentAsset.type,
              assetSymbol: paymentAsset.symbol,
              assetDecimals: paymentAsset.decimals,
            },
          })
        : await tx.paymentRelationship.upsert({
            where: { suiObjectId: relationshipId },
            update: {
              payerWallet: asString(value(p, 'payer')),
              recipientWallet: asString(value(p, 'recipient')),
              milestoneCount,
              totalLockedAmount: asBigInt(value(p, 'total_locked_amount', 'totalLockedAmount')),
              walrusMemorySpaceId: asString(value(p, 'walrus_memory_space_id', 'walrusMemorySpaceId')),
              memo: asUtf8String(value(p, 'memo')),
              status: 'ACTIVE',
              contractVersion: asInt(value(p, 'contract_version', 'contractVersion')) || 2,
              legacyReadOnly: false,
              assetType: paymentAsset.type,
              assetSymbol: paymentAsset.symbol,
              assetDecimals: paymentAsset.decimals,
            },
            create: {
              suiObjectId: relationshipId,
              payerWallet: asString(value(p, 'payer')),
              recipientWallet: asString(value(p, 'recipient')),
              memo: asUtf8String(value(p, 'memo')),
              milestoneCount,
              totalLockedAmount: asBigInt(value(p, 'total_locked_amount', 'totalLockedAmount')),
              walrusMemorySpaceId: asString(value(p, 'walrus_memory_space_id', 'walrusMemorySpaceId')),
              contractVersion: asInt(value(p, 'contract_version', 'contractVersion')) || 2,
              legacyReadOnly: false,
              assetType: paymentAsset.type,
              assetSymbol: paymentAsset.symbol,
              assetDecimals: paymentAsset.decimals,
            },
          });

      if (trackedTransaction) {
        await tx.submittedTransaction.update({
          where: { id: trackedTransaction.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date(), relationshipId: rel.id },
        });
      }

      // Contract event does not emit individual milestone amounts/condition values.
      // Recovery creates placeholder rows that later milestone events enrich.
      for (let index = 0; index < milestoneCount; index++) {
        await tx.milestone.upsert({
          where: { relationshipId_milestoneIndex: { relationshipId: rel.id, milestoneIndex: index } },
          update: {},
          create: {
            relationshipId: rel.id,
            milestoneIndex: index,
            amount: 0n,
            conditionType: conditionType(value(p, 'condition_type', 'conditionType')),
            conditionValue: '',
          },
        });
      }
    } else if (name.includes('MilestoneCreatedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        await tx.milestone.upsert({
          where: { relationshipId_milestoneIndex: { relationshipId: rel.id, milestoneIndex } },
          update: {
            amount: asBigInt(value(p, 'amount')),
            conditionType: conditionType(value(p, 'condition_type', 'conditionType')),
            conditionValue: asUtf8String(value(p, 'requirement')),
            releasePolicy: releasePolicy(value(p, 'release_policy', 'releasePolicy')),
          },
          create: {
            relationshipId: rel.id,
            milestoneIndex,
            amount: asBigInt(value(p, 'amount')),
            conditionType: conditionType(value(p, 'condition_type', 'conditionType')),
            conditionValue: asUtf8String(value(p, 'requirement')),
            releasePolicy: releasePolicy(value(p, 'release_policy', 'releasePolicy')),
          },
        });
      }
    } else if (name.includes('DeliverableSubmittedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        const upload = await findDeliverableUploadForEvent(tx, rel.id, milestoneIndex, value(p, 'blob_id', 'blobId'));
        const blobId = upload?.walrusBlobId ?? asString(value(p, 'blob_id', 'blobId'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex },
          data: { status: 'SUBMITTED', deliverableBlobId: blobId },
        });
        // Submission is an on-chain state transition, not proof that the AI
        // verifier job exists. /deliverables/verify owns the SCANNING state so
        // it can enqueue exactly one verification job after wallet confirmation.
      }
    } else if (name.includes('DeliverableVerifiedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        const upload = await findDeliverableUploadForEvent(tx, rel.id, milestoneIndex, value(p, 'blob_id', 'blobId'));
        const blobId = upload?.walrusBlobId ?? asString(value(p, 'blob_id', 'blobId'));
        const evidenceHash = asString(value(p, 'evidence_hash', 'evidenceHash'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex },
          data: {
            status: 'CONDITION_MET',
            deliverableBlobId: blobId,
            verificationEvidenceHash: evidenceHash,
            challengeDeadline: dateFromMs(value(p, 'challenge_deadline', 'challengeDeadline')),
            conditionMetAt: dateFromMs(value(p, 'timestamp')),
          },
        });
        if (upload) {
          await tx.deliverableUpload.update({
            where: { id: upload.id },
            data: {
              verificationStatus: 'VERIFIED',
              verificationEvidenceHash: evidenceHash,
              verifiedAt: dateFromMs(value(p, 'timestamp')),
            },
          });
        }
      }
    } else if (name.includes('DeliverableRejectedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        const upload = await findDeliverableUploadForEvent(tx, rel.id, milestoneIndex, value(p, 'blob_id', 'blobId'));
        const blobId = upload?.walrusBlobId ?? asString(value(p, 'blob_id', 'blobId'));
        const evidenceHash = asString(value(p, 'evidence_hash', 'evidenceHash'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex },
          data: {
            status: 'PENDING',
            verificationEvidenceHash: evidenceHash,
          },
        });
        if (upload) {
          await tx.deliverableUpload.update({
            where: { id: upload.id },
            data: {
              verificationStatus: 'REJECTED',
              verificationEvidenceHash: evidenceHash,
              verifiedAt: dateFromMs(value(p, 'timestamp')),
            },
          });
        }
      }
    } else if (name.includes('MilestoneConditionMetEvent')) {
      const rel = await tx.paymentRelationship.findUnique({ where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) } });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex },
          data: {
            status: 'CONDITION_MET',
            deliverableBlobId: await originalDeliverableBlobId(tx, rel.id, milestoneIndex, value(p, 'deliverable_blob_id', 'deliverableBlobId')) || null,
            conditionMetAt: dateFromMs(value(p, 'timestamp')),
          },
        });
      }
    } else if (name.includes('MilestoneReleasedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({ where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) } });
      if (rel) {
        const milestoneIndex = asInt(value(p, 'milestone_index', 'milestoneIndex'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex },
          data: {
            status: 'RELEASED',
            amount: asBigInt(value(p, 'amount')),
            deliverableBlobId: await originalDeliverableBlobId(tx, rel.id, milestoneIndex, value(p, 'deliverable_blob_id', 'deliverableBlobId')) || null,
            releasedAt: dateFromMs(value(p, 'release_timestamp', 'releaseTimestamp')),
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: rel.id,
            aggregateType: 'Milestone',
            eventType: 'MILESTONE_RELEASED',
            payload: {
              recipientEmail: '',
              recipientWallet: asString(value(p, 'recipient')),
              notificationType: 'MILESTONE_RELEASED',
              subject: 'Milestone Released',
              bodyHtml: `<p>Milestone ${milestoneIndex} has been released.</p>`,
              tenantId: rel.tenantId,
              relationshipId: rel.id,
            } as Prisma.InputJsonObject,
          },
        });
        await updateTerminalRelationshipStatus(tx, rel.id);
      }
    } else if (name.includes('DisputeRaisedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({ where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) } });
      if (rel) {
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex: asInt(value(p, 'milestone_index', 'milestoneIndex')) },
          data: {
            status: 'DISPUTED',
            disputeStatus: 'OPEN',
            disputeRaisedAt: dateFromMs(value(p, 'timestamp')),
            disputeReasonHash: asString(value(p, 'reason_hash', 'reasonHash')),
          },
        });
      }
    } else if (name.includes('DisputeResolvedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({ where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) } });
      if (rel) {
        const resolution = asInt(value(p, 'resolution'));
        await tx.milestone.updateMany({
          where: { relationshipId: rel.id, milestoneIndex: asInt(value(p, 'milestone_index', 'milestoneIndex')) },
          data: {
            status: resolution === 2 ? 'RELEASED' : 'CANCELLED',
            disputeStatus: resolution === 2 ? 'RESOLVED_RECIPIENT' : 'RESOLVED_PAYER',
          },
        });
        await updateTerminalRelationshipStatus(tx, rel.id);
      }
    } else if (name.includes('MilestoneCancelledEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        await tx.milestone.updateMany({
          where: {
            relationshipId: rel.id,
            milestoneIndex: asInt(value(p, 'milestone_index', 'milestoneIndex')),
          },
          data: { status: 'CANCELLED' },
        });
        await updateTerminalRelationshipStatus(tx, rel.id);
      }
    } else if (name.includes('AgentCapGrantedEvent') || name.includes('OperatorCapGrantedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({
        where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) },
      });
      if (rel) {
        const isOperator = name.includes('OperatorCapGrantedEvent');
        await tx.relationshipCapability.upsert({
          where: { suiObjectId: asString(value(p, 'cap_id', 'capId')) },
          update: {
            revokedAt: null,
            expiresAt: dateFromMs(value(p, 'expiry')),
          },
          create: {
            suiObjectId: asString(value(p, 'cap_id', 'capId')),
            relationshipId: rel.id,
            capabilityType: isOperator ? 'OPERATOR' : 'AGENT',
            holderWallet: asString(value(p, isOperator ? 'operator' : 'agent')),
            expiresAt: dateFromMs(value(p, 'expiry')),
            permissions: isOperator ? {
              canRelease: Boolean(value(p, 'can_release', 'canRelease')),
              canCancel: Boolean(value(p, 'can_cancel', 'canCancel')),
              canDispute: Boolean(value(p, 'can_dispute', 'canDispute')),
            } : {
              allowedActions: value(p, 'allowed_actions', 'allowedActions') ?? [],
              maxActions: asInt(value(p, 'max_actions', 'maxActions')),
            },
          },
        });
      }
    } else if (name.includes('AgentCapRevokedEvent')) {
      await tx.relationshipCapability.updateMany({
        where: { suiObjectId: asString(value(p, 'cap_id', 'capId')) },
        data: { revokedAt: dateFromMs(value(p, 'timestamp')) },
      });
    } else if (name.includes('CompletionAttestationMintedEvent')) {
      const rel = await tx.paymentRelationship.findUnique({ where: { suiObjectId: asString(value(p, 'relationship_id', 'relationshipId')) } });
      if (rel) {
        await tx.completionAttestation.upsert({
          where: { suiObjectId: asString(value(p, 'attestation_id', 'attestationId')) },
          update: {},
          create: {
            suiObjectId: asString(value(p, 'attestation_id', 'attestationId')),
            relationshipId: rel.id,
            milestoneIndex: asInt(value(p, 'milestone_index', 'milestoneIndex')),
            payerWallet: asString(value(p, 'payer')),
            recipientWallet: asString(value(p, 'recipient')),
            amount: asBigInt(value(p, 'amount')),
            conditionType: conditionType(value(p, 'condition_type', 'conditionType')),
            deliverableBlobId: await originalDeliverableBlobId(
              tx,
              rel.id,
              asInt(value(p, 'milestone_index', 'milestoneIndex')),
              value(p, 'deliverable_blob_id', 'deliverableBlobId'),
            ) || null,
            walrusMemorySpaceId: rel.walrusMemorySpaceId,
            completionTimestamp: dateFromMs(value(p, 'completion_timestamp', 'completionTimestamp')),
          },
        });
      }
    } else if (name.includes('ReputationProofMintedEvent')) {
      await tx.reputationProof.upsert({
        where: { ownerWallet: asString(value(p, 'owner')) },
        update: {
          suiObjectId: asString(value(p, 'proof_id', 'proofId')),
          successfulCount: asInt(value(p, 'successful_count', 'successfulCount')),
          cancelledCount: asInt(value(p, 'cancelled_count', 'cancelledCount')),
          disputedCount: asInt(value(p, 'disputed_count', 'disputedCount')),
          totalVolume: asBigInt(value(p, 'total_volume', 'totalVolume')),
          completionRateBps: asInt(value(p, 'completion_rate_bps', 'completionRateBps')),
          avgCompletionTimeMs: asBigInt(value(p, 'avg_completion_time_ms', 'avgCompletionTimeMs')),
          walrusAttestationSpaceId: asString(value(p, 'walrus_attestation_space_id', 'walrusAttestationSpaceId')),
          mintedAt: dateFromMs(value(p, 'timestamp')),
        },
        create: {
          suiObjectId: asString(value(p, 'proof_id', 'proofId')),
          ownerWallet: asString(value(p, 'owner')),
          successfulCount: asInt(value(p, 'successful_count', 'successfulCount')),
          cancelledCount: asInt(value(p, 'cancelled_count', 'cancelledCount')),
          disputedCount: asInt(value(p, 'disputed_count', 'disputedCount')),
          totalVolume: asBigInt(value(p, 'total_volume', 'totalVolume')),
          completionRateBps: asInt(value(p, 'completion_rate_bps', 'completionRateBps')),
          avgCompletionTimeMs: asBigInt(value(p, 'avg_completion_time_ms', 'avgCompletionTimeMs')),
          walrusAttestationSpaceId: asString(value(p, 'walrus_attestation_space_id', 'walrusAttestationSpaceId')),
          mintedAt: dateFromMs(value(p, 'timestamp')),
        },
      });
    } else if (name.includes('ReputationProofUpdatedEvent')) {
      await tx.reputationProof.updateMany({
        where: { ownerWallet: asString(value(p, 'owner')) },
        data: {
          successfulCount: asInt(value(p, 'new_successful_count', 'newSuccessfulCount')),
          cancelledCount: asInt(value(p, 'new_cancelled_count', 'newCancelledCount')),
          disputedCount: asInt(value(p, 'new_disputed_count', 'newDisputedCount')),
          totalVolume: asBigInt(value(p, 'new_total_volume', 'newTotalVolume')),
        },
      });
    } else if (name.includes('ReputationProofRevokedEvent')) {
      await tx.reputationProof.deleteMany({
        where: { ownerWallet: asString(value(p, 'owner')) },
      });
    }

    if (params.markProcessed) {
      await tx.blockchainEvent.update({
        where: { suiEventId: params.suiEventId },
        data: { processed: true, processedAt: new Date(), processingError: null },
      });
    }
  });

  await indexRelationshipMemoryEvent({
    sourceEventId: params.suiEventId,
    eventType: params.eventType,
    payload: params.payload,
    sender: params.sender,
  });

  eventLogger.info({ eventName: name, suiEventId: params.suiEventId }, 'Blockchain event applied');
}
