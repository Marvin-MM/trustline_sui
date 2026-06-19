/**
 * Transaction monitor for tracking all Sui PTB submissions.
 * Every PTB must be tracked via this service.
 */

import { prisma } from '../db/client';
import { suiClient } from '../lib/sui-client';
import { logger } from '../lib/logger';
import { tracer, SpanStatusCode, suiTransactionsCounter, suiGasCounter } from '../tracing';
import type { TransactionType, TransactionStatus } from '@prisma/client';

const txLogger = logger.child({ module: 'tx-monitor' });

export class TransactionMonitorService {
  async track(params: {
    digest: string;
    txType: TransactionType;
    submittedBy: string;
    relationshipId?: string;
    tenantId?: string;
  }): Promise<void> {
    await prisma.submittedTransaction.create({
      data: {
        digest: params.digest,
        txType: params.txType,
        submittedBy: params.submittedBy,
        status: 'PENDING',
        submittedAt: new Date(),
        relationshipId: params.relationshipId ?? null,
        tenantId: params.tenantId ?? null,
      },
    });
    suiTransactionsCounter.add(1, { tx_type: params.txType, status: 'PENDING' });
    txLogger.info({ digest: params.digest, txType: params.txType }, 'Transaction tracked');
  }

  async confirm(digest: string, gasUsed: bigint): Promise<void> {
    const existing = await prisma.submittedTransaction.findUnique({ where: { digest } });
    if (!existing) {
      txLogger.warn({ digest }, 'Transaction confirmation received for untracked digest');
      return;
    }
    await prisma.submittedTransaction.update({ where: { digest }, data: { status: 'CONFIRMED', confirmedAt: new Date(), gasUsed } });
    suiTransactionsCounter.add(1, { tx_type: existing.txType, status: 'CONFIRMED' });
    suiGasCounter.add(Number(gasUsed), { tx_type: existing.txType });
    txLogger.info({ digest, gasUsed: gasUsed.toString() }, 'Transaction confirmed');
  }

  async fail(digest: string, error: string): Promise<void> {
    const existing = await prisma.submittedTransaction.findUnique({ where: { digest } });
    if (!existing) {
      txLogger.warn({ digest, error }, 'Transaction failure received for untracked digest');
      return;
    }
    await prisma.submittedTransaction.update({ where: { digest }, data: { status: 'FAILED', error } });
    suiTransactionsCounter.add(1, { tx_type: existing.txType, status: 'FAILED' });
    txLogger.error({ digest, error }, 'Transaction failed');
  }

  async waitAndConfirm(params: {
    digest: string;
    txType: TransactionType;
    submittedBy: string;
    relationshipId?: string;
    tenantId?: string;
  }): Promise<void> {
    const span = tracer.startSpan('tx-monitor.waitAndConfirm', {
      attributes: { 'bondflow.tx.digest': params.digest, 'bondflow.tx.type': params.txType },
    });

    try {
      await this.track(params);
      const result = await suiClient.waitForTransaction({
        digest: params.digest,
        options: { showEffects: true },
      });

      const effects = result.effects;
      if (effects?.status?.status === 'success') {
        const gasUsed = BigInt(effects.gasUsed?.computationCost ?? '0') +
          BigInt(effects.gasUsed?.storageCost ?? '0') -
          BigInt(effects.gasUsed?.storageRebate ?? '0');
        await this.confirm(params.digest, gasUsed);
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        const errorMsg = effects?.status?.error ?? 'Unknown transaction failure';
        await this.fail(params.digest, errorMsg);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMsg });
      }
    } catch (error) {
      await this.fail(params.digest, (error as Error).message);
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}

export const transactionMonitor = new TransactionMonitorService();
