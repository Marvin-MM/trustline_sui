import { describe, expect, test } from 'bun:test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { prisma } from '../src/db/client';
import { relationshipManagementService } from '../src/services/relationship-management';
import { tenantManagementService } from '../src/services/tenant-management';

const runDatabaseTests = process.env['RUN_DB_INTEGRATION_TESTS'] === '1';

describe.skipIf(!runDatabaseTests)('database migration integration', () => {
  test('all lifecycle v2 migrations are recorded and schema is queryable', async () => {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `;
    expect(migrations.map((migration) => migration.migration_name)).toContain(
      '20260612010000_relationship_lifecycle_v2',
    );
    expect(migrations.map((migration) => migration.migration_name)).toContain(
      '20260613010000_workspace_observability',
    );

    const relationships = await prisma.paymentRelationship.count();
    const capabilities = await prisma.relationshipCapability.count();
    const memoryEntries = await prisma.relationshipMemoryEntry.count();
    expect(relationships).toBeGreaterThanOrEqual(0);
    expect(capabilities).toBeGreaterThanOrEqual(0);
    expect(memoryEntries).toBeGreaterThanOrEqual(0);
  });

  test('a recipient discovers a relationship created before their BondFlow account existed', async () => {
    const recipient = new Ed25519Keypair().toSuiAddress();
    const storedRecipient = `0x${recipient.slice(2).toUpperCase()}`;
    const objectId = new Ed25519Keypair().toSuiAddress();
    let relationshipId: string | null = null;

    try {
      expect(await prisma.user.findUnique({ where: { walletAddress: recipient } })).toBeNull();
      const relationship = await prisma.paymentRelationship.create({
        data: {
          suiObjectId: objectId,
          payerWallet: new Ed25519Keypair().toSuiAddress(),
          recipientWallet: storedRecipient,
          memo: 'Recipient discovery integration test',
          milestoneCount: 1,
          totalLockedAmount: 1_000_000n,
          walrusMemorySpaceId: `test-${crypto.randomUUID()}`,
          milestones: {
            create: {
              milestoneIndex: 0,
              amount: 1_000_000n,
              conditionType: 'DELIVERABLE',
              conditionValue: 'Upload proof of completed work',
              releasePolicy: 'PAYER_APPROVAL',
            },
          },
        },
      });
      relationshipId = relationship.id;

      const user = await prisma.user.create({
        data: { walletAddress: recipient, nonce: crypto.randomUUID() },
      });
      const result = await relationshipManagementService.listAssignedRelationships({
        userId: user.id,
        walletAddress: recipient,
      }, 1, 20);

      expect(result.pagination.total).toBe(1);
      expect(result.data[0]?.suiObjectId).toBe(objectId);
      expect(result.data[0]?.actorRole).toBe('RECIPIENT');
      expect(result.data[0]?.availableActions).toContain('SUBMIT_DELIVERABLE');
    } finally {
      if (relationshipId) {
        await prisma.paymentRelationship.deleteMany({ where: { id: relationshipId } });
      }
      await prisma.user.deleteMany({ where: { walletAddress: recipient } });
    }
  });

  test('usage arithmetic reports two funded, one released, and one locked USDC exactly', async () => {
    const ownerWallet = new Ed25519Keypair().toSuiAddress();
    const recipientWallet = new Ed25519Keypair().toSuiAddress();
    const owner = await prisma.user.create({
      data: { walletAddress: ownerWallet, nonce: crypto.randomUUID() },
    });
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Usage arithmetic integration',
        slug: `usage-${crypto.randomUUID()}`,
        ownerWallet,
        members: {
          create: { userId: owner.id, role: 'OWNER', acceptedAt: new Date() },
        },
      },
    });

    try {
      await prisma.paymentRelationship.create({
        data: {
          suiObjectId: new Ed25519Keypair().toSuiAddress(),
          tenantId: tenant.id,
          payerWallet: ownerWallet,
          recipientWallet,
          memo: 'Released relationship',
          milestoneCount: 1,
          totalLockedAmount: 1_000_000n,
          walrusMemorySpaceId: `usage-${crypto.randomUUID()}`,
          status: 'COMPLETED',
          milestones: {
            create: {
              milestoneIndex: 0,
              amount: 1_000_000n,
              conditionType: 'MANUAL',
              conditionValue: 'Payer approval',
              releasePolicy: 'PAYER_APPROVAL',
              status: 'RELEASED',
              releasedAt: new Date(),
            },
          },
        },
      });
      await prisma.paymentRelationship.create({
        data: {
          suiObjectId: new Ed25519Keypair().toSuiAddress(),
          tenantId: tenant.id,
          payerWallet: ownerWallet,
          recipientWallet,
          memo: 'Locked relationship',
          milestoneCount: 1,
          totalLockedAmount: 1_000_000n,
          walrusMemorySpaceId: `usage-${crypto.randomUUID()}`,
          milestones: {
            create: {
              milestoneIndex: 0,
              amount: 1_000_000n,
              conditionType: 'MANUAL',
              conditionValue: 'Payer approval',
              releasePolicy: 'PAYER_APPROVAL',
            },
          },
        },
      });

      const usage = await tenantManagementService.getUsage(tenant.id, '30d');
      expect(usage.relationships.fundedBaseUnits).toBe('2000000');
      expect(usage.relationships.releasedBaseUnits).toBe('1000000');
      expect(usage.relationships.lockedBaseUnits).toBe('1000000');
      expect(usage.relationships.releasedMilestones).toBe(1);
      expect(usage.relationships.totalMilestones).toBe(2);
      expect(usage.relationships.milestoneCompletionRate).toBe(50);
    } finally {
      await prisma.paymentRelationship.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
  });

  test('wallet invitations work without email and acceptance is idempotent', async () => {
    const ownerWallet = new Ed25519Keypair().toSuiAddress();
    const inviteeWallet = new Ed25519Keypair().toSuiAddress();
    const [owner, invitee] = await Promise.all([
      prisma.user.create({ data: { walletAddress: ownerWallet, nonce: crypto.randomUUID() } }),
      prisma.user.create({ data: { walletAddress: inviteeWallet, nonce: crypto.randomUUID() } }),
    ]);
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Invitation integration',
        slug: `invite-${crypto.randomUUID()}`,
        ownerWallet,
        members: {
          create: { userId: owner.id, role: 'OWNER', acceptedAt: new Date() },
        },
      },
    });

    try {
      const invitation = await tenantManagementService.inviteMember(
        { userId: owner.id, walletAddress: ownerWallet },
        tenant.id,
        { walletAddress: inviteeWallet.toUpperCase(), role: 'MEMBER' },
      );
      expect(invitation.conflict).toBe(false);
      if (invitation.conflict || 'invalid' in invitation) throw new Error('Invitation unexpectedly failed');
      expect(invitation.invitationDelivery).toEqual({ inApp: 'queued', email: 'not_requested' });

      const pending = await tenantManagementService.listPendingInvitations({
        userId: invitee.id,
        walletAddress: inviteeWallet,
      });
      expect(pending).toHaveLength(1);

      const first = await tenantManagementService.acceptInvitation(
        { userId: invitee.id, walletAddress: inviteeWallet },
        tenant.id,
      );
      expect('accepted' in first).toBe(true);
      const second = await tenantManagementService.acceptInvitation(
        { userId: invitee.id, walletAddress: inviteeWallet },
        tenant.id,
      );
      expect('alreadyAccepted' in second && second.alreadyAccepted).toBe(true);
    } finally {
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: (await prisma.tenantUser.findMany({ where: { tenantId: tenant.id }, select: { id: true } })).map((row) => row.id) } },
      });
      await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantInvitation.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, invitee.id] } } });
    }
  });
});
