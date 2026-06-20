import { prisma } from '../db/client';
import { env } from '../config/env';
import { walrusService } from './walrus';
import { logger } from '../lib/logger';
import { featureFlagService } from './feature-flags';
import { FEATURE_FLAG_KEYS } from '@bondflow/types';

const deliverableLogger = logger.child({ module: 'deliverable-management' });
const VERIFICATION_STALE_MS = 10 * 60 * 1000;

function buildWalrusBlobUrl(blobId: string): string {
  return `${env.WALRUS_AGGREGATOR_URL.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`;
}

export interface DeliverableActor {
  walletAddress: string;
}

interface AiPipelineJobPayload {
  type: 'content-scan' | 'verify-deliverable';
  blobId?: string;
  relationshipId?: string;
  milestoneIndex?: number;
  milestoneCondition?: string;
  tenantId?: string;
  uploadId?: string;
  content?: string;
  walletAddress?: string;
}

async function enqueueAiPipelineJob(name: string, payload: AiPipelineJobPayload): Promise<string> {
  if (env.EXTERNAL_SERVICES_MODE === 'mock' && !env.START_WORKERS) {
    const jobId = `mock-${name}-${Date.now()}`;
    deliverableLogger.warn(
      { jobId, name },
      'AI pipeline queue skipped because external services are in mock mode and workers are disabled',
    );
    return jobId;
  }

  const { aiPipelineQueue } = await import('../workers/ai-pipeline.worker');
  const job = await aiPipelineQueue.add(name, payload);
  return String(job.id ?? name);
}

export class DeliverableManagementService {
  private async markStaleVerificationFailed(upload: {
    id: string;
    verificationStatus: string;
    verificationReason: string | null;
    updatedAt: Date;
  }) {
    if (
      upload.verificationStatus !== 'SCANNING'
      || Date.now() - upload.updatedAt.getTime() < VERIFICATION_STALE_MS
    ) {
      return upload;
    }

    return prisma.deliverableUpload.update({
      where: { id: upload.id },
      data: {
        verificationStatus: 'FAILED',
        verificationConfidence: 0,
        verificationReason: 'Verification worker did not complete in time. Check START_WORKERS/Redis/AI settings, then retry verification.',
      },
    });
  }

  async validateAndReadUpload(request: Request): Promise<
    | { error: string; status: number }
    | { buffer: Buffer; detectedMime: string; relationshipId: string; milestoneIndex: number }
  > {
    const contentLength = parseInt(request.headers.get('content-length') ?? '0');
    if (contentLength > env.MAX_UPLOAD_BYTES) {
      return { status: 413, error: `File too large. Maximum: ${env.MAX_UPLOAD_BYTES} bytes` };
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) return { status: 400, error: 'No file provided' };
    const relationshipId = String(formData.get('relationshipId') ?? '').trim();
    const milestoneIndex = Number(formData.get('milestoneIndex'));
    if (!relationshipId || !Number.isInteger(milestoneIndex) || milestoneIndex < 0) {
      return { status: 400, error: 'relationshipId and a non-negative milestoneIndex are required' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > env.MAX_UPLOAD_BYTES) {
      return { status: 413, error: `File too large. Maximum: ${env.MAX_UPLOAD_BYTES} bytes` };
    }

    let detectedMime: string = file.type || 'application/octet-stream';
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const result = await fileTypeFromBuffer(buffer.slice(0, 4096));
      if (result) {
        detectedMime = result.mime;
      } else if (!detectedMime.startsWith('text/')) {
        return { status: 415, error: 'Unable to validate file MIME type from content' };
      }
    } catch (error) {
      deliverableLogger.error({ error: (error as Error).message }, 'MIME detection failed');
      return { status: 415, error: 'Unable to validate file MIME type from content' };
    }

    if (!env.ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return { status: 415, error: `File type "${detectedMime}" not allowed. Allowed: ${env.ALLOWED_MIME_TYPES.join(', ')}` };
    }
    return { buffer, detectedMime, relationshipId, milestoneIndex };
  }

  async uploadDeliverable(
    actor: DeliverableActor,
    tenantId: string | null,
    buffer: Buffer,
    detectedMime: string,
    relationshipObjectId: string,
    milestoneIndex: number,
  ) {
    const relationship = await prisma.paymentRelationship.findFirst({
      where: {
        OR: [{ id: relationshipObjectId }, { suiObjectId: relationshipObjectId }],
        recipientWallet: { equals: actor.walletAddress, mode: 'insensitive' },
        legacyReadOnly: false,
        contractVersion: 2,
      },
      include: { milestones: { where: { milestoneIndex } } },
    });
    const milestone = relationship?.milestones[0];
    if (!relationship || !milestone) return { error: 'Relationship or milestone not found', status: 404 };
    if (milestone.conditionType !== 'DELIVERABLE') return { error: 'This milestone does not accept deliverables', status: 409 };
    if (milestone.status !== 'PENDING') return { error: `Milestone is ${milestone.status}; a new upload is not allowed`, status: 409 };

    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
    const sha256Hash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

    const existing = await prisma.deliverableUpload.findFirst({ where: { sha256Hash } });
    if (existing) {
      if (
        existing.uploaderWallet === actor.walletAddress
        && existing.relationshipId === relationship.id
        && existing.milestoneIndex === milestoneIndex
      ) {
        return {
          blobId: existing.walrusBlobId,
          walrusUrl: buildWalrusBlobUrl(existing.walrusBlobId),
          sizeBytes: Number(existing.sizeBytes),
          deduplicated: true,
          uploadId: existing.id,
          verificationStatus: existing.verificationStatus,
        };
      }
      return { error: 'This exact file was already submitted and cannot be reused for another milestone', status: 409 };
    }

    const { blobId } = await walrusService.uploadBlob(buffer, detectedMime);
    const [upload] = await prisma.$transaction([
      prisma.deliverableUpload.create({
        data: {
          uploaderWallet: actor.walletAddress,
          tenantId: relationship.tenantId,
          relationshipId: relationship.id,
          milestoneIndex,
          walrusBlobId: blobId,
          contentType: detectedMime,
          sizeBytes: BigInt(buffer.length),
          sha256Hash,
          mimeValidated: true,
          scanStatus: 'PENDING',
          verificationStatus: 'UPLOADED',
        },
      }),
      prisma.usageRecord.create({
        data: {
          walletAddress: actor.walletAddress,
          tenantId: relationship.tenantId,
          relationshipId: relationship.id,
          resourceType: 'WALRUS_BYTES',
          quantity: BigInt(buffer.length),
          estimatedCostUsd: 0,
          recordedAt: new Date(),
        },
      }),
    ]);

    await enqueueAiPipelineJob('content-scan', {
      type: 'content-scan',
      uploadId: upload.id,
      walletAddress: actor.walletAddress,
      ...(relationship.tenantId ? { tenantId: relationship.tenantId } : {}),
      content: detectedMime.startsWith('text/') ? buffer.toString('utf-8').slice(0, 10000) : `[Binary file: ${detectedMime}]`,
    });

    return {
      blobId,
      walrusUrl: buildWalrusBlobUrl(blobId),
      sizeBytes: buffer.length,
      uploadId: upload.id,
      deduplicated: false,
      scanStatus: 'PENDING',
      verificationStatus: 'UPLOADED',
      relationshipId: relationship.id,
      milestoneIndex,
      scanMeaning: 'AI content classification only; not malware clearance',
    };
  }

  async queueVerification(
    actor: DeliverableActor,
    tenantId: string | null,
    body: { blobId: string; relationshipId: string; milestoneIndex: number; expectedConditionValue?: string; retry?: boolean },
  ) {
    const rel = await prisma.paymentRelationship.findFirst({
      where: {
        OR: [{ id: body.relationshipId }, { suiObjectId: body.relationshipId }],
        recipientWallet: { equals: actor.walletAddress, mode: 'insensitive' },
        legacyReadOnly: false,
      },
      include: { milestones: { where: { milestoneIndex: body.milestoneIndex } } },
    });
    const upload = await prisma.deliverableUpload.findFirst({
      where: {
        relationshipId: rel?.id ?? body.relationshipId,
        milestoneIndex: body.milestoneIndex,
        walrusBlobId: body.blobId,
        uploaderWallet: actor.walletAddress,
      },
    });
    if (!rel || !upload) return { notFound: true as const };
    const milestone = rel.milestones[0];
    if (!milestone) {
      return { invalidState: true as const, message: 'Milestone is not awaiting deliverable verification.' };
    }
    if (milestone.status !== 'SUBMITTED') {
      return {
        invalidState: true as const,
        message: milestone.status === 'PENDING'
          ? 'Submit the proof on-chain before starting AI verification.'
          : `Milestone is ${milestone.status}; it is not awaiting deliverable verification.`,
      };
    }

    const currentUpload = await this.markStaleVerificationFailed(upload);

    if (['SCANNING', 'VERIFIED', 'REJECTED'].includes(currentUpload.verificationStatus)) {
      return {
        jobId: null,
        verificationStatus: currentUpload.verificationStatus,
        message: `Verification is already ${currentUpload.verificationStatus.toLowerCase()}.`,
      };
    }

    if (currentUpload.verificationStatus === 'FAILED' && !body.retry) {
      return {
        jobId: null,
        verificationStatus: currentUpload.verificationStatus,
        message: currentUpload.verificationReason ?? 'Verification previously failed. Retry explicitly to run it again.',
      };
    }

    const enabled = await featureFlagService.isEnabled(
      FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION,
      tenantId ?? rel.tenantId ?? undefined,
    );
    if (!enabled) {
      const updated = await prisma.deliverableUpload.update({
        where: { id: upload.id },
        data: {
          verificationStatus: 'FAILED',
          verificationConfidence: 0,
          verificationReason: 'AI verification disabled for this workspace.',
        },
      });
      return {
        jobId: null,
        verificationStatus: updated.verificationStatus,
        message: updated.verificationReason ?? 'AI verification disabled for this workspace.',
      };
    }

    if (!env.START_WORKERS) {
      const updated = await prisma.deliverableUpload.update({
        where: { id: currentUpload.id },
        data: {
          verificationStatus: 'FAILED',
          verificationConfidence: 0,
          verificationReason: 'AI verification worker is disabled (START_WORKERS=false). Enable workers and retry verification.',
        },
      });
      return {
        jobId: null,
        verificationStatus: updated.verificationStatus,
        message: updated.verificationReason ?? 'AI verification worker is disabled.',
      };
    }

    let jobId: string;
    try {
      await prisma.deliverableUpload.update({
        where: { id: currentUpload.id },
        data: { verificationStatus: 'SCANNING' },
      });

      jobId = await enqueueAiPipelineJob('verify-deliverable', {
        type: 'verify-deliverable',
        blobId: body.blobId,
        relationshipId: rel.id,
        milestoneIndex: body.milestoneIndex,
        milestoneCondition: milestone.conditionValue,
        walletAddress: actor.walletAddress,
        ...(rel.tenantId ? { tenantId: rel.tenantId } : {}),
        uploadId: currentUpload.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to enqueue AI verification job.';
      await prisma.deliverableUpload.update({
        where: { id: currentUpload.id },
        data: {
          verificationStatus: 'FAILED',
          verificationConfidence: 0,
          verificationReason: `Unable to enqueue AI verification job. ${message}`,
        },
      });
      throw error;
    }

    return { jobId, verificationStatus: 'SCANNING' as const, message: 'Verification queued' };
  }
}

export const deliverableManagementService = new DeliverableManagementService();
