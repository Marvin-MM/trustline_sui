import { tenantGuard } from '../lib/tenant-guard';
import { prisma } from '../db/client';
import { runMemoryInsight } from '../agents/memory-insight.agent';

export interface MemoryActor {
  walletAddress: string;
}

export class MemoryManagementService {
  async getMemory(actor: MemoryActor, tenantId: string | null, relationshipId: string, page = 1, limit = 50) {
    const guard = tenantGuard.forEither(tenantId, actor.walletAddress);
    const rel = await guard.relationships.findFirst({ where: { id: relationshipId } });
    if (!rel) return null;
    const where = { relationshipId: rel.id };
    const [entries, total] = await Promise.all([
      prisma.relationshipMemoryEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.relationshipMemoryEntry.count({ where }),
    ]);
    return {
      data: entries.map((entry) => ({
        id: entry.id,
        relationshipId: entry.relationshipId,
        walrusBlobId: entry.walrusBlobId,
        summary: entry.summary,
        keyInsights: [],
        riskFactors: [],
        relationshipHealth: 'healthy',
        recommendedActions: [],
        encryptedForWallet: '',
        milestoneIndex: entry.milestoneIndex,
        eventType: entry.eventType,
        isCritical: entry.eventType.includes('Dispute'),
        storageStatus: entry.storageStatus,
        storageError: entry.storageError,
        factualPayload: entry.factualPayload,
        createdAt: entry.occurredAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getInsights(actor: MemoryActor, tenantId: string | null, relationshipId: string, question: string) {
    const guard = tenantGuard.forEither(tenantId, actor.walletAddress);
    const rel = await guard.relationships.findFirst({ where: { id: relationshipId }, include: { milestones: true } });
    if (!rel) return null;
    const factualEntries = await prisma.relationshipMemoryEntry.findMany({
      where: { relationshipId: rel.id },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    });
    return runMemoryInsight({
      relationshipId,
      walrusMemorySpaceId: rel.walrusMemorySpaceId,
      question,
      relationshipData: JSON.stringify({
        status: rel.status,
        milestones: rel.milestoneCount,
        totalLocked: rel.totalLockedAmount.toString(),
      }),
      factualMemoryContext: factualEntries
        .map((entry) => `[${entry.occurredAt.toISOString()}] ${entry.summary}`)
        .join('\n'),
      walletAddress: actor.walletAddress,
      ...(tenantId ? { tenantId } : {}),
    });
  }
}

export const memoryManagementService = new MemoryManagementService();
