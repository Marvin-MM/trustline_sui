import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  DeliveryVerificationOutputSchema,
  ConditionType,
  CreateRelationshipSchema,
  Permission,
  PERSONAL_MODE_PERMISSIONS,
  PRECISION_POLICY,
  ROLE_PERMISSIONS,
  ReleasePolicy,
  TenantRole,
} from '@bondflow/types';
import { setRateLimitHeaders, type RateLimitHeaderResult } from '../src/lib/rate-limit-headers';
import { formatHumanAmount, parseHumanAmount } from '../src/lib/payment-asset';
import { bytes32FromExternalId } from '../src/lib/onchain-bytes';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import {
  canonicalAuthMessage,
  canonicalWalletAddress,
  verifyWalletPersonalMessage,
} from '../src/lib/wallet-signature';
import { auditFetchDepth, paginateAuditEntries } from '../src/lib/audit-pagination';

const repoRoot = join(import.meta.dir, '..');

describe('remediation invariants', () => {
  test('role permissions preserve tenant-scoped RBAC hierarchy', () => {
    expect(ROLE_PERMISSIONS[TenantRole.VIEWER].has(Permission.RELATIONSHIP_READ)).toBe(true);
    expect(ROLE_PERMISSIONS[TenantRole.VIEWER].has(Permission.RELATIONSHIP_CREATE)).toBe(false);
    expect(ROLE_PERMISSIONS[TenantRole.MEMBER].has(Permission.RELATIONSHIP_CREATE)).toBe(true);
    expect(ROLE_PERMISSIONS[TenantRole.ADMIN].has(Permission.MILESTONE_DISPUTE_RESOLVE)).toBe(true);
    expect(ROLE_PERMISSIONS[TenantRole.OWNER].has(Permission.TENANT_MANAGE)).toBe(true);
    expect(PERSONAL_MODE_PERMISSIONS.has(Permission.FEATURE_FLAG_MANAGE)).toBe(false);
  });

  test('precision policy forbids fractional AI confidence and floating money semantics', () => {
    expect(PRECISION_POLICY.MONEY_WIRE_TYPE).toBe('string');
    expect(PRECISION_POLICY.GAS_WIRE_TYPE).toBe('string');
    expect(PRECISION_POLICY.PERCENTAGE_UNIT).toBe('basis_points');
    expect(PRECISION_POLICY.AI_CONFIDENCE_MIN).toBe(0);
    expect(PRECISION_POLICY.AI_CONFIDENCE_MAX).toBe(100);
    expect(PRECISION_POLICY.COST_DECIMAL_SCALE).toBe(6);
  });

  test('deliverable verification output is structured and confidence-bounded', () => {
    expect(DeliveryVerificationOutputSchema.safeParse({
      verified: true,
      reason: 'Matches milestone condition',
      confidence: 92,
      blobIdMatch: true,
    }).success).toBe(true);

    expect(DeliveryVerificationOutputSchema.safeParse({
      verified: true,
      reason: 'Fractional confidence should not pass',
      confidence: 92.5,
      blobIdMatch: true,
    }).success).toBe(false);
  });

  test('rate limit headers include retry metadata when limited', () => {
    const headers: Record<string, string> = {};
    const result: RateLimitHeaderResult = {
      limit: 5,
      remaining: 0,
      resetAt: 123456,
      retryAfter: 17,
    };

    setRateLimitHeaders(headers, result);

    expect(headers['X-RateLimit-Limit']).toBe('5');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
    expect(headers['X-RateLimit-Reset']).toBe('123456');
    expect(headers['Retry-After']).toBe('17');
  });

  test('auth refresh preserves platform admin identity', async () => {
    const source = await Bun.file(join(repoRoot, 'src/routes/auth.ts')).text();
    expect(source).toContain('isPlatformAdmin: result.isPlatformAdmin');
    expect(source).not.toContain('isPlatformAdmin: false');
  });

  test('effective platform admin authority is derived from ADMIN_WALLET_ADDRESS', async () => {
    const helperSource = await Bun.file(join(repoRoot, 'src/lib/platform-admin.ts')).text();
    const authSource = await Bun.file(join(repoRoot, 'src/services/auth-management.ts')).text();
    const middlewareSource = await Bun.file(join(repoRoot, 'src/middleware/auth.middleware.ts')).text();
    const jwtSource = await Bun.file(join(repoRoot, 'src/lib/jwt.ts')).text();

    expect(helperSource).toContain('env.ADMIN_WALLET_ADDRESS');
    expect(helperSource).toContain('isConfiguredPlatformAdmin');
    expect(authSource).toContain('isConfiguredPlatformAdmin(user.walletAddress)');
    expect(middlewareSource).toContain('isConfiguredPlatformAdmin(user.walletAddress)');
    expect(jwtSource).toContain('isConfiguredPlatformAdmin(existing.user.walletAddress)');
  });

  test('wallet authentication verifies supported key schemes against the exact canonical challenge', async () => {
    const message = canonicalAuthMessage('test-nonce');
    const keypairs = [
      new Ed25519Keypair(),
      new Secp256k1Keypair(),
      new Secp256r1Keypair(),
    ];

    for (const keypair of keypairs) {
      const { signature } = await keypair.signPersonalMessage(new TextEncoder().encode(message));
      const publicKey = await verifyWalletPersonalMessage({
        walletAddress: keypair.toSuiAddress().toUpperCase(),
        signature,
        message,
      });
      expect(publicKey.toSuiAddress()).toBe(keypair.toSuiAddress());

      await expect(verifyWalletPersonalMessage({
        walletAddress: keypair.toSuiAddress(),
        signature,
        message: `${message} altered`,
      })).rejects.toThrow();
    }
  });

  test('wallet authentication rejects a valid signature claimed by another address', async () => {
    const signer = new Ed25519Keypair();
    const otherWallet = new Ed25519Keypair().toSuiAddress();
    const message = canonicalAuthMessage('address-binding-test');
    const { signature } = await signer.signPersonalMessage(new TextEncoder().encode(message));

    await expect(verifyWalletPersonalMessage({
      walletAddress: otherWallet,
      signature,
      message,
    })).rejects.toThrow();
    expect(canonicalWalletAddress(otherWallet.toUpperCase())).toBe(otherWallet);
  });

  test('wallet authentication supplies the Sui client required for zkLogin verification', async () => {
    const source = await Bun.file(join(repoRoot, 'src/services/auth-management.ts')).text();
    expect(source).toContain('client: suiClient');
    expect(source).toContain('body.message !== canonicalAuthMessage(user.nonce)');
    expect(source).not.toContain('body.message.includes(user.nonce)');
  });

  test('seed config marks ADMIN_WALLET_ADDRESS as platform admin', async () => {
    const source = await Bun.file(join(repoRoot, 'prisma/seed.ts')).text();
    expect(source).toContain('env.ADMIN_WALLET_ADDRESS');
    expect(source).toContain('isPlatformAdmin: true');
  });

  test('platform admins can resolve active tenant context without tenant membership', async () => {
    const source = await Bun.file(join(repoRoot, 'src/middleware/tenant.middleware.ts')).text();
    expect(source).toContain('auth.isPlatformAdmin');
    expect(source).toContain("tenantRole: 'OWNER'");
    expect(source).toContain('Tenant is inactive');
  });

  test('agent runner uses Gemini provider instead of Anthropic provider', async () => {
    const runnerSource = await Bun.file(join(repoRoot, 'src/agents/agent-runner.ts')).text();
    const envSource = await Bun.file(join(repoRoot, 'src/config/env.ts')).text();

    expect(runnerSource).toContain("from '@ai-sdk/google'");
    expect(runnerSource).toContain('google(config.model)');
    expect(runnerSource).not.toContain('@ai-sdk/anthropic');
    expect(runnerSource).not.toContain('anthropic(config.model)');
    expect(envSource).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
    expect(envSource).not.toContain('ANTHROPIC_API_KEY');
  });

  test('relationship creation uses pending on-chain session and balance preflight', async () => {
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/relationships.ts')).text();
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/relationship-management.ts')).text();
    const schemaSource = await Bun.file(join(repoRoot, 'prisma/schema.prisma')).text();
    const transactionSource = await Bun.file(join(repoRoot, 'src/routes/transactions.ts')).text();
    const sharedTypesSource = await Bun.file(join(repoRoot, '../../packages/types/src/index.ts')).text();

    expect(schemaSource).toContain('PENDING_ON_CHAIN');
    expect(schemaSource).toContain('FAILED_ON_CHAIN');
    expect(routeSource).toContain('getBalance');
    expect(routeSource).toContain('INSUFFICIENT_GAS');
    expect(routeSource).toContain('createPendingRelationship');
    expect(routeSource).toContain('ensurePendingRelationshipStatusesReady');
    expect(serviceSource).toContain('DATABASE_MIGRATION_REQUIRED');
    expect(routeSource.indexOf('ensurePendingRelationshipStatusesReady')).toBeLessThan(routeSource.indexOf('walrusService.initMemorySpace()'));
    expect(routeSource).toContain('walrusService.initMemorySpace()');
    expect(routeSource).not.toContain('walrusMemorySpaceId: t.Optional');
    expect(sharedTypesSource).not.toContain('walrusMemorySpaceId: z.string().optional()');
    expect(routeSource).toContain('relationshipId: relationship.id');
    expect(routeSource).not.toContain("estimatedGas: '0'");
    expect(transactionSource).toContain('reconcileCreateTransaction');
    expect(transactionSource).toContain('relationshipId: body.relationshipId');
  });

  test('USDC conversion occurs exactly once at six decimals', () => {
    expect(parseHumanAmount('500.00')).toBe(500_000_000n);
    expect(parseHumanAmount('0.000001')).toBe(1n);
    expect(formatHumanAmount(500_000_000n)).toBe('500');
    expect(() => parseHumanAmount('1.0000001')).toThrow();
  });

  test('relationship schema rejects impossible funding and release policies', () => {
    const base = {
      recipientWallet: `0x${'1'.repeat(64)}`,
      memo: 'Logo work',
    };
    expect(CreateRelationshipSchema.safeParse({
      ...base,
      milestones: [{
        amount: '0',
        conditionType: ConditionType.MANUAL,
        conditionValue: 'Approved by payer',
        releasePolicy: ReleasePolicy.PAYER_APPROVAL,
      }],
    }).success).toBe(false);
    expect(CreateRelationshipSchema.safeParse({
      ...base,
      milestones: [{
        amount: '1.00',
        conditionType: ConditionType.MANUAL,
        conditionValue: 'Approved by payer',
        releasePolicy: ReleasePolicy.AUTO_AFTER_CHALLENGE,
      }],
    }).success).toBe(false);
    expect(CreateRelationshipSchema.safeParse({
      ...base,
      milestones: [{
        amount: '1.00',
        conditionType: ConditionType.TIME_GATED,
        conditionValue: new Date(Date.now() + 60_000).toISOString(),
        releasePolicy: ReleasePolicy.AUTO_AFTER_CHALLENGE,
      }],
    }).success).toBe(true);
  });

  test('on-chain references decode hex hashes and Walrus base64url IDs to exactly 32 bytes', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const hex = Buffer.from(bytes).toString('hex');
    const walrusId = Buffer.from(bytes).toString('base64url');
    expect(bytes32FromExternalId(hex)).toEqual(Array.from(bytes));
    expect(bytes32FromExternalId(walrusId)).toEqual(Array.from(bytes));
    expect(() => bytes32FromExternalId('not-a-valid-blob-id')).toThrow();
  });

  test('v2 relationship routes expose participant and evidence workflows without cap ids', async () => {
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/relationships.ts')).text();
    const deliverableSource = await Bun.file(join(repoRoot, 'src/services/deliverable-management.ts')).text();
    const eventSource = await Bun.file(join(repoRoot, 'src/workers/event-handlers.ts')).text();
    const watcherSource = await Bun.file(join(repoRoot, 'src/workers/event-watcher.ts')).text();
    const configSource = await Bun.file(join(repoRoot, 'src/lib/contract-config.ts')).text();

    expect(routeSource).toContain("get('/assigned'");
    expect(routeSource).toContain("get('/asset'");
    expect(routeSource).toContain('CreateRelationshipSchema');
    expect(routeSource).toContain('dispute-evidence');
    expect(deliverableSource).toContain("recipientWallet: { equals: actor.walletAddress, mode: 'insensitive' }");
    expect(deliverableSource).not.toContain('agentCapId: body.agentCapId');
    expect(deliverableSource).toContain('tenantId: relationship.tenantId');
    expect(routeSource).toContain('canonicalWalletAddress(body.recipientWallet)');
    expect(eventSource).toContain('MilestoneCreatedEvent');
    expect(eventSource).toContain('DeliverableVerifiedEvent');
    expect(eventSource).toContain('OperatorCapGrantedEvent');
    expect(watcherSource).toContain('package:${env.SUI_PACKAGE_ID}');
    expect(configSource).toContain('SUI_ADMIN_CAP_ID');
    expect(configSource).toContain('type mismatch');
  });

  test('recipient discovery is wallet-scoped and independent of workspace membership', async () => {
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/relationship-management.ts')).text();
    expect(serviceSource).toContain("recipientWallet: { equals: actor.walletAddress, mode: 'insensitive' }");
    expect(serviceSource).toContain('RelationshipActorRole.RECIPIENT');
    expect(serviceSource).toContain('RelationshipAction.SUBMIT_DELIVERABLE');
    expect(serviceSource).toContain('tenantId: rel.tenantId');
  });

  test('relationship audit API uses the canonical route and paginates the merged timeline correctly', async () => {
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/relationships.ts')).text();
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/relationship-management.ts')).text();

    expect(routeSource).toContain("get('/:suiObjectId/audit-log'");
    expect(routeSource).toContain("get('/:suiObjectId/audit'");
    expect(serviceSource).toContain('take: fetchDepth');
    expect(serviceSource).toContain('auditLogCount + agentActionCount + notificationCount + transactionCount');

    expect(auditFetchDepth(3, 2)).toBe(6);
    const entries = [
      { id: 'oldest', timestamp: '2026-06-12T10:00:00.000Z' },
      { id: 'newest', timestamp: '2026-06-12T13:00:00.000Z' },
      { id: 'middle-1', timestamp: '2026-06-12T12:00:00.000Z' },
      { id: 'middle-2', timestamp: '2026-06-12T11:00:00.000Z' },
    ];
    expect(paginateAuditEntries(entries, 2, 2).map((entry) => entry.id)).toEqual([
      'middle-2',
      'oldest',
    ]);
  });

  test('every generic payment relationship PTB supplies the stored coin type', async () => {
    const ptbSource = await Bun.file(join(repoRoot, 'src/services/ptb-builder.ts')).text();
    const relationshipSource = await Bun.file(join(repoRoot, 'src/services/relationship-management.ts')).text();
    const genericCalls = [
      'approve_and_release',
      'operator_approve_and_release',
      'grant_agent_cap',
      'revoke_cap',
      'submit_deliverable',
      'auto_release',
      'raise_dispute',
      'operator_raise_dispute',
      'resolve_dispute',
      'cancel_remaining',
      'cancel_milestone',
      'operator_cancel_milestone',
      'grant_operator_cap',
    ];

    for (const functionName of genericCalls) {
      const targetIndex = ptbSource.indexOf(`payment_relationship::${functionName}`);
      expect(targetIndex).toBeGreaterThan(-1);
      expect(ptbSource.slice(targetIndex, targetIndex + 240)).toContain('typeArguments: [params.coinType]');
    }
    const verificationTarget = ptbSource.indexOf("params.verified ? 'verify_deliverable' : 'reject_deliverable'");
    expect(verificationTarget).toBeGreaterThan(-1);
    expect(ptbSource.slice(verificationTarget, verificationTarget + 320)).toContain('typeArguments: [params.coinType]');
    expect(relationshipSource).toContain('coinType: rel.assetType');
    expect(ptbSource).toContain("code: 'PTB_RESOLUTION_FAILED'");
  });

  test('factual relationship memory is persisted independently from semantic AI search', async () => {
    const schemaSource = await Bun.file(join(repoRoot, 'prisma/schema.prisma')).text();
    const memorySource = await Bun.file(join(repoRoot, 'src/services/relationship-memory.ts')).text();
    const managementSource = await Bun.file(join(repoRoot, 'src/services/memory-management.ts')).text();
    const eventSource = await Bun.file(join(repoRoot, 'src/workers/event-handlers.ts')).text();
    const watcherSource = await Bun.file(join(repoRoot, 'src/workers/event-watcher.ts')).text();

    expect(schemaSource).toContain('model RelationshipMemoryEntry');
    expect(schemaSource).toMatch(/sourceEventId\s+String\s+@unique/);
    expect(memorySource).toContain('indexRelationshipMemoryEvent');
    expect(memorySource).toContain('backfillRelationshipMemory');
    expect(schemaSource).toMatch(/storageStatus\s+String\s+@default\("PENDING"\)/);
    expect(memorySource).toContain("storageStatus: 'UPLOADING'");
    expect(memorySource).toContain('staleClaimBefore');
    expect(memorySource).toContain("storageStatus: 'FAILED'");
    expect(memorySource).toContain('walrusService.writeMemoryEntry');
    expect(managementSource).toContain('prisma.relationshipMemoryEntry.findMany');
    expect(eventSource).toContain('indexRelationshipMemoryEvent');
    expect(watcherSource).toContain('backfillRelationshipMemory');
  });

  test('anomaly actions retain client correlation until relationship creation', async () => {
    const schemaSource = await Bun.file(join(repoRoot, 'prisma/schema.prisma')).text();
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/relationships.ts')).text();
    const runnerSource = await Bun.file(join(repoRoot, 'src/agents/agent-runner.ts')).text();
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/relationship-management.ts')).text();

    expect(schemaSource).toContain('correlationId');
    expect(routeSource).toContain('clientRequestId');
    expect(runnerSource).toContain('correlationId: config.correlationId');
    expect(serviceSource).toContain('correlationId: body.clientRequestId');
    expect(serviceSource).toContain('relationshipId: null');
  });

  test('notifications use independent in-app read and email delivery state', async () => {
    const schemaSource = await Bun.file(join(repoRoot, 'prisma/schema.prisma')).text();
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/notifications.ts')).text();
    const outboxSource = await Bun.file(join(repoRoot, 'src/workers/outbox.worker.ts')).text();
    const emailSource = await Bun.file(join(repoRoot, 'src/services/email.ts')).text();

    expect(schemaSource).toContain('readAt');
    expect(schemaSource).toContain('sourceOutboxEventId');
    expect(routeSource).toContain("patch('/:notificationId/read'");
    expect(routeSource).toContain("post('/read-all'");
    expect(routeSource).toContain('readAt: new Date()');
    expect(outboxSource).toContain('sourceOutboxEventId: event.id');
    expect(outboxSource).toContain('prisma.notification.upsert');
    expect(outboxSource).toContain('In-app notification published without email delivery');
    expect(emailSource).toContain('notificationId');
  });

  test('usage analytics exposes exact base-unit funded released and locked values', async () => {
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/tenant-management.ts')).text();
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/tenants.ts')).text();

    expect(serviceSource).toContain("range: '7d' | '30d' | '90d'");
    expect(serviceSource).toContain('fundedBaseUnits');
    expect(serviceSource).toContain('releasedBaseUnits');
    expect(serviceSource).toContain('lockedBaseUnits');
    expect(serviceSource).toContain('fundedBaseUnits: fundedVolume.toString()');
    expect(serviceSource).toContain('releasedBaseUnits: releasedVolume.toString()');
    expect(routeSource).toContain('tenantManagementService.getUsage(');
    expect(routeSource).toContain("range === '7d' || range === '90d' ? range : '30d'");
  });

  test('workspace invitations are wallet-bound and support pending accept and decline states', async () => {
    const schemaSource = await Bun.file(join(repoRoot, 'prisma/schema.prisma')).text();
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/tenants.ts')).text();
    const serviceSource = await Bun.file(join(repoRoot, 'src/services/tenant-management.ts')).text();

    expect(schemaSource).toContain('declinedAt');
    expect(routeSource).toContain("get('/invitations/pending'");
    expect(routeSource).toContain("post('/invitations/:invitationId/decline'");
    expect(serviceSource).toContain('listPendingInvitations');
    expect(serviceSource).toContain('declineInvitation');
    expect(serviceSource).toContain('invitedUserId: actor.userId');
    expect(serviceSource).toContain('recipientWallet: user.walletAddress');
    expect(serviceSource).toContain('TEAM_MEMBER_INVITED');
  });

  test('startup bootstrap provides active AI prompts and core feature defaults', async () => {
    const seedSource = await Bun.file(join(repoRoot, 'prisma/seed.ts')).text();
    const bootstrapSource = await Bun.file(join(repoRoot, 'src/services/default-bootstrap.ts')).text();
    const flagSource = await Bun.file(join(repoRoot, 'src/services/feature-flags.ts')).text();

    expect(seedSource).toContain('export const PROMPT_SEEDS');
    expect(seedSource).toContain('delivery-verification-tool-calling');
    expect(seedSource).toContain('REQUIRE_DELIVERABLE_VERIFICATION');
    expect(seedSource).toContain('enabled: true');
    expect(seedSource).toContain('if (import.meta.main)');
    expect(bootstrapSource).toContain('bootstrapOperationalDefaults');
    expect(bootstrapSource).toContain('PROMPT_SEEDS');
    expect(bootstrapSource).toContain('FEATURE_FLAG_SEEDS');
    expect(bootstrapSource).toContain('isActive: true');
    expect(bootstrapSource).toContain('bondflow:ff:${flag.key}:*');
    expect(flagSource).toContain('DEFAULT_FLAG_VALUES.get(key)');
  });

  test('AI unavailable states are explicit and never masquerade as low-risk success', async () => {
    const coreSource = await Bun.file(join(repoRoot, 'src/agents/core-functions.ts')).text();
    const sharedTypesSource = await Bun.file(join(repoRoot, '../../packages/types/src/index.ts')).text();

    expect(sharedTypesSource).toContain('AnomalyPreflightResultSchema');
    expect(sharedTypesSource).toContain("status: z.literal('COMPLETED')");
    expect(sharedTypesSource).toContain("status: z.literal('DISABLED')");
    expect(sharedTypesSource).toContain("status: z.literal('UNAVAILABLE')");
    expect(coreSource).toContain("status: 'COMPLETED'");
    expect(coreSource).toContain("status: 'DISABLED'");
    expect(coreSource).toContain("status: 'UNAVAILABLE'");
    expect(coreSource).toContain('Anomaly detection unavailable');
  });

  test('deliverable verification is idempotent and cannot remain stuck scanning after final failure', async () => {
    const deliverableSource = await Bun.file(join(repoRoot, 'src/services/deliverable-management.ts')).text();
    const workerSource = await Bun.file(join(repoRoot, 'src/workers/ai-pipeline.worker.ts')).text();
    const agentSource = await Bun.file(join(repoRoot, 'src/agents/deliverable-verification.agent.ts')).text();
    const routesSource = await Bun.file(join(repoRoot, 'src/routes/deliverables.ts')).text();

    expect(deliverableSource).toContain("['SCANNING', 'VERIFIED', 'REJECTED']");
    expect(deliverableSource).toContain('body.retry');
    expect(deliverableSource).toContain('AI verification disabled for this workspace.');
    expect(deliverableSource).toContain("verificationStatus: 'FAILED'");
    expect(routesSource).toContain('retry: t.Optional(t.Boolean())');
    expect(routesSource).toContain('verificationStatus: result.verificationStatus');
    expect(agentSource).toContain('failUpload');
    expect(agentSource).toContain('Delivery verification returned no JSON decision.');
    expect(agentSource).toContain('markProcessed: true');
    expect(workerSource).toContain("data.type === 'verify-deliverable'");
    expect(workerSource).toContain("verificationStatus: 'FAILED'");
  });

  test('Walrus proof links use the aggregator blob route', async () => {
    const deliverableSource = await Bun.file(join(repoRoot, 'src/services/deliverable-management.ts')).text();
    const routeSource = await Bun.file(join(repoRoot, 'src/routes/deliverables.ts')).text();
    const walrusSource = await Bun.file(join(repoRoot, 'src/services/walrus.ts')).text();

    expect(deliverableSource).toContain('/v1/blobs/');
    expect(routeSource).toContain('/v1/blobs/');
    expect(walrusSource).toContain('/v1/blobs/${blobId}');
  });
});
