/**
 * Multi-step deliverable verification agent using tool-calling.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { AgentRunner } from './agent-runner';
import { featureFlagService } from '../services/feature-flags';
import { walrusService } from '../services/walrus';
import { distributedLock } from '../lib/distributed-lock';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import {
  DeliveryVerificationOutputSchema,
  FEATURE_FLAG_KEYS,
  PROMPT_KEYS,
  SAFE_DEFAULTS,
  type DeliveryVerificationOutput,
} from '@bondflow/types';
import { AGENT_MODELS } from './models';
import { agentAddress, executeTransaction } from '../lib/sui-client';
import { ptbBuilder } from '../services/ptb-builder';
import { applyBlockchainEvent } from '../workers/event-handlers';

const dvLogger = logger.child({ module: 'deliverable-verification-agent' });

export async function runDeliverableVerification(params: {
  blobId: string;
  relationshipId: string;
  milestoneIndex: number;
  milestoneCondition: string;
  uploadId: string;
  tenantId?: string;
  walletAddress?: string;
}): Promise<DeliveryVerificationOutput> {
  const failUpload = async (
    reason: string,
    data: { confidence?: number; evidenceHash?: string } = {},
  ) => {
    await prisma.deliverableUpload.update({
      where: { id: params.uploadId },
      data: {
        verificationStatus: 'FAILED',
        verificationConfidence: data.confidence ?? 0,
        verificationReason: reason,
        ...(data.evidenceHash ? { verificationEvidenceHash: data.evidenceHash } : {}),
      },
    });
  };

  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, params.tenantId);
  if (!enabled) {
    const reason = 'AI verification disabled for this workspace.';
    await failUpload(reason);
    return { ...SAFE_DEFAULTS.deliveryVerification, reason };
  }

  const lockResource = `bondflow:lock:verify:${params.blobId}`;
  let decision: DeliveryVerificationOutput;
  try {
    const result = await distributedLock.withLock(lockResource, 30000, async () => {
      await prisma.deliverableUpload.update({
        where: { id: params.uploadId },
        data: { verificationStatus: 'SCANNING' },
      });
      const fetchBlobMetadataTool = tool({
        description: 'Retrieve metadata about a Walrus blob by its ID',
        inputSchema: z.object({ blobId: z.string() }),
        execute: async ({ blobId }: { blobId: string }) => {
          try {
            return await walrusService.fetchBlobMetadata(blobId);
          } catch {
            return { error: 'Failed to fetch blob metadata' };
          }
        },
      });

      const compareContentHashTool = tool({
        description: 'Compare SHA-256 hashes of expected vs actual content',
        inputSchema: z.object({ expectedHash: z.string(), actualHash: z.string() }),
        execute: async ({ expectedHash, actualHash }: { expectedHash: string; actualHash: string }) => ({
          match: expectedHash === actualHash,
        }),
      });

      const checkDeliverableHistoryTool = tool({
        description: 'Check if this deliverable has been submitted before',
        inputSchema: z.object({ sha256Hash: z.string() }),
        execute: async ({ sha256Hash }: { sha256Hash: string }) => {
          const existing = await prisma.deliverableUpload.findFirst({ where: { sha256Hash } });
          return { previouslySubmitted: !!existing, existingBlobId: existing?.walrusBlobId ?? null };
        },
      });

      const text = await AgentRunner.runWithTools({
        promptKey: PROMPT_KEYS.DELIVERY_VERIFICATION_TOOL_CALLING,
        model: AGENT_MODELS.fast,
        userMessage: `Verify deliverable and return only compact JSON matching this exact shape:
{"verified":boolean,"reason":string,"confidence":integer 0-100,"blobIdMatch":boolean}

Blob ID: ${params.blobId}
Relationship: ${params.relationshipId}
Milestone: ${params.milestoneIndex}
Condition: ${params.milestoneCondition}`,
        tools: {
          fetch_blob_metadata: fetchBlobMetadataTool,
          compare_content_hash: compareContentHashTool,
          check_deliverable_history: checkDeliverableHistoryTool,
        },
        maxSteps: 5,
        actionType: 'DELIVERABLE_VERIFIED',
        relationshipId: params.relationshipId,
        tenantId: params.tenantId,
        metadata: { walletAddress: params.walletAddress ?? 'unknown' },
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Delivery verification returned no JSON decision.');
      }

      const parsed = DeliveryVerificationOutputSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (!parsed.success) {
        throw new Error(`Delivery verification failed schema validation: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
      }
      return parsed.data;
    });
    decision = result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Delivery verification failed';
    dvLogger.error({ blobId: params.blobId, uploadId: params.uploadId, error: reason }, 'Delivery verification could not complete');
    await failUpload(reason);
    throw error;
  }

  const evidence = JSON.stringify({
    blobId: params.blobId,
    relationshipId: params.relationshipId,
    milestoneIndex: params.milestoneIndex,
    verified: decision.verified,
    confidence: decision.confidence,
    reason: decision.reason,
  });
  const evidenceBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(evidence));
  const evidenceHash = Buffer.from(evidenceBytes).toString('hex');

  try {
    const relationship = await prisma.paymentRelationship.findUnique({
      where: { id: params.relationshipId },
    });
    if (!relationship) throw new Error('Relationship no longer exists');
    const cap = await prisma.relationshipCapability.findFirst({
      where: {
        relationshipId: relationship.id,
        capabilityType: 'AGENT',
        holderWallet: agentAddress,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!cap) throw new Error('No active verifier capability is indexed for this relationship');

    const tx = ptbBuilder.buildAgentVerificationTransaction({
      relationshipId: relationship.suiObjectId,
      milestoneIndex: params.milestoneIndex,
      agentCapId: cap.suiObjectId,
      blobId: params.blobId,
      evidenceHash,
      verified: decision.verified,
      coinType: relationship.assetType,
    });
    tx.setSender(agentAddress);
    const executed = await executeTransaction(tx);
    await prisma.deliverableUpload.update({
      where: { id: params.uploadId },
      data: {
        verificationStatus: decision.verified ? 'VERIFIED' : 'REJECTED',
        verificationConfidence: decision.confidence,
        verificationReason: decision.reason,
        verificationEvidenceHash: evidenceHash,
        verifiedAt: new Date(),
      },
    });
    for (const event of executed.events ?? []) {
      await applyBlockchainEvent({
        suiEventId: `${executed.digest}:${event.id.eventSeq}`,
        eventType: event.type,
        payload: (event.parsedJson ?? {}) as Record<string, unknown>,
        sender: event.sender,
        markProcessed: true,
      });
    }
  } catch (error) {
    await failUpload(
      `${decision.reason} Verification transaction failed: ${(error as Error).message}`,
      { confidence: decision.confidence, evidenceHash },
    );
    throw error;
  }

  return decision;
}
