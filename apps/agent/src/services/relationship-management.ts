import { prisma } from '../db/client';
import { tenantGuard } from '../lib/tenant-guard';
import { toJsonSafe } from '../lib/json';
import { walrusService } from './walrus';
import { ptbBuilder, PtbSimulationError } from './ptb-builder';
import { agentAddress, suiClient } from '../lib/sui-client';
import { sanitize } from '@bondflow/types';
import {
  ConditionType,
  MilestoneStatus,
  RelationshipAction,
  RelationshipActorRole,
} from '@bondflow/types';
import type { Prisma } from '@prisma/client';
import { parseHumanAmount, paymentAsset } from '../lib/payment-asset';
import { env } from '../config/env';
import { auditFetchDepth, paginateAuditEntries } from '../lib/audit-pagination';
import { canonicalWalletAddress } from '../lib/wallet-signature';

const PENDING_RELATIONSHIP_STATUSES = ['PENDING_ON_CHAIN', 'FAILED_ON_CHAIN'] as const;
const VERIFICATION_STALE_MS = 10 * 60 * 1000;

function walletsEqual(left: string, right: string): boolean {
  return canonicalWalletAddress(left) === canonicalWalletAddress(right);
}

function recipientCanSubmitDeliverable(
  milestone: { milestoneIndex: number; conditionType: string; status: string },
  uploads: Array<{ milestoneIndex: number | null; verificationStatus: string; createdAt: Date }>,
): boolean {
  if (milestone.conditionType !== ConditionType.DELIVERABLE || milestone.status !== MilestoneStatus.PENDING) {
    return false;
  }
  const latestUpload = uploads
    .filter((upload) => upload.milestoneIndex === milestone.milestoneIndex)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  return !latestUpload || ['UPLOADED', 'REJECTED', 'FAILED'].includes(latestUpload.verificationStatus);
}

export class DatabaseMigrationRequiredError extends Error {
  public readonly code = 'DATABASE_MIGRATION_REQUIRED';
  public readonly migration = '20260605010000_relationship_pending_statuses';
  public readonly missingStatuses: string[];

  constructor(missingStatuses: string[]) {
    super(`Database migration required. Missing RelationshipStatus values: ${missingStatuses.join(', ')}`);
    this.name = 'DatabaseMigrationRequiredError';
    this.missingStatuses = missingStatuses;
  }
}

export interface RelationshipActor {
  userId: string;
  walletAddress: string;
  isPlatformAdmin?: boolean;
}

export class RelationshipManagementService {
  private async failStaleVerificationUploads(rel: {
    id: string;
    deliverableUploads: Array<{
      id: string;
      verificationStatus: string;
      verificationReason: string | null;
      verificationConfidence: number | null;
      updatedAt: Date;
    }>;
  }) {
    const staleUploads = rel.deliverableUploads.filter((upload) =>
      upload.verificationStatus === 'SCANNING'
      && Date.now() - upload.updatedAt.getTime() >= VERIFICATION_STALE_MS);
    if (staleUploads.length === 0) return;

    const reason = env.START_WORKERS
      ? 'Verification worker did not complete in time. Retry verification or check the AI pipeline queue.'
      : 'AI verification worker is disabled (START_WORKERS=false). Enable workers and retry verification.';

    await prisma.deliverableUpload.updateMany({
      where: { id: { in: staleUploads.map((upload) => upload.id) } },
      data: {
        verificationStatus: 'FAILED',
        verificationConfidence: 0,
        verificationReason: reason,
      },
    });

    for (const upload of rel.deliverableUploads) {
      if (staleUploads.some((stale) => stale.id === upload.id)) {
        upload.verificationStatus = 'FAILED';
        upload.verificationConfidence = 0;
        upload.verificationReason = reason;
      }
    }
  }

  async ensurePendingRelationshipStatusesReady() {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_enum e
      INNER JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'RelationshipStatus'
        AND e.enumlabel IN ('PENDING_ON_CHAIN', 'FAILED_ON_CHAIN')
    `;
    const present = new Set(rows.map((row) => row.enumlabel));
    const missing = PENDING_RELATIONSHIP_STATUSES.filter((status) => !present.has(status));
    if (missing.length > 0) {
      throw new DatabaseMigrationRequiredError([...missing]);
    }
  }

  async findScoped(suiObjectId: string, tenantId: string | null, walletAddress: string) {
    return prisma.paymentRelationship.findFirst({
      where: {
        suiObjectId,
        OR: [
          ...(tenantId ? [{ tenantId }] : []),
          { payerWallet: { equals: walletAddress, mode: 'insensitive' } },
          { recipientWallet: { equals: walletAddress, mode: 'insensitive' } },
          { capabilities: { some: { holderWallet: { equals: walletAddress, mode: 'insensitive' }, revokedAt: null } } },
        ],
      },
      include: { milestones: true, completionAttestations: true, capabilities: true, deliverableUploads: true },
    });
  }

  async createRelationship(
    actor: RelationshipActor,
    tenantId: string | null,
    body: {
      recipientWallet: string;
      milestones: Array<{ amount: string; conditionType: string; conditionValue: string; releasePolicy?: string }>;
      memo: string;
    },
  ) {
    const recipientWallet = canonicalWalletAddress(sanitize(body.recipientWallet));
    const memSpace = await walrusService.initMemorySpace();
    const totalLocked = body.milestones.reduce((acc, milestone) => acc + parseHumanAmount(milestone.amount), 0n);
    const recipient = await prisma.user.findUnique({ where: { walletAddress: recipientWallet } });
    const recipientEmail = recipient?.emailNotifications ? recipient.notificationEmail ?? '' : '';

    const relationship = await prisma.$transaction(async (tx) => {
      const rel = await tx.paymentRelationship.create({
        data: {
          suiObjectId: `pending-${crypto.randomUUID()}`,
          tenantId,
          payerWallet: actor.walletAddress,
          recipientWallet,
          memo: sanitize(body.memo),
          milestoneCount: body.milestones.length,
          totalLockedAmount: totalLocked,
          walrusMemorySpaceId: memSpace.spaceId,
          contractVersion: 2,
          legacyReadOnly: false,
          assetType: paymentAsset.type,
          assetSymbol: paymentAsset.symbol,
          assetDecimals: paymentAsset.decimals,
        },
      });

      for (let i = 0; i < body.milestones.length; i++) {
        const milestone = body.milestones[i]!;
        await tx.milestone.create({
          data: {
            relationshipId: rel.id,
            milestoneIndex: i,
            amount: parseHumanAmount(milestone.amount),
            conditionType: milestone.conditionType as 'MANUAL' | 'TIME_GATED' | 'DELIVERABLE',
            conditionValue: sanitize(milestone.conditionValue),
            releasePolicy: (milestone.releasePolicy ?? 'PAYER_APPROVAL') as 'PAYER_APPROVAL' | 'AUTO_AFTER_CHALLENGE',
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateId: rel.id,
          aggregateType: 'PaymentRelationship',
          eventType: 'RELATIONSHIP_CREATED',
          payload: {
            recipientEmail,
            recipientWallet,
            notificationType: 'RELATIONSHIP_CREATED',
            subject: 'New Payment Relationship Created',
            bodyHtml: `<p>A relationship with ${body.milestones.length} milestones has been created.</p>`,
            tenantId,
            relationshipId: rel.id,
          } as Prisma.InputJsonObject,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'RELATIONSHIP_CREATED',
          targetType: 'PaymentRelationship',
          targetId: rel.id,
          after: { suiObjectId: rel.suiObjectId, totalLockedAmount: rel.totalLockedAmount.toString() },
        },
      });

      return rel;
    });

    return toJsonSafe(relationship);
  }

  async createPendingRelationship(
    actor: RelationshipActor,
    tenantId: string | null,
    body: {
      recipientWallet: string;
      milestones: Array<{ amount: string; conditionType: string; conditionValue: string; releasePolicy?: string }>;
      memo: string;
      walrusMemorySpaceId: string;
      clientRequestId?: string;
    },
  ) {
    await this.ensurePendingRelationshipStatusesReady();
    if (body.clientRequestId) {
      const existing = await prisma.paymentRelationship.findUnique({
        where: { clientRequestId: body.clientRequestId },
        include: { milestones: true },
      });
      if (existing) return existing;
    }
    const recipientWallet = canonicalWalletAddress(sanitize(body.recipientWallet));
    const totalLocked = body.milestones.reduce((acc, milestone) => acc + parseHumanAmount(milestone.amount), 0n);

    const relationship = await prisma.$transaction(async (tx) => {
      const rel = await tx.paymentRelationship.create({
        data: {
          suiObjectId: `pending-${crypto.randomUUID()}`,
          tenantId,
          payerWallet: actor.walletAddress,
          recipientWallet,
          memo: sanitize(body.memo),
          milestoneCount: body.milestones.length,
          totalLockedAmount: totalLocked,
          walrusMemorySpaceId: body.walrusMemorySpaceId,
          status: 'PENDING_ON_CHAIN',
          contractVersion: 2,
          legacyReadOnly: false,
          assetType: paymentAsset.type,
          assetSymbol: paymentAsset.symbol,
          assetDecimals: paymentAsset.decimals,
          ...(body.clientRequestId ? { clientRequestId: body.clientRequestId } : {}),
        },
      });

      for (let i = 0; i < body.milestones.length; i++) {
        const milestone = body.milestones[i]!;
        await tx.milestone.create({
          data: {
            relationshipId: rel.id,
            milestoneIndex: i,
            amount: parseHumanAmount(milestone.amount),
            conditionType: milestone.conditionType as 'MANUAL' | 'TIME_GATED' | 'DELIVERABLE',
            conditionValue: sanitize(milestone.conditionValue),
            releasePolicy: (milestone.releasePolicy ?? 'PAYER_APPROVAL') as 'PAYER_APPROVAL' | 'AUTO_AFTER_CHALLENGE',
          },
        });
      }

      if (body.clientRequestId) {
        await tx.agentAction.updateMany({
          where: {
            correlationId: body.clientRequestId,
            relationshipId: null,
          },
          data: { relationshipId: rel.id },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'RELATIONSHIP_CREATED',
          targetType: 'PaymentRelationship',
          targetId: rel.id,
          metadata: { phase: 'pending_on_chain' },
          after: { suiObjectId: rel.suiObjectId, totalLockedAmount: rel.totalLockedAmount.toString() },
        },
      });

      return rel;
    });

    return relationship;
  }

  async listRelationships(actor: RelationshipActor, tenantId: string | null, page: number, limit: number) {
    const guard = tenantGuard.forEither(tenantId, actor.walletAddress);
    const data = await guard.relationships.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } });
    const total = await guard.relationships.count();
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async listAssignedRelationships(actor: RelationshipActor, page: number, limit: number) {
    const where: Prisma.PaymentRelationshipWhereInput = {
      recipientWallet: { equals: actor.walletAddress, mode: 'insensitive' },
    };
    const [data, total] = await Promise.all([
      prisma.paymentRelationship.findMany({
        where,
        include: { milestones: true, deliverableUploads: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentRelationship.count({ where }),
    ]);
    const recipientData = data.map((relationship) => {
      const milestoneActions: Record<number, RelationshipAction[]> = {};
      for (const milestone of relationship.milestones) {
        milestoneActions[milestone.milestoneIndex] = (
          !relationship.legacyReadOnly
          && relationship.status === 'ACTIVE'
          && recipientCanSubmitDeliverable(milestone, relationship.deliverableUploads)
        ) ? [RelationshipAction.SUBMIT_DELIVERABLE] : [];
      }
      return {
        ...relationship,
        actorRole: RelationshipActorRole.RECIPIENT,
        milestoneActions,
        availableActions: Array.from(new Set(Object.values(milestoneActions).flat())),
        lifecycleGuidance: this.lifecycleGuidance(relationship, RelationshipActorRole.RECIPIENT),
      };
    });
    return toJsonSafe({ data: recipientData, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async findPendingByClientRequest(actor: RelationshipActor, clientRequestId: string) {
    return prisma.paymentRelationship.findFirst({
      where: { clientRequestId, payerWallet: actor.walletAddress, status: 'PENDING_ON_CHAIN' },
      include: { milestones: true },
    });
  }

  async getRelationship(actor: RelationshipActor, tenantId: string | null, suiObjectId: string) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return null;
    await this.failStaleVerificationUploads(rel);
    const activeOperatorCap = rel.capabilities.find((cap) =>
      cap.capabilityType === 'OPERATOR'
      && walletsEqual(cap.holderWallet, actor.walletAddress)
      && !cap.revokedAt
      && cap.expiresAt.getTime() > Date.now());
    const actorRole = walletsEqual(rel.payerWallet, actor.walletAddress)
      ? RelationshipActorRole.PAYER
      : walletsEqual(rel.recipientWallet, actor.walletAddress)
        ? RelationshipActorRole.RECIPIENT
        : activeOperatorCap
          ? RelationshipActorRole.OPERATOR
          : RelationshipActorRole.VIEWER;
    const operatorPermissions = (activeOperatorCap?.permissions as Record<string, boolean> | null) ?? {};
    const canRelease = actorRole === RelationshipActorRole.PAYER
      || (actorRole === RelationshipActorRole.OPERATOR && operatorPermissions['canRelease'] === true);
    const canCancel = actorRole === RelationshipActorRole.PAYER
      || (actorRole === RelationshipActorRole.OPERATOR && operatorPermissions['canCancel'] === true);
    const canDispute = actorRole === RelationshipActorRole.PAYER
      || (actorRole === RelationshipActorRole.OPERATOR && operatorPermissions['canDispute'] === true);

    const milestoneActions: Record<number, RelationshipAction[]> = {};
    for (const milestone of rel.milestones) {
      const actions: RelationshipAction[] = [];
      if (!rel.legacyReadOnly && rel.status === 'ACTIVE') {
        if (
          actorRole === RelationshipActorRole.RECIPIENT
          && recipientCanSubmitDeliverable(milestone, rel.deliverableUploads)
        ) actions.push(RelationshipAction.SUBMIT_DELIVERABLE);
        if (
          canRelease
          && (
            (milestone.conditionType === ConditionType.MANUAL && milestone.status === MilestoneStatus.PENDING)
            || milestone.status === MilestoneStatus.CONDITION_MET
          )
        ) actions.push(RelationshipAction.APPROVE_RELEASE);
        if (canCancel && milestone.status === MilestoneStatus.PENDING) actions.push(RelationshipAction.CANCEL_MILESTONE);
        if (
          canDispute
          && (milestone.status === MilestoneStatus.SUBMITTED || milestone.status === MilestoneStatus.CONDITION_MET)
        ) actions.push(RelationshipAction.RAISE_DISPUTE);
        if (actor.isPlatformAdmin && milestone.status === MilestoneStatus.DISPUTED) {
          actions.push(RelationshipAction.RESOLVE_DISPUTE);
        }
      }
      milestoneActions[milestone.milestoneIndex] = actions;
    }
    const availableActions = Array.from(new Set(Object.values(milestoneActions).flat()));
    if (!rel.legacyReadOnly && actorRole === RelationshipActorRole.PAYER) {
      availableActions.push(RelationshipAction.MANAGE_AUTOMATION, RelationshipAction.MANAGE_OPERATORS);
      if (rel.milestones.some((milestone) => milestone.status === MilestoneStatus.PENDING)) {
        availableActions.push(RelationshipAction.CANCEL_REMAINING);
      }
    }
    return toJsonSafe({
      ...rel,
      actorRole,
      availableActions: Array.from(new Set(availableActions)),
      milestoneActions,
      lifecycleGuidance: this.lifecycleGuidance(rel, actorRole),
    });
  }

  private lifecycleGuidance(
    rel: { legacyReadOnly: boolean; milestones: Array<{ status: string; conditionType: string }> },
    actorRole: RelationshipActorRole,
  ): string {
    if (rel.legacyReadOnly) return 'This v1 relationship is preserved as read-only history.';
    if (actorRole === RelationshipActorRole.RECIPIENT) {
      if (rel.milestones.some((m) => m.conditionType === 'DELIVERABLE' && m.status === 'PENDING')) {
        return 'Upload the next deliverable when your work is ready.';
      }
      if (rel.milestones.some((m) => m.status === 'SUBMITTED')) return 'Your deliverable is awaiting verification.';
      if (rel.milestones.some((m) => m.status === 'CONDITION_MET')) return 'Verification passed. The payer is reviewing release.';
      if (rel.milestones.some((m) => m.conditionType === 'MANUAL' && m.status === 'PENDING')) {
        return 'No proof upload is required for this manual milestone. The payer releases it after confirming the agreed work.';
      }
      if (rel.milestones.some((m) => m.conditionType === 'TIME_GATED' && m.status === 'PENDING')) {
        return 'No proof upload is required. This milestone remains locked until its configured release time.';
      }
      if (rel.milestones.every((m) => ['RELEASED', 'CANCELLED'].includes(m.status))) {
        return 'This relationship has no remaining recipient action. Released milestones minted completion attestations automatically.';
      }
    }
    if (actorRole === RelationshipActorRole.PAYER || actorRole === RelationshipActorRole.OPERATOR) {
      if (rel.milestones.some((m) => m.status === 'CONDITION_MET')) return 'Review verified evidence and approve or dispute the milestone.';
      if (rel.milestones.some((m) => m.conditionType === 'MANUAL' && m.status === 'PENDING')) {
        return 'Approve the manual milestone when the agreed work is complete.';
      }
      if (rel.milestones.some((m) => m.status === 'SUBMITTED')) return 'A deliverable was submitted and is being verified.';
    }
    return 'No action is required from you right now.';
  }

  async buildRelationshipPtb(
    actor: RelationshipActor,
    tenantId: string | null,
    suiObjectId: string,
    txType: string,
    build: (relId: string) => Promise<{ txBytes: string }>,
    metadata: Record<string, unknown> = {},
  ) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (rel.legacyReadOnly || rel.contractVersion !== 2) {
      return {
        unavailable: true as const,
        message: 'This v1 relationship is read-only and cannot perform v2 lifecycle actions.',
      };
    }
    if (rel.status !== 'ACTIVE') {
      return {
        unavailable: true as const,
        message: 'This relationship is not active on-chain yet. Complete setup or wait for indexing before performing lifecycle actions.',
      };
    }
    try {
      const result = await build(suiObjectId);
      await prisma.auditLog.create({
        data: {
          tenantId: rel.tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: txType === 'RESOLVE_DISPUTE' ? 'DISPUTE_RESOLVED' : 'RELATIONSHIP_PTB_BUILT',
          targetType: 'PaymentRelationship',
          targetId: rel.id,
          metadata: { txType, ...metadata },
        },
      });
      return { result };
    } catch (error) {
      if (error instanceof PtbSimulationError) return { simulationError: error };
      throw error;
    }
  }

  async grantAgentCap(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, body: {
    agentAddress?: string;
    expiryDurationSeconds?: number;
    allowedActions?: number[];
    maxActions?: number;
  }) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return { forbidden: true as const, message: 'Only the payer may grant relationship automation.' };
    }
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'GRANT_AGENT_CAP', (relationshipId) =>
      ptbBuilder.buildGrantAgentCap({
        relationshipId,
        agentAddress: body.agentAddress ?? agentAddress,
        expiryDurationS: body.expiryDurationSeconds ?? 86400,
        allowedActions: body.allowedActions ?? [0],
        maxActions: body.maxActions ?? 100,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
    );
  }

  async revokeAgentCap(actor: RelationshipActor, tenantId: string | null, suiObjectId: string) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return { forbidden: true as const, message: 'Only the payer may revoke relationship automation.' };
    }
    const cap = rel.capabilities.find((item) => item.capabilityType === 'AGENT' && !item.revokedAt);
    if (!cap) return { unavailable: true as const, message: 'No active automation capability exists.' };
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'REVOKE_AGENT_CAP', (relationshipId) =>
      ptbBuilder.buildRevokeAgentCap({
        relationshipId,
        capId: cap.suiObjectId,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
    );
  }

  async cancelRelationship(actor: RelationshipActor, tenantId: string | null, suiObjectId: string) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return { forbidden: true as const, message: 'Only the original payer may cancel all remaining milestones.' };
    }
    if (!rel.milestones.some((milestone) => milestone.status === MilestoneStatus.PENDING)) {
      return { unavailable: true as const, message: 'There are no pending milestones left to cancel.' };
    }
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'CANCEL_RELATIONSHIP', (relationshipId) =>
      ptbBuilder.buildCancelRelationship({ relationshipId, coinType: rel.assetType, sender: actor.walletAddress }),
    );
  }

  private async activeOperatorCapability(
    relationshipId: string,
    walletAddress: string,
    permission: 'canRelease' | 'canCancel' | 'canDispute',
  ) {
    const cap = await prisma.relationshipCapability.findFirst({
      where: {
        relationshipId,
        holderWallet: { equals: walletAddress, mode: 'insensitive' },
        capabilityType: 'OPERATOR',
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    const permissions = cap?.permissions as Record<string, boolean> | null;
    return cap && permissions?.[permission] === true ? cap : null;
  }

  async releaseMilestone(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, milestoneIndex: number) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (rel.legacyReadOnly || rel.contractVersion !== 2) {
      return { unavailable: true as const, message: 'This v1 relationship is read-only.' };
    }
    const milestone = rel.milestones.find((item) => item.milestoneIndex === milestoneIndex);
    if (!milestone) return { unavailable: true as const, message: 'Milestone not found.' };
    const releaseAllowed =
      (milestone.conditionType === ConditionType.MANUAL && milestone.status === MilestoneStatus.PENDING)
      || milestone.status === MilestoneStatus.CONDITION_MET;
    if (!releaseAllowed) {
      return {
        unavailable: true as const,
        message: milestone.conditionType === ConditionType.DELIVERABLE
          ? 'Deliverable milestones can only be released after verified evidence or dispute resolution.'
          : 'This milestone is not currently releasable.',
      };
    }
    if (walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'RELEASE_MILESTONE', (relationshipId) =>
        ptbBuilder.buildReleaseMilestone({
          relationshipId,
          milestoneIndex,
          coinType: rel.assetType,
          sender: actor.walletAddress,
        }),
        { milestoneIndex },
      );
    }
    const cap = await this.activeOperatorCapability(rel.id, actor.walletAddress, 'canRelease');
    if (!cap) return { forbidden: true as const, message: 'An active operator release capability is required.' };
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'RELEASE_MILESTONE', (relationshipId) =>
      ptbBuilder.buildOperatorReleaseMilestone({
        relationshipId,
        milestoneIndex,
        operatorCapId: cap.suiObjectId,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
      { milestoneIndex, capabilityId: cap.id },
    );
  }

  submitDeliverable(
    actor: RelationshipActor,
    tenantId: string | null,
    suiObjectId: string,
    milestoneIndex: number,
    blobId: string,
  ) {
    return this.submitDeliverableAuthorized(actor, tenantId, suiObjectId, milestoneIndex, blobId);
  }

  private async submitDeliverableAuthorized(
    actor: RelationshipActor,
    tenantId: string | null,
    suiObjectId: string,
    milestoneIndex: number,
    blobId: string,
  ) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!walletsEqual(rel.recipientWallet, actor.walletAddress)) {
      return { forbidden: true as const, message: 'Only the assigned recipient may submit this deliverable.' };
    }
    const milestone = rel.milestones.find((item) => item.milestoneIndex === milestoneIndex);
    if (!milestone) return { unavailable: true as const, message: 'Milestone not found.' };
    if (milestone.conditionType !== ConditionType.DELIVERABLE) {
      return { unavailable: true as const, message: 'This milestone uses payer approval and does not require proof submission.' };
    }
    if (!recipientCanSubmitDeliverable(milestone, rel.deliverableUploads)) {
      return { unavailable: true as const, message: 'This deliverable is not ready for another on-chain submission.' };
    }
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'SUBMIT_DELIVERABLE', (relationshipId) =>
      ptbBuilder.buildSubmitDeliverable({
        relationshipId,
        milestoneIndex,
        blobId,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
      { milestoneIndex, blobId },
    );
  }

  async grantOperatorCap(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, body: {
    operatorAddress: string;
    expiryDurationSeconds: number;
    canRelease: boolean;
    canCancel: boolean;
    canDispute: boolean;
  }) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return { forbidden: true as const, message: 'Only the payer may grant workspace operator capabilities.' };
    }
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'GRANT_OPERATOR_CAP', (relationshipId) =>
      ptbBuilder.buildGrantOperatorCap({
        relationshipId,
        operatorAddress: body.operatorAddress,
        expiryDurationS: body.expiryDurationSeconds,
        canRelease: body.canRelease,
        canCancel: body.canCancel,
        canDispute: body.canDispute,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
    );
  }

  async raiseDispute(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, milestoneIndex: number, reasonHash: string) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'RAISE_DISPUTE', (relationshipId) =>
        ptbBuilder.buildRaiseDispute({
          relationshipId,
          milestoneIndex,
          reasonHash,
          coinType: rel.assetType,
          sender: actor.walletAddress,
        }),
        { milestoneIndex },
      );
    }
    const cap = await this.activeOperatorCapability(rel.id, actor.walletAddress, 'canDispute');
    if (!cap) return { forbidden: true as const, message: 'An active operator dispute capability is required.' };
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'RAISE_DISPUTE', (relationshipId) =>
      ptbBuilder.buildOperatorRaiseDispute({
        relationshipId,
        milestoneIndex,
        reasonHash,
        operatorCapId: cap.suiObjectId,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
      { milestoneIndex, capabilityId: cap.id },
    );
  }

  async uploadDisputeEvidence(
    actor: RelationshipActor,
    tenantId: string | null,
    suiObjectId: string,
    milestoneIndex: number,
    reason: string,
  ) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    const isPayer = walletsEqual(rel.payerWallet, actor.walletAddress);
    const operatorCap = isPayer
      ? null
      : await this.activeOperatorCapability(rel.id, actor.walletAddress, 'canDispute');
    if (!isPayer && !operatorCap) {
      return { forbidden: true as const, message: 'Only the payer or an authorized operator may raise a dispute.' };
    }
    const milestone = rel.milestones.find((item) => item.milestoneIndex === milestoneIndex);
    if (!milestone || !['SUBMITTED', 'CONDITION_MET'].includes(milestone.status)) {
      return { unavailable: true as const, message: 'This milestone is not in a disputable state.' };
    }
    const content = Buffer.from(reason.trim(), 'utf8');
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(content));
    const reasonHash = Buffer.from(digest).toString('hex');
    const { blobId } = await walrusService.uploadBlob(content, 'text/plain');
    await prisma.$transaction([
      prisma.milestone.update({
        where: { relationshipId_milestoneIndex: { relationshipId: rel.id, milestoneIndex } },
        data: { disputeReasonHash: reasonHash, disputeWalrusBlobId: blobId },
      }),
      prisma.usageRecord.create({
        data: {
          walletAddress: actor.walletAddress,
          tenantId: rel.tenantId,
          relationshipId: rel.id,
          resourceType: 'WALRUS_BYTES',
          quantity: BigInt(content.length),
          estimatedCostUsd: 0,
          recordedAt: new Date(),
        },
      }),
    ]);
    return { reasonHash, walrusBlobId: blobId };
  }

  async resolveDispute(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, milestoneIndex: number, resolution: number) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (!actor.isPlatformAdmin) {
      return { forbidden: true as const, message: 'Only a platform administrator may resolve disputes.' };
    }
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'RESOLVE_DISPUTE', (relationshipId) =>
      ptbBuilder.buildResolveDispute({
        relationshipId,
        milestoneIndex,
        resolution,
        adminCapId: env.SUI_ADMIN_CAP_ID,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
      { milestoneIndex, resolution },
    );
  }

  async cancelMilestone(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, milestoneIndex: number) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return { notFound: true as const };
    if (walletsEqual(rel.payerWallet, actor.walletAddress)) {
      return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'CANCEL_MILESTONE', (relationshipId) =>
        ptbBuilder.buildCancelMilestone({
          relationshipId,
          milestoneIndex,
          coinType: rel.assetType,
          sender: actor.walletAddress,
        }),
        { milestoneIndex },
      );
    }
    const cap = await this.activeOperatorCapability(rel.id, actor.walletAddress, 'canCancel');
    if (!cap) return { forbidden: true as const, message: 'An active operator cancellation capability is required.' };
    return this.buildRelationshipPtb(actor, tenantId, suiObjectId, 'CANCEL_MILESTONE', (relationshipId) =>
      ptbBuilder.buildOperatorCancelMilestone({
        relationshipId,
        milestoneIndex,
        operatorCapId: cap.suiObjectId,
        coinType: rel.assetType,
        sender: actor.walletAddress,
      }),
      { milestoneIndex, capabilityId: cap.id },
    );
  }

  async getRelationshipAudit(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, page: number, limit: number) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return null;
    const fetchDepth = auditFetchDepth(page, limit);
    const [
      auditLogs,
      agentActions,
      notifications,
      transactions,
      auditLogCount,
      agentActionCount,
      notificationCount,
      transactionCount,
    ] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId: rel.tenantId, targetId: rel.id },
        orderBy: { createdAt: 'desc' },
        take: fetchDepth,
      }),
      prisma.agentAction.findMany({
        where: { relationshipId: rel.id },
        orderBy: { createdAt: 'desc' },
        take: fetchDepth,
      }),
      prisma.notification.findMany({
        where: { relationshipId: rel.id },
        orderBy: { createdAt: 'desc' },
        take: fetchDepth,
      }),
      prisma.submittedTransaction.findMany({
        where: { relationshipId: rel.id },
        orderBy: { createdAt: 'desc' },
        take: fetchDepth,
      }),
      prisma.auditLog.count({ where: { tenantId: rel.tenantId, targetId: rel.id } }),
      prisma.agentAction.count({ where: { relationshipId: rel.id } }),
      prisma.notification.count({ where: { relationshipId: rel.id } }),
      prisma.submittedTransaction.count({ where: { relationshipId: rel.id } }),
    ]);

    const summarizeAuditLog = (event: (typeof auditLogs)[number]) => {
      const metadata = (event.metadata as Record<string, unknown> | null) ?? {};
      if (event.action === 'RELATIONSHIP_CREATED') {
        if (metadata.phase === 'pending_on_chain') return 'RELATIONSHIP SETUP PREPARED';
        if (metadata.phase === 'failed_before_chain_submission') return 'RELATIONSHIP SETUP FAILED';
        if (metadata.phase === 'confirmed_on_chain') return 'RELATIONSHIP CREATED ON CHAIN';
      }
      return event.action.replaceAll('_', ' ');
    };

    const entries = [
      ...auditLogs.map((event) => ({
        id: event.id,
        type: 'audit',
        timestamp: event.createdAt,
        actor: event.actorWallet ?? event.actorUserId ?? 'system',
        summary: summarizeAuditLog(event),
        metadata: { targetType: event.targetType, targetId: event.targetId, before: event.before, after: event.after, ...((event.metadata as Record<string, unknown> | null) ?? {}) },
      })),
      ...agentActions.map((event) => ({
        id: event.id,
        type: 'ai_action',
        timestamp: event.createdAt,
        actor: 'ai-agent',
        summary: event.actionType.replaceAll('_', ' '),
        metadata: {
          actionType: event.actionType,
          payload: event.payload,
          result: event.result,
          confidence: typeof event.result === 'object' && event.result && 'confidence' in event.result ? (event.result as { confidence?: unknown }).confidence : null,
          model: event.aiModel,
          promptVersion: event.promptVersion,
          durationMs: event.durationMs,
          estimatedCostUsd: event.estimatedCostUsd,
        },
      })),
      ...notifications.map((event) => ({
        id: event.id,
        type: 'notification',
        timestamp: event.createdAt,
        actor: event.recipientWallet,
        summary: event.subject,
        metadata: { notificationType: event.notificationType, sent: event.sent, sentAt: event.sentAt, error: event.error },
      })),
      ...transactions.map((event) => ({
        id: event.id,
        type: 'transaction',
        timestamp: event.createdAt,
        actor: event.submittedBy,
        summary: `${event.txType.replaceAll('_', ' ')} · ${event.status}`,
        metadata: { digest: event.digest, txType: event.txType, status: event.status, gasUsed: event.gasUsed, error: event.error },
      })),
    ];

    const total = auditLogCount + agentActionCount + notificationCount + transactionCount;
    const data = paginateAuditEntries(entries, page, limit);
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async getRelationshipAgentActions(actor: RelationshipActor, tenantId: string | null, suiObjectId: string, page: number, limit: number) {
    const rel = await this.findScoped(suiObjectId, tenantId, actor.walletAddress);
    if (!rel) return null;
    const data = await prisma.agentAction.findMany({
      where: { relationshipId: rel.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.agentAction.count({ where: { relationshipId: rel.id } });
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  async reconcileCreateTransaction(params: {
    relationshipId: string;
    digest: string;
    actor: RelationshipActor;
    tenantId: string | null;
  }) {
    const relationship = await prisma.paymentRelationship.findFirst({
      where: {
        id: params.relationshipId,
        tenantId: params.tenantId,
        payerWallet: params.actor.walletAddress,
      },
    });
    if (!relationship) return { notFound: true as const };
    if (!relationship.suiObjectId.startsWith('pending-')) {
      return toJsonSafe({ relationship, reconciled: false, alreadyActive: true });
    }
    if (relationship.status === 'FAILED_ON_CHAIN') {
      return { failed: true as const, error: 'Relationship is already marked as failed on-chain' };
    }

    const transaction = await suiClient.getTransactionBlock({
      digest: params.digest,
      options: { showEvents: true, showEffects: true, showObjectChanges: true },
    });
    const status = transaction.effects?.status?.status;
    if (status && status !== 'success') {
      await this.markRelationshipFailed(params.relationshipId, transaction.effects?.status?.error ?? 'Transaction failed on-chain');
      return { failed: true as const, error: transaction.effects?.status?.error ?? 'Transaction failed on-chain' };
    }

    const createdEvent = transaction.events?.find((event: { type: string }) => event.type.includes('RelationshipCreatedEvent'));
    const payload = createdEvent?.parsedJson as Record<string, unknown> | undefined;
    const onChainId = payload?.['relationship_id'] ?? payload?.['relationshipId'];
    const suiObjectId = typeof onChainId === 'string'
      ? onChainId
      : typeof onChainId === 'object' && onChainId && 'id' in onChainId
        ? String((onChainId as { id: unknown }).id)
        : null;

    if (!suiObjectId) {
      return { pending: true as const };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rel = await tx.paymentRelationship.update({
        where: { id: params.relationshipId },
        data: { suiObjectId, status: 'ACTIVE' },
        include: { milestones: true },
      });
      await tx.submittedTransaction.updateMany({
        where: { digest: params.digest },
        data: { relationshipId: params.relationshipId, status: 'CONFIRMED', confirmedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: params.actor.userId,
          actorWallet: params.actor.walletAddress,
          action: 'RELATIONSHIP_CREATED',
          targetType: 'PaymentRelationship',
          targetId: rel.id,
          metadata: { phase: 'confirmed_on_chain', digest: params.digest },
          after: { suiObjectId },
        },
      });
      return rel;
    });

    return toJsonSafe({ relationship: updated, reconciled: true });
  }

  async markRelationshipFailed(relationshipId: string, error: string) {
    await prisma.paymentRelationship.updateMany({
      where: { id: relationshipId, suiObjectId: { startsWith: 'pending-' } },
      data: { status: 'FAILED_ON_CHAIN' },
    });
    await prisma.submittedTransaction.updateMany({
      where: { relationshipId },
      data: { status: 'FAILED', error },
    });
  }

  async markPendingCreateFailed(actor: RelationshipActor, tenantId: string | null, relationshipId: string, error: string) {
    const result = await prisma.paymentRelationship.updateMany({
      where: {
        id: relationshipId,
        tenantId,
        payerWallet: actor.walletAddress,
        suiObjectId: { startsWith: 'pending-' },
      },
      data: { status: 'FAILED_ON_CHAIN' },
    });
    if (result.count === 0) return { notFound: true as const };
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actor.userId,
        actorWallet: actor.walletAddress,
        action: 'RELATIONSHIP_CREATED',
        targetType: 'PaymentRelationship',
        targetId: relationshipId,
        metadata: { phase: 'failed_before_chain_submission', error },
      },
    });
    return { ok: true as const };
  }
}

export const relationshipManagementService = new RelationshipManagementService();
