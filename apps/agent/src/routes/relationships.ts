/**
 * Payment relationship routes.
 * Routes authenticate/authorize/validate and delegate business orchestration to services.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { permissionGuard } from '../middleware/rbac.middleware';
import { CreateRelationshipSchema, Permission, RelationshipMilestoneInputSchema } from '@bondflow/types';
import { DatabaseMigrationRequiredError, relationshipManagementService } from '../services/relationship-management';
import { ptbBuilder, PtbSimulationError } from '../services/ptb-builder';
import { walrusService } from '../services/walrus';
import { env } from '../config/env';
import { agentAddress, suiClient } from '../lib/sui-client';
import { detectAnomaly } from '../agents/core-functions';
import { parseHumanAmount, paymentAsset } from '../lib/payment-asset';
import { canonicalWalletAddress } from '../lib/wallet-signature';

function ptbResponse(result: {
  notFound?: true;
  forbidden?: true;
  unavailable?: true;
  message?: string;
  simulationError?: PtbSimulationError;
  result?: unknown;
}, set: { status?: number | string }) {
  if ('notFound' in result) {
    set.status = 404;
    return { error: 'Relationship not found' };
  }
  if ('simulationError' in result) {
    set.status = 422;
    return {
      error: result.simulationError.message,
      code: typeof result.simulationError.details['code'] === 'string'
        ? result.simulationError.details['code']
        : 'PTB_SIMULATION_FAILED',
      details: result.simulationError.details,
    };
  }
  if ('forbidden' in result) {
    set.status = 403;
    return { error: result.message };
  }
  if ('unavailable' in result) {
    set.status = 409;
    return { error: result.message, code: 'LEGACY_READ_ONLY' };
  }
  return result.result;
}

const MIN_CREATE_GAS_MIST = 1_000_000n;

function parsePagination(query: Record<string, string | undefined>) {
  const requestedPage = Number.parseInt(query['page'] ?? '1', 10);
  const requestedLimit = Number.parseInt(query['limit'] ?? '20', 10);
  return {
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    limit: Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20,
  };
}

function encodeConditionValue(conditionType: string, conditionValue: string): string {
  if (conditionType === 'TIME_GATED') {
    // Contract expects 8-byte big-endian u64 epoch timestamp in ms.
    // bytesFromString hex-decodes even-length hex strings.
    const buf = Buffer.allocUnsafe(8);
    const timestamp = /^\d+$/.test(conditionValue)
      ? BigInt(conditionValue)
      : BigInt(new Date(conditionValue).getTime());
    if (timestamp <= 0n) throw new Error('Time-gated milestones require a valid future timestamp');
    buf.writeBigUInt64BE(timestamp);
    return buf.toString('hex');
  }
  // Manual and deliverable values are human-readable requirements.
  return conditionValue;
}

function ptbError(error: PtbSimulationError) {
  return {
    error: error.message,
    code: typeof error.details['code'] === 'string' ? error.details['code'] : 'PTB_SIMULATION_FAILED',
    details: error.details,
  };
}

function migrationRequiredError(error: DatabaseMigrationRequiredError) {
  return {
    error: 'BondFlow database needs the latest relationship-status migration before relationship creation can continue.',
    code: error.code,
    details: {
      migration: error.migration,
      missingStatuses: error.missingStatuses,
      recovery: 'Run bun run --cwd apps/agent migrate:deploy, then restart the backend.',
    },
  };
}

export const relationshipRoutes = new Elysia({ prefix: '/api/v1/relationships' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .get('/asset', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const [gasBalance, paymentBalance] = await Promise.all([
      suiClient.getBalance({ owner: auth.walletAddress, coinType: '0x2::sui::SUI' }),
      suiClient.getBalance({ owner: auth.walletAddress, coinType: paymentAsset.type }),
    ]);
    return {
      asset: paymentAsset,
      wallet: auth.walletAddress,
      gasBalanceMist: gasBalance.totalBalance,
      paymentBalanceBaseUnits: paymentBalance.totalBalance,
      minimumCreateGasMist: MIN_CREATE_GAS_MIST.toString(),
    };
  })

  .post('/anomaly-check', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const validation = RelationshipMilestoneInputSchema.array().min(1).max(10).safeParse(body.milestones);
    if (!validation.success) {
      set.status = 422;
      return { error: 'Invalid milestone configuration', code: 'VALIDATION_FAILED', details: validation.error.flatten() };
    }
    const result = await detectAnomaly({
      transactionData: JSON.stringify({
        recipientWallet: body.recipientWallet,
        total: body.milestones.reduce((sum, milestone) => sum + parseHumanAmount(milestone.amount), 0n).toString(),
        asset: paymentAsset.symbol,
        milestones: body.milestones,
      }),
      historicalContext: 'Preflight only. No relationship, Walrus space, or transaction has been created.',
    }, {
      ...(tenantContext.tenantId ? { tenantId: tenantContext.tenantId } : {}),
      walletAddress: auth.walletAddress,
      correlationId: body.clientRequestId,
    });
    return { result, mutating: false };
  }, {
    beforeHandle: permissionGuard(Permission.RELATIONSHIP_CREATE),
    body: t.Object({
      recipientWallet: t.String(),
      clientRequestId: t.String(),
      milestones: t.Array(t.Object({
        amount: t.String(),
        conditionType: t.String(),
        conditionValue: t.String(),
        releasePolicy: t.Optional(t.String()),
      })),
    }),
  })

  .post('/', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    if (body.tenantId && body.tenantId !== tenantContext.tenantId) {
      set.status = 403;
      return { error: 'Tenant mismatch' };
    }
    return relationshipManagementService.createRelationship(auth, tenantContext.tenantId, body);
  }, {
    beforeHandle: permissionGuard(Permission.RELATIONSHIP_CREATE),
    body: t.Object({
      recipientWallet: t.String(),
      milestones: t.Array(t.Object({
        amount: t.String(),
        conditionType: t.String(),
        conditionValue: t.String(),
        releasePolicy: t.Optional(t.String()),
      })),
      memo: t.String(),
      tenantId: t.Optional(t.String()),
    }),
  })

  .get('/', async ({ auth, tenantContext, query, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const page = parseInt(query['page'] ?? '1');
    const limit = parseInt(query['limit'] ?? '20');
    return relationshipManagementService.listRelationships(auth, tenantContext.tenantId, page, limit);
  }, { beforeHandle: permissionGuard(Permission.RELATIONSHIP_READ) })

  .get('/assigned', async ({ auth, query, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const { page, limit } = parsePagination(query);
    return relationshipManagementService.listAssignedRelationships(auth, page, limit);
  })

  .post('/ptb', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const validation = CreateRelationshipSchema.omit({ tenantId: true }).safeParse(body);
    if (!validation.success) {
      set.status = 422;
      return { error: 'Invalid relationship configuration', code: 'VALIDATION_FAILED', details: validation.error.flatten() };
    }
    try {
      const totalAmount = body.milestones.reduce((sum, milestone) => sum + parseHumanAmount(milestone.amount), 0n);
      const suiBalance = await suiClient.getBalance({ owner: auth.walletAddress, coinType: '0x2::sui::SUI' });
      const totalSuiBalance = BigInt(suiBalance.totalBalance);

      if (totalSuiBalance === 0n) {
        set.status = 422;
        return {
          error: 'This wallet has no SUI for gas. Fund it with SUI before creating a relationship.',
          code: 'INSUFFICIENT_GAS',
          details: { requiredGasMist: MIN_CREATE_GAS_MIST.toString(), balanceMist: '0' },
        };
      }

      const paymentBalance = env.SUI_PAYMENT_COIN_TYPE === '0x2::sui::SUI'
        ? totalSuiBalance
        : BigInt((await suiClient.getBalance({
          owner: auth.walletAddress,
          coinType: env.SUI_PAYMENT_COIN_TYPE,
        })).totalBalance);
      const requiredPaymentBalance = env.SUI_PAYMENT_COIN_TYPE === '0x2::sui::SUI'
        ? totalAmount + MIN_CREATE_GAS_MIST
        : totalAmount;
      if (paymentBalance < requiredPaymentBalance) {
        set.status = 422;
        return {
          error: `This wallet does not have enough ${paymentAsset.symbol} to fund the relationship.`,
          code: 'INSUFFICIENT_PAYMENT_BALANCE',
          details: {
            asset: paymentAsset,
            requiredPaymentBaseUnits: totalAmount.toString(),
            requiredGasMist: MIN_CREATE_GAS_MIST.toString(),
            balanceBaseUnits: paymentBalance.toString(),
            faucetUrl: paymentAsset.faucetUrl,
          },
        };
      }

      const VALID_CONDITION_TYPES = new Set(['MANUAL', 'TIME_GATED', 'DELIVERABLE']);
      const VALID_RELEASE_POLICIES = new Set(['PAYER_APPROVAL', 'AUTO_AFTER_CHALLENGE']);
      for (const m of body.milestones) {
        if (!VALID_CONDITION_TYPES.has(m.conditionType)) {
          set.status = 422;
          return { error: `Unknown conditionType: "${m.conditionType}"`, code: 'INVALID_CONDITION_TYPE' };
        }
        const releasePolicy = m.releasePolicy ?? 'PAYER_APPROVAL';
        if (!VALID_RELEASE_POLICIES.has(releasePolicy)) {
          set.status = 422;
          return { error: `Unknown releasePolicy: "${releasePolicy}"`, code: 'INVALID_RELEASE_POLICY' };
        }
        if (m.conditionType === 'MANUAL' && releasePolicy !== 'PAYER_APPROVAL') {
          set.status = 422;
          return {
            error: 'Manual milestones require payer approval and cannot be configured for automatic release.',
            code: 'INVALID_RELEASE_POLICY',
          };
        }
      }

      await relationshipManagementService.ensurePendingRelationshipStatusesReady();
      const existing = body.clientRequestId
        ? await relationshipManagementService.findPendingByClientRequest(auth, body.clientRequestId)
        : null;
      const walrusMemorySpaceId = existing?.walrusMemorySpaceId ?? (await walrusService.initMemorySpace()).spaceId;
      const conditionTypeMap: Record<string, number> = {
        MANUAL: 0,
        TIME_GATED: 1,
        DELIVERABLE: 2,
      };
      const releasePolicyMap: Record<string, number> = {
        PAYER_APPROVAL: 0,
        AUTO_AFTER_CHALLENGE: 1,
      };
      const deliverableCount = body.milestones.filter((m) => m.conditionType === 'DELIVERABLE').length;
      const automatedCount = body.milestones.filter((m) => m.releasePolicy === 'AUTO_AFTER_CHALLENGE').length;
      const needsAgentCapability = deliverableCount > 0 || automatedCount > 0;
      const recipientWallet = canonicalWalletAddress(body.recipientWallet);
      const result = await ptbBuilder.buildCreateRelationship({
        recipient: recipientWallet,
        amounts: body.milestones.map((m) => parseHumanAmount(m.amount).toString()),
        conditionTypes: body.milestones.map((m) => conditionTypeMap[m.conditionType]!),
        conditionValues: body.milestones.map((m) => encodeConditionValue(m.conditionType, m.conditionValue)),
        releasePolicies: body.milestones.map((m) => releasePolicyMap[m.releasePolicy ?? 'PAYER_APPROVAL'] ?? 0),
        memo: body.memo,
        walrusMemorySpaceId,
        coinType: env.SUI_PAYMENT_COIN_TYPE,
        sender: auth.walletAddress,
        verifierAgent: needsAgentCapability ? agentAddress : '0x0',
        verifierExpiryDurationS: needsAgentCapability ? 31_536_000 : 0,
        verifierMaxActions: needsAgentCapability ? Math.max(10, (deliverableCount * 2) + automatedCount) : 0,
      });
      const relationship = await relationshipManagementService.createPendingRelationship(auth, tenantContext.tenantId, {
        recipientWallet,
        milestones: body.milestones,
        memo: body.memo,
        walrusMemorySpaceId,
        ...(body.clientRequestId ? { clientRequestId: body.clientRequestId } : {}),
      });
      return {
        ptb: result.txBytes,
        description: `Create relationship with ${body.milestones.length} milestone${body.milestones.length === 1 ? '' : 's'}`,
        estimatedGas: result.estimatedGas,
        relationshipId: relationship.id,
        walrusMemorySpaceId,
        asset: paymentAsset,
        effects: {
          fundsLockedBaseUnits: totalAmount.toString(),
          verifierCapabilityGranted: needsAgentCapability,
          autoReleaseChallengeHours: 24,
        },
      };
    } catch (error) {
      if (error instanceof PtbSimulationError) {
        set.status = 422;
        return ptbError(error);
      }
      if (error instanceof DatabaseMigrationRequiredError) {
        set.status = 503;
        return migrationRequiredError(error);
      }
      throw error;
    }
  }, {
    beforeHandle: permissionGuard(Permission.RELATIONSHIP_CREATE),
    body: t.Object({
      recipientWallet: t.String(),
      milestones: t.Array(t.Object({
        amount: t.String(),
        conditionType: t.String(),
        conditionValue: t.String(),
        releasePolicy: t.Optional(t.String()),
      })),
      memo: t.String(),
      clientRequestId: t.Optional(t.String()),
    }),
  })

  .post('/pending/:relationshipId/fail', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.markPendingCreateFailed(
      auth,
      tenantContext.tenantId,
      params.relationshipId,
      body.error,
    );
    if ('notFound' in result) {
      set.status = 404;
      return { error: 'Pending relationship not found' };
    }
    return { message: 'Pending relationship marked failed' };
  }, {
    beforeHandle: permissionGuard(Permission.RELATIONSHIP_CREATE),
    body: t.Object({ error: t.String() }),
  })

  .post('/pending/:relationshipId/retry', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const rel = await relationshipManagementService.findScoped(params.relationshipId, tenantContext.tenantId, auth.walletAddress);
    if (!rel || rel.status !== 'PENDING_ON_CHAIN') {
      set.status = 404;
      return { error: 'Pending relationship not found or not in pending state' };
    }
    if (canonicalWalletAddress(rel.payerWallet) !== canonicalWalletAddress(auth.walletAddress)) {
      set.status = 403;
      return { error: 'Only the original payer can retry relationship creation' };
    }

    try {
      const conditionTypeMap: Record<string, number> = { MANUAL: 0, TIME_GATED: 1, DELIVERABLE: 2 };
      const releasePolicyMap: Record<string, number> = { PAYER_APPROVAL: 0, AUTO_AFTER_CHALLENGE: 1 };
      
      const deliverableCount = rel.milestones.filter((m) => m.conditionType === 'DELIVERABLE').length;
      const automatedCount = rel.milestones.filter((m) => m.releasePolicy === 'AUTO_AFTER_CHALLENGE').length;
      const needsAgentCapability = deliverableCount > 0 || automatedCount > 0;
      
      const result = await ptbBuilder.buildCreateRelationship({
        recipient: rel.recipientWallet,
        amounts: rel.milestones.map((m) => m.amount.toString()),
        conditionTypes: rel.milestones.map((m) => conditionTypeMap[m.conditionType]!),
        conditionValues: rel.milestones.map((m) => encodeConditionValue(m.conditionType, m.conditionValue)),
        releasePolicies: rel.milestones.map((m) => releasePolicyMap[m.releasePolicy ?? 'PAYER_APPROVAL'] ?? 0),
        memo: rel.memo,
        walrusMemorySpaceId: rel.walrusMemorySpaceId!,
        coinType: rel.assetType,
        sender: auth.walletAddress,
        verifierAgent: needsAgentCapability ? agentAddress : '0x0',
        verifierExpiryDurationS: needsAgentCapability ? 31_536_000 : 0,
        verifierMaxActions: needsAgentCapability ? Math.max(10, (deliverableCount * 2) + automatedCount) : 0,
      });

      return {
        ptb: result.txBytes,
        description: `Create relationship with ${rel.milestones.length} milestone${rel.milestones.length === 1 ? '' : 's'}`,
        estimatedGas: result.estimatedGas,
        relationshipId: rel.id,
        walrusMemorySpaceId: rel.walrusMemorySpaceId!,
        asset: { type: rel.assetType, symbol: rel.assetSymbol, decimals: rel.assetDecimals },
        effects: {
          fundsLockedBaseUnits: rel.totalLockedAmount.toString(),
          verifierCapabilityGranted: needsAgentCapability,
          autoReleaseChallengeHours: 24,
        },
      };
    } catch (error) {
      if (error instanceof PtbSimulationError) {
        set.status = 422;
        return ptbError(error);
      }
      throw error;
    }
  })

  .get('/:suiObjectId', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const rel = await relationshipManagementService.getRelationship(auth, tenantContext.tenantId, params.suiObjectId);
    if (!rel) { set.status = 404; return { error: 'Relationship not found' }; }
    return rel;
  })

  .post('/:suiObjectId/grant-agent-cap', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.grantAgentCap(auth, tenantContext.tenantId, params.suiObjectId, body);
    return ptbResponse(result, set);
  }, {
    beforeHandle: permissionGuard(Permission.AGENT_CAP_GRANT),
    body: t.Object({
      agentAddress: t.Optional(t.String()),
      expiryDurationSeconds: t.Optional(t.Number()),
      allowedActions: t.Optional(t.Array(t.Number())),
      maxActions: t.Optional(t.Number()),
    }),
  })

  .post('/:suiObjectId/grant-operator-cap', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.grantOperatorCap(auth, tenantContext.tenantId, params.suiObjectId, body);
    return ptbResponse(result, set);
  }, {
    beforeHandle: permissionGuard(Permission.AGENT_CAP_GRANT),
    body: t.Object({
      operatorAddress: t.String(),
      expiryDurationSeconds: t.Number(),
      canRelease: t.Boolean(),
      canCancel: t.Boolean(),
      canDispute: t.Boolean(),
    }),
  })

  .post('/:suiObjectId/automation/revoke', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.revokeAgentCap(auth, tenantContext.tenantId, params.suiObjectId);
    return ptbResponse(result, set);
  }, { beforeHandle: permissionGuard(Permission.AGENT_CAP_REVOKE) })

  .post('/:suiObjectId/cancel', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.cancelRelationship(auth, tenantContext.tenantId, params.suiObjectId);
    return ptbResponse(result, set);
  })

  .post('/:suiObjectId/milestones/:index/release', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.releaseMilestone(auth, tenantContext.tenantId, params.suiObjectId, parseInt(params.index));
    return ptbResponse(result, set);
  })

  .post('/:suiObjectId/milestones/:index/submit-deliverable', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.submitDeliverable(
      auth,
      tenantContext.tenantId,
      params.suiObjectId,
      parseInt(params.index),
      body.blobId,
    );
    return ptbResponse(result, set);
  }, {
    body: t.Object({ blobId: t.String() }),
  })

  .post('/:suiObjectId/milestones/:index/raise-dispute', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.raiseDispute(auth, tenantContext.tenantId, params.suiObjectId, parseInt(params.index), body.reasonHash);
    return ptbResponse(result, set);
  }, { body: t.Object({ reasonHash: t.String() }) })

  .post('/:suiObjectId/milestones/:index/dispute-evidence', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.uploadDisputeEvidence(
      auth,
      tenantContext.tenantId,
      params.suiObjectId,
      parseInt(params.index),
      body.reason,
    );
    if ('notFound' in result) { set.status = 404; return { error: 'Relationship not found' }; }
    if ('forbidden' in result) { set.status = 403; return { error: result.message }; }
    if ('unavailable' in result) { set.status = 409; return { error: result.message }; }
    return result;
  }, {
    body: t.Object({ reason: t.String({ minLength: 3, maxLength: 10_000 }) }),
  })

  .post('/:suiObjectId/milestones/:index/resolve-dispute', async ({ params, body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.resolveDispute(
      auth,
      tenantContext.tenantId,
      params.suiObjectId,
      parseInt(params.index),
      body.resolution,
    );
    return ptbResponse(result, set);
  }, {
    beforeHandle: permissionGuard(Permission.MILESTONE_DISPUTE_RESOLVE),
    body: t.Object({ resolution: t.Number() }),
  })

  .post('/:suiObjectId/milestones/:index/cancel', async ({ params, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await relationshipManagementService.cancelMilestone(auth, tenantContext.tenantId, params.suiObjectId, parseInt(params.index));
    return ptbResponse(result, set);
  })

  .get('/:suiObjectId/agent-actions', async ({ params, query, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const { page, limit } = parsePagination(query);
    const actions = await relationshipManagementService.getRelationshipAgentActions(auth, tenantContext.tenantId, params.suiObjectId, page, limit);
    if (!actions) { set.status = 404; return { error: 'Not found' }; }
    return actions;
  }, { beforeHandle: permissionGuard(Permission.RELATIONSHIP_READ) })

  .get('/:suiObjectId/audit-log', async ({ params, query, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const { page, limit } = parsePagination(query);
    const audit = await relationshipManagementService.getRelationshipAudit(auth, tenantContext.tenantId, params.suiObjectId, page, limit);
    if (!audit) { set.status = 404; return { error: 'Not found' }; }
    return audit;
  }, { beforeHandle: permissionGuard(Permission.RELATIONSHIP_READ) })

  // Backward compatibility for clients deployed before the audit-log route was standardized.
  .get('/:suiObjectId/audit', async ({ params, query, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const { page, limit } = parsePagination(query);
    const audit = await relationshipManagementService.getRelationshipAudit(auth, tenantContext.tenantId, params.suiObjectId, page, limit);
    if (!audit) { set.status = 404; return { error: 'Not found' }; }
    return audit;
  }, { beforeHandle: permissionGuard(Permission.RELATIONSHIP_READ) });
