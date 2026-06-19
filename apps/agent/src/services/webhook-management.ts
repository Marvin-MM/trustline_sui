import { prisma } from '../db/client';
import { WebhookTransactionResultSchema } from '@bondflow/types';

export class WebhookManagementService {
  async processTransactionResult(signature: string, timestampSeconds: number, rawBody: string) {
    const existing = await prisma.webhookDelivery.findUnique({ where: { signature } });
    if (existing) return { duplicate: true as const };

    let rawBodyJson: unknown;
    try {
      rawBodyJson = JSON.parse(rawBody);
    } catch {
      return { invalidJson: true as const };
    }

    const parsed = WebhookTransactionResultSchema.safeParse(rawBodyJson);
    if (!parsed.success) return { invalidBody: parsed.error.flatten() };
    const body = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.webhookDelivery.create({
        data: {
          signature,
          transactionDigest: body.transactionDigest,
          receivedAt: new Date(timestampSeconds * 1000),
          processedAt: new Date(),
        },
      });

      const tracked = await tx.submittedTransaction.findUnique({ where: { digest: body.transactionDigest } });
      if (tracked) {
        if (body.status === 'CONFIRMED') {
          await tx.submittedTransaction.update({
            where: { digest: body.transactionDigest },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
              gasUsed: body.gasUsed ? BigInt(body.gasUsed) : null,
            },
          });
        } else if (body.status === 'FAILED') {
          await tx.submittedTransaction.update({
            where: { digest: body.transactionDigest },
            data: { status: 'FAILED', error: body.error ?? 'Transaction failed' },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'WEBHOOK_PROCESSED',
          targetType: 'SubmittedTransaction',
          targetId: body.transactionDigest,
          metadata: { status: body.status, tracked: !!tracked },
        },
      });
    });

    return { transactionDigest: body.transactionDigest };
  }
}

export const webhookManagementService = new WebhookManagementService();
