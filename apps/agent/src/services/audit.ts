import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { Prisma, type AuditAction } from '@prisma/client';

const auditLogger = logger.child({ module: 'audit' });

export interface AuditParams {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorWallet?: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  correlationId?: string | null;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorUserId: params.actorUserId ?? null,
        actorWallet: params.actorWallet ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before: params.before ?? Prisma.JsonNull,
        after: params.after ?? Prisma.JsonNull,
        metadata: params.metadata ?? Prisma.JsonNull,
        correlationId: params.correlationId ?? null,
      },
    });
  } catch (error) {
    auditLogger.error({ error: (error as Error).message, action: params.action }, 'Failed to write audit log');
    throw error;
  }
}
