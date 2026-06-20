/**
 * Authenticated client transaction status routes.
 *
 * Browser clients use this route for their own signed transaction lifecycle.
 * The HMAC webhook remains reserved for trusted server-to-server event delivery.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { prisma } from '../db/client';
import { TransactionStatus, TransactionType } from '@bondflow/types';
import { relationshipManagementService } from '../services/relationship-management';
import { suiClient } from '../lib/sui-client';
import { applyBlockchainEvent } from '../workers/event-handlers';

export const transactionRoutes = new Elysia({ prefix: '/api/v1/transactions' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .post('/client-status', async ({ body, auth, tenantContext, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }

    if (!body.txType || !Object.values(TransactionType).includes(body.txType as TransactionType)) {
      set.status = 422;
      return { error: `Unknown transaction type: ${body.txType ?? '<missing>'}` };
    }
    const txType = body.txType as TransactionType;
    const rawStatus = body.status as TransactionStatus;
    const isUnknownConfirmationFailure = rawStatus === TransactionStatus.FAILED
      && /confirmation could not be verified|could not be verified yet|confirmation pending/i.test(body.error ?? '');
    const normalizedStatus = isUnknownConfirmationFailure ? TransactionStatus.PENDING : rawStatus;

    const existing = await prisma.submittedTransaction.findUnique({
      where: { digest: body.transactionDigest },
    });

    if (!existing) {
      await prisma.submittedTransaction.create({
        data: {
          digest: body.transactionDigest,
          relationshipId: body.relationshipId ?? null,
          tenantId: tenantContext.tenantId,
          submittedBy: auth.walletAddress,
          txType,
          status: normalizedStatus,
          gasUsed: body.gasUsed ? BigInt(body.gasUsed) : null,
          submittedAt: new Date(),
          confirmedAt: normalizedStatus === TransactionStatus.CONFIRMED ? new Date() : null,
          error: body.error ?? null,
        },
      });
    } else {
      const nextStatus = existing.status === TransactionStatus.CONFIRMED && normalizedStatus !== TransactionStatus.CONFIRMED
        ? TransactionStatus.CONFIRMED
        : normalizedStatus;
      await prisma.submittedTransaction.update({
        where: { digest: body.transactionDigest },
        data: {
          status: nextStatus,
          relationshipId: body.relationshipId ?? existing.relationshipId,
          gasUsed: body.gasUsed ? BigInt(body.gasUsed) : existing.gasUsed,
          confirmedAt: normalizedStatus === TransactionStatus.CONFIRMED ? new Date() : existing.confirmedAt,
          error: body.error ?? existing.error,
        },
      });
    }

    let reconciliation: unknown = null;
    if (normalizedStatus === TransactionStatus.CONFIRMED) {
      const transaction = await suiClient.getTransactionBlock({
        digest: body.transactionDigest,
        options: { showEvents: true, showEffects: true, showObjectChanges: true },
      });
      const onChainStatus = transaction.effects?.status?.status ?? 'unknown';
      if (onChainStatus !== 'success') {
        const error = transaction.effects?.status?.error ?? 'Transaction failed on-chain';
        await prisma.submittedTransaction.update({
          where: { digest: body.transactionDigest },
          data: {
            status: TransactionStatus.FAILED,
            error,
          },
        });
        if (body.relationshipId && txType === TransactionType.CREATE_RELATIONSHIP) {
          await relationshipManagementService.markRelationshipFailed(body.relationshipId, error);
        }
        reconciliation = { onChainStatus, error };
        set.status = 409;
        return {
          error: 'Transaction failed on-chain',
          transactionDigest: body.transactionDigest,
          reconciliation,
        };
      }

      if (body.relationshipId && txType === TransactionType.CREATE_RELATIONSHIP) {
        reconciliation = await relationshipManagementService.reconcileCreateTransaction({
          relationshipId: body.relationshipId,
          digest: body.transactionDigest,
          actor: auth,
          tenantId: tenantContext.tenantId,
        });
      }

      for (const event of transaction.events ?? []) {
        await applyBlockchainEvent({
          suiEventId: `${body.transactionDigest}:${event.id.eventSeq}`,
          eventType: event.type,
          payload: (event.parsedJson ?? {}) as Record<string, unknown>,
          sender: event.sender,
          markProcessed: true,
        });
      }
      reconciliation = reconciliation ?? {
        appliedEvents: transaction.events?.length ?? 0,
        onChainStatus,
      };
    } else if (
      normalizedStatus === TransactionStatus.FAILED
      && body.relationshipId
      && txType === TransactionType.CREATE_RELATIONSHIP
    ) {
      await relationshipManagementService.markRelationshipFailed(body.relationshipId, body.error ?? 'Transaction failed');
    }

    await prisma.auditLog.create({
      data: {
        tenantId: tenantContext.tenantId,
        actorUserId: auth.userId,
        actorWallet: auth.walletAddress,
        action: 'WEBHOOK_PROCESSED',
        targetType: 'SubmittedTransaction',
        targetId: body.transactionDigest,
        metadata: {
          source: 'client-status',
          status: normalizedStatus,
          clientStatus: rawStatus,
          txType,
          relationshipId: body.relationshipId ?? null,
        },
      },
    });

    return { message: 'Transaction status recorded', transactionDigest: body.transactionDigest, reconciliation };
  }, {
    body: t.Object({
      transactionDigest: t.String(),
      status: t.Enum(TransactionStatus),
      txType: t.Optional(t.String()),
      relationshipId: t.Optional(t.String()),
      gasUsed: t.Optional(t.String()),
      error: t.Optional(t.String()),
    }),
  });
