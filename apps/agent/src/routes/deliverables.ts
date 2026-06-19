/**
 * Deliverable upload and verification routes.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { checkRateLimit, setRateLimitHeaders, RateLimitTier } from '../lib/rate-limiter';
import { deliverableManagementService } from '../services/deliverable-management';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { relationshipManagementService } from '../services/relationship-management';

function buildWalrusBlobUrl(blobId: string): string {
  return `${env.WALRUS_AGGREGATOR_URL.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`;
}

export const deliverableRoutes = new Elysia({ prefix: '/api/v1/deliverables' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .post('/upload', async ({ auth, request, set, tenantContext }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }

    const rl = await checkRateLimit(auth.walletAddress, RateLimitTier.UPLOAD);
    setRateLimitHeaders((set.headers ?? {}) as Record<string, string>, rl);
    if (!rl.allowed) { set.status = 429; return { error: 'Rate limit exceeded', retryAfter: rl.retryAfter }; }

    const uploadInput = await deliverableManagementService.validateAndReadUpload(request);
    if ('error' in uploadInput) {
      set.status = uploadInput.status;
      return { error: uploadInput.error };
    }

    const result = await deliverableManagementService.uploadDeliverable(
      auth,
      tenantContext.tenantId,
      uploadInput.buffer,
      uploadInput.detectedMime,
      uploadInput.relationshipId,
      uploadInput.milestoneIndex,
    );
    if ('error' in result) {
      set.status = result.status ?? 400;
      return result;
    }
    return result;
  })

  .post('/verify', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const rl = await checkRateLimit(auth.walletAddress, RateLimitTier.AI_PIPELINE);
    setRateLimitHeaders((set.headers ?? {}) as Record<string, string>, rl);
    if (!rl.allowed) { set.status = 429; return { error: 'Rate limit exceeded', retryAfter: rl.retryAfter }; }

    const result = await deliverableManagementService.queueVerification(auth, tenantContext.tenantId, body);
    if ('notFound' in result) { set.status = 404; return { error: 'Relationship not found' }; }
    if ('invalidState' in result) { set.status = 409; return { error: result.message }; }
    return {
      message: result.message,
      jobId: result.jobId,
      verificationStatus: result.verificationStatus,
    };
  }, {
    body: t.Object({
      blobId: t.String(),
      relationshipId: t.String(),
      milestoneIndex: t.Number(),
      expectedConditionValue: t.Optional(t.String()),
      retry: t.Optional(t.Boolean()),
    }),
  })

  .get('/', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const uploads = await prisma.deliverableUpload.findMany({
      where: { uploaderWallet: auth.walletAddress },
      orderBy: { createdAt: 'desc' },
    });
    return uploads;
  })

  .get('/:id', async ({ params, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const upload = await prisma.deliverableUpload.findFirst({
      where: { id: params.id, uploaderWallet: auth.walletAddress },
    });
    if (!upload) { set.status = 404; return { error: 'Deliverable not found' }; }
    return {
      id: upload.id,
      walrusBlobId: upload.walrusBlobId,
      walrusUrl: buildWalrusBlobUrl(upload.walrusBlobId),
      mimeType: upload.contentType,
      sizeBytes: Number(upload.sizeBytes),
      scanStatus: upload.scanStatus,
      verificationResult: null,
      verificationStatus: upload.verificationStatus,
      verificationConfidence: upload.verificationConfidence,
      verificationReason: upload.verificationReason,
      verificationEvidenceHash: upload.verificationEvidenceHash,
      createdAt: upload.createdAt,
    };
  })

  .post('/submit/ptb', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const rel = await prisma.paymentRelationship.findFirst({
      where: {
        OR: [{ id: body.relationshipId }, { suiObjectId: body.relationshipId }],
        recipientWallet: { equals: auth.walletAddress, mode: 'insensitive' },
      },
    });
    if (!rel) { set.status = 404; return { error: 'Relationship not found' }; }
    const result = await relationshipManagementService.submitDeliverable(
      auth,
      tenantContext.tenantId,
      rel.suiObjectId,
      body.milestoneIndex,
      body.blobId,
    );
    if ('notFound' in result) { set.status = 404; return { error: 'Relationship not found' }; }
    if ('forbidden' in result) { set.status = 403; return { error: result.message }; }
    if ('unavailable' in result) { set.status = 409; return { error: result.message }; }
    if ('simulationError' in result) {
      set.status = 422;
      return { error: result.simulationError.message, details: result.simulationError.details };
    }
    return {
      ptb: result.result.txBytes,
      description: `Submit deliverable for milestone ${body.milestoneIndex + 1}`,
      estimatedGas: 'estimatedGas' in result.result ? result.result.estimatedGas : undefined,
    };
  }, {
    body: t.Object({
      relationshipId: t.String(),
      milestoneIndex: t.Number(),
      blobId: t.String(),
    }),
  });
