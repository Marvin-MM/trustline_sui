import { createHash, randomBytes } from 'crypto';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { sanitize } from '@bondflow/types';
import { Prisma, type TenantRole } from '@prisma/client';
import { isAiTokenResourceType } from '../agents/models';
import { paymentAsset } from '../lib/payment-asset';
import { canonicalWalletAddress } from '../lib/wallet-signature';

export interface TenantActor {
  userId: string;
  walletAddress: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class TenantManagementService {
  async createTenant(actor: TenantActor, body: { name: string; slug: string }) {
    const slug = sanitize(body.slug);
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return { conflict: true as const };

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: { name: sanitize(body.name), slug, ownerWallet: actor.walletAddress, plan: env.DEFAULT_TENANT_PLAN },
      });
      await tx.tenantUser.create({
        data: { tenantId: created.id, userId: actor.userId, role: 'OWNER', acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          tenantId: created.id,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_CREATED',
          targetType: 'Tenant',
          targetId: created.id,
          after: { name: created.name, slug: created.slug, plan: created.plan },
        },
      });
      return created;
    });

    return { conflict: false as const, tenant };
  }

  async listUserTenants(userId: string, isPlatformAdmin = false) {
    if (isPlatformAdmin) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      return tenants.map((tenant) => ({
        ...tenant,
        role: 'OWNER' as const,
        platformAdmin: true,
      }));
    }

    const memberships = await prisma.tenantUser.findMany({
      where: { userId, acceptedAt: { not: null } },
      include: { tenant: true },
    });
    return memberships.map((membership) => ({
      ...membership.tenant,
      role: membership.role,
      platformAdmin: false,
    }));
  }

  async isSlugAvailable(slug: string) {
    const existing = await prisma.tenant.findUnique({ where: { slug: sanitize(slug) } });
    return !existing;
  }

  async listMembers(tenantId: string, page: number, limit: number) {
    const data = await prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, walletAddress: true, notificationEmail: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.tenantUser.count({ where: { tenantId } });
    return {
      data: data.map((member) => ({
        userId: member.userId,
        walletAddress: member.user.walletAddress,
        email: member.user.notificationEmail,
        role: member.role,
        status: member.acceptedAt ? 'ACCEPTED' : 'PENDING',
        joinedAt: (member.acceptedAt ?? member.createdAt).toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTenant(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { members: { include: { user: { select: { id: true, walletAddress: true, displayName: true } } } } },
    });
  }

  async updateTenant(actor: TenantActor, tenantId: string, body: { name?: string; isActive?: boolean }) {
    const before = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data['name'] = sanitize(body.name);
    if (body.isActive !== undefined) data['isActive'] = body.isActive;

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id: tenantId }, data });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_UPDATED',
          targetType: 'Tenant',
          targetId: tenantId,
          before: before ? { name: before.name, isActive: before.isActive } : Prisma.JsonNull,
          after: { name: tenant.name, isActive: tenant.isActive },
        },
      });
      return tenant;
    });
  }

  async inviteMember(actor: TenantActor, tenantId: string, body: { walletAddress: string; role: string; email?: string | undefined }) {
    if (body.role === 'OWNER') return { invalid: 'OWNER cannot be invited directly' as const };
    const role = body.role as Exclude<TenantRole, 'OWNER'>;
    const walletAddress = canonicalWalletAddress(body.walletAddress);

    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          nonce: crypto.randomUUID(),
          notificationEmail: body.email ?? null,
        },
      });
    }

    const existing = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (existing?.acceptedAt) return { conflict: true as const };

    const token = randomBytes(32).toString('base64url');
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const membership = await prisma.$transaction(async (tx) => {
      const created = existing
        ? await tx.tenantUser.update({
            where: { id: existing.id },
            data: { role, invitedBy: actor.walletAddress },
          })
        : await tx.tenantUser.create({
            data: { tenantId, userId: user.id, role, invitedBy: actor.walletAddress },
          });
      await tx.tenantInvitation.updateMany({
        where: {
          tenantId,
          invitedUserId: user.id,
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.tenantInvitation.create({
        data: {
          tenantId,
          invitedUserId: user.id,
          invitedEmail: body.email ?? null,
          invitedBy: actor.walletAddress,
          role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_MEMBER_INVITED',
          targetType: 'TenantUser',
          targetId: created.id,
          after: { userId: user.id, walletAddress: user.walletAddress, role },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateId: created.id,
          aggregateType: 'TenantInvitation',
          eventType: 'TEAM_MEMBER_INVITED',
          payload: {
            recipientEmail: body.email ?? user.notificationEmail ?? '',
            recipientWallet: user.walletAddress,
            notificationType: 'TEAM_MEMBER_INVITED',
            subject: `Invitation to join ${tenant.name}`,
            bodyHtml: `<p>You were invited to join <strong>${tenant.name}</strong> as <strong>${role}</strong>.</p>`,
            tenantId,
          },
        },
      });
      return created;
    });

    return {
      conflict: false as const,
      membership,
      inviteToken: token,
      invitationDelivery: {
        inApp: 'queued' as const,
        email: (body.email ?? user.notificationEmail) ? 'queued' as const : 'not_requested' as const,
      },
    };
  }

  async acceptInvitation(actor: TenantActor, tenantId: string, inviteToken?: string) {
    const invitation = inviteToken
      ? await prisma.tenantInvitation.findUnique({ where: { tokenHash: hashToken(inviteToken) } })
      : await prisma.tenantInvitation.findFirst({
          where: {
            tenantId,
            invitedUserId: actor.userId,
            declinedAt: null,
            revokedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });
    if (!invitation || invitation.tenantId !== tenantId || invitation.invitedUserId !== actor.userId || invitation.revokedAt || invitation.declinedAt) {
      return { invalid: true as const };
    }

    const membership = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.userId } },
    });
    if (!membership) return { notFound: true as const };
    if (invitation.acceptedAt || membership.acceptedAt) {
      return { accepted: membership, alreadyAccepted: true as const };
    }
    if (invitation.expiresAt < new Date()) return { invalid: true as const };

    const accepted = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenantUser.update({ where: { id: membership.id }, data: { acceptedAt: new Date() } });
      await tx.tenantInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_MEMBER_ACCEPTED',
          targetType: 'TenantUser',
          targetId: membership.id,
        },
      });
      const inviter = updated.invitedBy
        ? await tx.user.findUnique({ where: { walletAddress: updated.invitedBy } })
        : null;
      if (updated.invitedBy) {
        await tx.outboxEvent.create({
          data: {
            aggregateId: updated.id,
            aggregateType: 'TenantInvitation',
            eventType: 'TEAM_MEMBER_JOINED',
            payload: {
              recipientEmail: inviter?.notificationEmail ?? '',
              recipientWallet: updated.invitedBy,
              notificationType: 'TEAM_MEMBER_JOINED',
              subject: 'Workspace invitation accepted',
              bodyHtml: `<p>${actor.walletAddress} accepted the workspace invitation.</p>`,
              tenantId,
            },
          },
        });
      }
      return updated;
    });
    return { accepted };
  }

  async listPendingInvitations(actor: TenantActor) {
    const invitations = await prisma.tenantInvitation.findMany({
      where: {
        invitedUserId: actor.userId,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => ({
      id: invitation.id,
      tenantId: invitation.tenant.id,
      tenantName: invitation.tenant.name,
      tenantSlug: invitation.tenant.slug,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    }));
  }

  async declineInvitation(actor: TenantActor, invitationId: string) {
    const invitation = await prisma.tenantInvitation.findFirst({
      where: {
        id: invitationId,
        invitedUserId: actor.userId,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
      },
    });
    if (!invitation) return { notFound: true as const };
    await prisma.$transaction([
      prisma.tenantInvitation.update({
        where: { id: invitation.id },
        data: { declinedAt: new Date() },
      }),
      prisma.tenantUser.deleteMany({
        where: { tenantId: invitation.tenantId, userId: actor.userId, acceptedAt: null },
      }),
    ]);
    return { declined: true as const };
  }

  async removeMember(actor: TenantActor, tenantId: string, userId: string) {
    const existing = await prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (existing?.role === 'OWNER') return { invalid: true as const };
    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.deleteMany({ where: { tenantId, userId } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_MEMBER_REMOVED',
          targetType: 'User',
          targetId: userId,
          before: existing ? { role: existing.role } : Prisma.JsonNull,
        },
      });
    });
    return { removed: true as const };
  }

  async updateMemberRole(actor: TenantActor, tenantId: string, userId: string, role: string) {
    if (role === 'OWNER') return { invalid: 'Cannot assign OWNER via this endpoint' as const };
    const before = await prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (before?.role === 'OWNER') return { invalid: 'OWNER role cannot be changed via this endpoint' as const };

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tenantUser.updateMany({ where: { tenantId, userId }, data: { role: role as TenantRole } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_MEMBER_ROLE_CHANGED',
          targetType: 'TenantUser',
          targetId: before?.id ?? userId,
          before: before ? { role: before.role } : Prisma.JsonNull,
          after: { role },
        },
      });
      return result;
    });
    return { updated: updated.count };
  }

  async transferOwnership(actor: TenantActor, tenantId: string, targetUserId: string) {
    const target = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      include: { user: true },
    });
    if (!target || !target.acceptedAt) return { invalid: 'Target user must be an accepted tenant member' as const };
    if (target.role === 'VIEWER') return { invalid: 'Target owner must be MEMBER or ADMIN first' as const };

    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.updateMany({ where: { tenantId, role: 'OWNER' }, data: { role: 'ADMIN' } });
      await tx.tenantUser.update({ where: { id: target.id }, data: { role: 'OWNER' } });
      await tx.tenant.update({ where: { id: tenantId }, data: { ownerWallet: target.user.walletAddress } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: actor.userId,
          actorWallet: actor.walletAddress,
          action: 'TENANT_OWNERSHIP_TRANSFERRED',
          targetType: 'Tenant',
          targetId: tenantId,
          after: { ownerUserId: targetUserId, ownerWallet: target.user.walletAddress },
        },
      });
    });
    return { ownerUserId: targetUserId };
  }

  async getUsage(tenantId: string, range: '7d' | '30d' | '90d' = '30d') {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [usageRecords, relationships] = await Promise.all([
      prisma.usageRecord.findMany({
        where: { tenantId, recordedAt: { gte: since } },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.paymentRelationship.findMany({
        where: { tenantId },
        include: { milestones: true },
      }),
    ]);

    const byDay = new Map<string, { aiCost: number; tokens: bigint; gas: bigint; txCount: number; walrus: bigint }>();
    const ensureDay = (date: Date) => {
      const key = date.toISOString().slice(0, 10);
      const existing = byDay.get(key) ?? { aiCost: 0, tokens: 0n, gas: 0n, txCount: 0, walrus: 0n };
      byDay.set(key, existing);
      return existing;
    };

    let totalTokens = 0n;
    let totalCostUsd = 0;
    const costByModel = new Map<string, number>();

    for (const record of usageRecords) {
      const day = ensureDay(record.recordedAt);
      const quantity = BigInt(record.quantity);
      const cost = Number(record.estimatedCostUsd);
      totalCostUsd += cost;

      if (isAiTokenResourceType(record.resourceType)) {
        day.tokens += quantity;
        day.aiCost += cost;
        totalTokens += quantity;
        costByModel.set(record.model ?? 'unknown', (costByModel.get(record.model ?? 'unknown') ?? 0) + cost);
      } else if (record.resourceType === 'SUI_GAS') {
        day.gas += quantity;
        day.txCount += 1;
      } else if (record.resourceType === 'WALRUS_BYTES') {
        day.walrus += quantity;
      }
    }

    const relationshipsInRange = relationships.filter((relationship) => relationship.createdAt >= since);
    const fundedVolume = relationshipsInRange.reduce((sum, rel) => sum + BigInt(rel.totalLockedAmount), 0n);
    const releasedMilestonesInRange = relationships.flatMap((relationship) =>
      relationship.milestones.filter((milestone) => milestone.releasedAt && milestone.releasedAt >= since),
    );
    const releasedVolume = releasedMilestonesInRange.reduce((sum, milestone) => sum + BigInt(milestone.amount), 0n);
    const lockedVolume = relationships.flatMap((relationship) => relationship.milestones)
      .filter((milestone) => !['RELEASED', 'CANCELLED'].includes(milestone.status))
      .reduce((sum, milestone) => sum + BigInt(milestone.amount), 0n);
    const totalMilestones = relationshipsInRange.reduce((sum, rel) => sum + rel.milestones.length, 0);
    const releasedMilestones = relationshipsInRange.reduce((sum, rel) => sum + rel.milestones.filter((m) => m.status === 'RELEASED').length, 0);
    const disputedRelationships = relationshipsInRange.filter((rel) => rel.milestones.some((m) => m.disputeStatus !== 'NONE')).length;

    const fundedByDay = new Map<string, bigint>();
    for (const relationship of relationshipsInRange) {
      const date = relationship.createdAt.toISOString().slice(0, 10);
      fundedByDay.set(date, (fundedByDay.get(date) ?? 0n) + BigInt(relationship.totalLockedAmount));
    }
    const releasedByDay = new Map<string, bigint>();
    for (const milestone of releasedMilestonesInRange) {
      const date = milestone.releasedAt!.toISOString().slice(0, 10);
      releasedByDay.set(date, (releasedByDay.get(date) ?? 0n) + BigInt(milestone.amount));
    }
    const volumeDates = Array.from(new Set([...fundedByDay.keys(), ...releasedByDay.keys()])).sort();
    const dayRows = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
    const mostExpensiveAgentType = Array.from(costByModel.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      aiCostPerDay: dayRows.map(([date, row]) => ({ date, costUsd: row.aiCost, tokens: Number(row.tokens) })),
      gasPerDay: dayRows.map(([date, row]) => ({ date, gas: row.gas.toString(), txCount: row.txCount })),
      walrusStorage: {
        totalBytes: Number(dayRows.reduce((sum, [, row]) => sum + row.walrus, 0n)),
        growthPerDay: dayRows.map(([date, row]) => ({ date, bytes: Number(row.walrus) })),
      },
      relationships: {
        volumePerDay: volumeDates.map((date) => ({
          date,
          fundedBaseUnits: (fundedByDay.get(date) ?? 0n).toString(),
          releasedBaseUnits: (releasedByDay.get(date) ?? 0n).toString(),
        })),
        milestoneCompletionRate: totalMilestones > 0 ? (releasedMilestones / totalMilestones) * 100 : 0,
        releasedMilestones,
        totalMilestones,
        disputeRate: relationshipsInRange.length > 0 ? (disputedRelationships / relationshipsInRange.length) * 100 : 0,
        totalRelationships: relationshipsInRange.length,
        fundedBaseUnits: fundedVolume.toString(),
        releasedBaseUnits: releasedVolume.toString(),
        lockedBaseUnits: lockedVolume.toString(),
      },
      asset: paymentAsset,
      totalTokens: Number(totalTokens),
      totalCostUsd,
      costPerRelationship: relationshipsInRange.length > 0 ? totalCostUsd / relationshipsInRange.length : 0,
      mostExpensiveAgentType,
    };
  }
}

export const tenantManagementService = new TenantManagementService();
