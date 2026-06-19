/**
 * Reputation routes.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { permissionGuard } from '../middleware/rbac.middleware';
import { Permission, WalletAddressSchema } from '@bondflow/types';
import { reputationManagementService } from '../services/reputation-management';
import { prisma } from '../db/client';
import { toJsonSafe } from '../lib/json';
import { ptbBuilder, PtbSimulationError } from '../services/ptb-builder';
import { walrusService } from '../services/walrus';

export const reputationRoutes = new Elysia({ prefix: '/api/v1/reputation' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/:walletAddress', async ({ params, set }) => {
    const parsed = WalletAddressSchema.safeParse(params.walletAddress);
    if (!parsed.success) { set.status = 400; return { error: 'Invalid wallet address' }; }
    const proof = await reputationManagementService.getProof(parsed.data);
    return proof;
  })

  .post('/generate', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    if (body.walletAddress !== auth.walletAddress) { set.status = 403; return { error: 'You may only generate your own reputation.' }; }
    const result = await reputationManagementService.generate(body.walletAddress, tenantContext.tenantId);
    if ('noAttestations' in result) { set.status = 400; return { error: 'No attestations found' }; }
    return result;
  }, { beforeHandle: permissionGuard(Permission.REPUTATION_GENERATE), body: t.Object({ walletAddress: t.String() }) })

  .post('/update', async ({ body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    if (body.walletAddress !== auth.walletAddress) { set.status = 403; return { error: 'You may only update your own reputation.' }; }
    const result = await reputationManagementService.update(body.walletAddress);
    if (!result) { set.status = 404; return { error: 'No existing proof to update' }; }
    return result;
  }, { beforeHandle: permissionGuard(Permission.REPUTATION_GENERATE), body: t.Object({ walletAddress: t.String() }) })

  .get('/:walletAddress/attestations', async ({ params, query, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const page = parseInt(query['page'] ?? '1');
    const limit = parseInt(query['limit'] ?? '20');
    const [data, total] = await Promise.all([
      prisma.completionAttestation.findMany({
        where: { recipientWallet: params.walletAddress },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.completionAttestation.count({ where: { recipientWallet: params.walletAddress } }),
    ]);
    return toJsonSafe({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })

  .post('/mint/ptb', async ({ body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const attestationCount = await prisma.completionAttestation.count({ where: { recipientWallet: auth.walletAddress } });
    if (attestationCount === 0) { set.status = 400; return { error: 'At least one released milestone is required.' }; }
    const walrusSpaceId = body.walrusAttestationSpaceId ?? (await walrusService.initMemorySpace()).spaceId;
    try {
      const result = await ptbBuilder.buildMintReputationProof({
        walrusAttestationSpaceId: walrusSpaceId,
        sender: auth.walletAddress,
      });
      return {
        ptb: result.txBytes,
        description: `Mint factual reputation proof from ${attestationCount} released milestone${attestationCount === 1 ? '' : 's'}`,
        estimatedGas: result.estimatedGas,
      };
    } catch (error) {
      if (error instanceof PtbSimulationError) { set.status = 422; return { error: error.message, details: error.details }; }
      throw error;
    }
  }, {
    beforeHandle: permissionGuard(Permission.REPUTATION_GENERATE),
    body: t.Object({
      walrusAttestationSpaceId: t.Optional(t.String()),
    }),
  })

  .post('/:walletAddress/update/ptb', async ({ params, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    if (params.walletAddress !== auth.walletAddress) { set.status = 403; return { error: 'You may only update your own reputation proof.' }; }
    const proof = await prisma.reputationProof.findUnique({ where: { ownerWallet: params.walletAddress } });
    if (!proof) { set.status = 404; return { error: 'No existing reputation proof found' }; }
    try {
      const result = await ptbBuilder.buildUpdateReputationProof({
        proofId: proof.suiObjectId,
        sender: auth.walletAddress,
      });
      return { ptb: result.txBytes, description: 'Update reputation proof', estimatedGas: result.estimatedGas };
    } catch (error) {
      if (error instanceof PtbSimulationError) { set.status = 422; return { error: error.message, details: error.details }; }
      throw error;
    }
  }, { beforeHandle: permissionGuard(Permission.REPUTATION_GENERATE) });
