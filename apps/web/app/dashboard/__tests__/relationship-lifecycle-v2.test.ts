import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = process.cwd();

describe('relationship lifecycle v2 invariants', () => {
  it('uses the backend canonical relationship audit-log route', () => {
    const auditHook = readFileSync(join(webRoot, 'hooks/use-audit-log.ts'), 'utf8');
    const backendRoutes = readFileSync(
      join(webRoot, '../agent/src/routes/relationships.ts'),
      'utf8',
    );

    expect(auditHook).toContain('/audit-log');
    expect(backendRoutes).toContain("get('/:suiObjectId/audit-log'");
  });

  it('uses decimal USDC inputs and non-mutating anomaly preflight', () => {
    const hook = readFileSync(join(webRoot, 'hooks/use-create-relationship.ts'), 'utf8');
    const api = readFileSync(join(webRoot, 'lib/api/relationships.ts'), 'utf8');
    const createPage = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/new/create-relationship-client.tsx'),
      'utf8',
    );

    expect(hook).toContain('up to 6 decimals');
    expect(hook).toContain('checkAnomaly');
    expect(api).toContain('/relationships/anomaly-check');
    expect(api).toContain('/relationships/asset');
    expect(api).toContain('clientRequestId');
    expect(createPage).toContain('hasEnoughPayment');
    expect(createPage).toContain('Open Circle testnet faucet');
    expect(createPage).toContain('Refresh balances');
  });

  it('drives detail actions from actor-aware backend actions', () => {
    const detail = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/[id]/relationship-detail-client.tsx'),
      'utf8',
    );
    const milestone = readFileSync(join(webRoot, 'components/milestones/milestone-row.tsx'), 'utf8');

    expect(detail).toContain('relationship.actorRole');
    expect(detail).toContain('relationship.lifecycleGuidance');
    expect(milestone).toContain('RelationshipAction.APPROVE_RELEASE');
    expect(milestone).toContain('RelationshipAction.SUBMIT_DELIVERABLE');
  });

  it('does not request an AgentCap object id for deliverable submission', () => {
    const detail = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/[id]/relationship-detail-client.tsx'),
      'utf8',
    );

    expect(detail).not.toContain('Agent Cap ID');
    expect(detail).toContain('resolves the scoped verifier capability automatically');
  });

  it('exposes a recipient inbox and factual reputation fields', () => {
    const list = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/relationships-client.tsx'),
      'utf8',
    );
    const reputation = readFileSync(join(webRoot, 'lib/api/reputation.ts'), 'utf8');

    expect(list).toContain('Assigned to Me');
    expect(list).toContain('listAssigned');
    expect(reputation).toContain('successfulCount');
    expect(reputation).toContain('cancelledCount');
    expect(reputation).toContain('totalVolume');
  });

  it('provides wallet-level recipient routes without requiring a workspace', () => {
    const dashboard = readFileSync(join(webRoot, 'app/dashboard/dashboard-client.tsx'), 'utf8');
    const inbox = readFileSync(join(webRoot, 'components/relationships/assigned-relationships-client.tsx'), 'utf8');
    const routes = readFileSync(join(webRoot, 'constants/routes.ts'), 'utf8');
    const milestone = readFileSync(join(webRoot, 'components/milestones/milestone-row.tsx'), 'utf8');

    expect(dashboard).toContain('Assigned to Me');
    expect(dashboard).toContain('You do not need to create or join a workspace');
    expect(inbox).toContain('No workspace membership is required');
    expect(inbox).toContain('Completion attestations are minted automatically');
    expect(routes).toContain('personalRelationshipDetail');
    expect(routes).not.toContain('personalNewRelationship');
    expect(milestone).toContain('Verification:');
    expect(milestone).toContain('View on Walrus');
  });

  it('keeps personal mode recipient-only while workspaces own relationship creation', () => {
    const sidebar = readFileSync(join(webRoot, 'components/layout/sidebar.tsx'), 'utf8');
    const routes = readFileSync(join(webRoot, 'constants/routes.ts'), 'utf8');
    const assigned = readFileSync(join(webRoot, 'components/relationships/assigned-relationships-client.tsx'), 'utf8');

    expect(sidebar).toContain("label: 'Assigned to Me'");
    expect(sidebar).not.toContain('ROUTES.personalNewRelationship');
    expect(routes).not.toContain('personalNewRelationship');
    expect(assigned).not.toContain('Create a Relationship');
  });

  it('keeps factual memory available without MemWal and explains legitimate empty AI activity', () => {
    const detail = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/[id]/relationship-detail-client.tsx'),
      'utf8',
    );
    const timeline = readFileSync(join(webRoot, 'components/memory/memory-timeline.tsx'), 'utf8');
    const aiPanel = readFileSync(join(webRoot, 'components/agents/ai-activity-panel.tsx'), 'utf8');
    const memoryApi = readFileSync(join(webRoot, 'lib/api/memory.ts'), 'utf8');

    expect(detail).toContain('MemoryTimeline');
    expect(aiPanel).toContain('This is expected for manual approvals');
    expect(timeline).toContain('storageStatus');
    expect(timeline).toContain('Walrus indexing');
    expect(timeline).toContain('Walrus retry pending');
    expect(memoryApi).toContain('factualPayload');
  });

  it('places recipient reputation in personal navigation with explicit mint eligibility', () => {
    const sidebar = readFileSync(join(webRoot, 'components/layout/sidebar.tsx'), 'utf8');
    const routes = readFileSync(join(webRoot, 'constants/routes.ts'), 'utf8');
    const reputation = readFileSync(
      join(webRoot, 'app/[tenantSlug]/reputation/reputation-client.tsx'),
      'utf8',
    );
    const tenantReputation = readFileSync(
      join(webRoot, 'app/[tenantSlug]/reputation/page.tsx'),
      'utf8',
    );

    expect(sidebar).toContain("label: 'Reputation'");
    expect(sidebar).toContain('ROUTES.personalReputation');
    expect(routes).toContain("personalReputation: () => '/dashboard/reputation'");
    expect(reputation).toContain('mintEligibility');
    expect(reputation).toContain('disabledReason');
    expect(reputation).toContain('DAppKitConnectModal');
    expect(tenantReputation).toContain('ROUTES.personalReputation');
  });

  it('formats analytics from canonical base units without million scaling', () => {
    const dashboard = readFileSync(
      join(webRoot, 'app/[tenantSlug]/tenant-dashboard-client.tsx'),
      'utf8',
    );
    const analytics = readFileSync(
      join(webRoot, 'app/[tenantSlug]/analytics/analytics-client.tsx'),
      'utf8',
    );
    const api = readFileSync(join(webRoot, 'lib/api/tenants.ts'), 'utf8');

    expect(api).toContain('fundedBaseUnits');
    expect(api).toContain('releasedBaseUnits');
    expect(api).toContain('lockedBaseUnits');
    expect(dashboard).toContain('formatAmount');
    expect(analytics).toContain('formatAmount');
    expect(analytics).toContain('releasedMilestones');
    expect(analytics).not.toContain('totalVolume / 1_000_000');
  });

  it('connects notification controls and wallet-bound workspace invitations', () => {
    const topbar = readFileSync(join(webRoot, 'components/layout/top-bar.tsx'), 'utf8');
    const notifications = readFileSync(
      join(webRoot, 'components/notifications/notification-popover.tsx'),
      'utf8',
    );
    const settings = readFileSync(
      join(webRoot, 'app/[tenantSlug]/settings/settings-client.tsx'),
      'utf8',
    );
    const dashboard = readFileSync(join(webRoot, 'app/dashboard/dashboard-client.tsx'), 'utf8');
    const invitationDialog = readFileSync(
      join(webRoot, 'components/tenants/invite-member-dialog.tsx'),
      'utf8',
    );

    expect(topbar).toContain('NotificationPopover');
    expect(notifications).toContain('markAllRead');
    expect(notifications).toContain('markRead');
    expect(notifications).toContain('Loading notifications');
    expect(notifications).toContain('Notifications unavailable');
    expect(notifications).toContain('notificationQuery.refetch');
    expect(settings).toContain('InviteMemberDialog');
    expect(settings).toContain('status ===');
    expect(dashboard).toContain('listPendingInvitations');
    expect(dashboard).toContain('acceptInvitation');
    expect(dashboard).toContain('declineInvitation');
    expect(invitationDialog).toContain('isValidSuiAddress');
    expect(invitationDialog).not.toContain(`value={TenantRole.OWNER}`);
  });

  it('treats returned Sui transactions as confirmed only when effects succeeded', () => {
    const signer = readFileSync(join(webRoot, 'hooks/use-ptb-signer.ts'), 'utf8');
    const modal = readFileSync(join(webRoot, 'components/blockchain/ptb-preview-modal.tsx'), 'utf8');
    const transactionRoute = readFileSync(join(webRoot, '../agent/src/routes/transactions.ts'), 'utf8');
    const eventHandlers = readFileSync(join(webRoot, '../agent/src/workers/event-handlers.ts'), 'utf8');

    expect(signer).toContain("chainStatus !== 'success'");
    expect(signer).toContain('TransactionStatus.FAILED');
    expect(signer).toContain('options: { showEffects: true }');
    expect(modal).toContain('const isTerminal');
    expect(modal).toContain('isTerminal ? onClose : onConfirm');
    expect(transactionRoute).toContain("onChainStatus !== 'success'");
    expect(transactionRoute).toContain('Unknown transaction type');
    expect(eventHandlers).toContain('existing?.processed');
    expect(eventHandlers).toContain('markProcessed');
  });

  it('keeps AI preflight visible and restores tenant state from the active route', () => {
    const createHook = readFileSync(join(webRoot, 'hooks/use-create-relationship.ts'), 'utf8');
    const createPage = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/new/create-relationship-client.tsx'),
      'utf8',
    );
    const bootstrap = readFileSync(join(webRoot, 'components/providers/tenant-bootstrap.tsx'), 'utf8');
    const authHook = readFileSync(join(webRoot, 'hooks/use-wallet-auth.ts'), 'utf8');
    const settings = readFileSync(
      join(webRoot, 'app/[tenantSlug]/settings/settings-client.tsx'),
      'utf8',
    );
    const flagsService = readFileSync(join(webRoot, '../agent/src/services/feature-flags.ts'), 'utf8');
    const sharedTypes = readFileSync(join(webRoot, '../../packages/types/src/index.ts'), 'utf8');

    expect(createHook).toContain('setCurrentStep(3)');
    expect(createHook).toContain('runAnomalyCheck');
    expect(createPage).not.toContain('line-through opacity-40');
    expect(createPage).toContain('AI anomaly analysis is disabled for this workspace');
    expect(createPage).toContain('Enable and run AI check');
    expect(settings).toContain('FEATURE_FLAG_CATALOG');
    expect(flagsService).toContain('FEATURE_FLAG_CATALOG');
    expect(sharedTypes).toContain('AI anomaly analysis and verification');
    expect(bootstrap).toContain('needsTenantSync');
    expect(bootstrap).toContain('activeTenantSlug !== pathTenantSlug');
    expect(authHook).toContain('RETURN_PATH_KEY');
    expect(authHook).toContain('router.push(ROUTES.dashboard())');
  });

  it('does not ask for deliverable proof on manual milestones', () => {
    const milestone = readFileSync(join(webRoot, 'components/milestones/milestone-row.tsx'), 'utf8');
    const service = readFileSync(join(webRoot, '../agent/src/services/relationship-management.ts'), 'utf8');
    const proofDialog = readFileSync(
      join(webRoot, 'components/deliverables/deliverable-proof-dialog.tsx'),
      'utf8',
    );
    const api = readFileSync(join(webRoot, 'lib/api/relationships.ts'), 'utf8');

    expect(milestone).toContain('milestone.conditionType === ConditionType.DELIVERABLE');
    expect(milestone).toContain('Uploaded to Walrus; submit on-chain to start verification');
    expect(milestone).toContain('Preview proof');
    expect(milestone).toContain('DeliverableProofDialog');
    expect(proofDialog).toContain('Previewing immutable evidence from Walrus');
    expect(proofDialog).toContain('mimeType');
    expect(api).toContain('walrusUrl');
    expect(api).toContain('contentType');
    expect(service).toContain('does not require proof submission');
    expect(service).toContain('Deliverable milestones can only be released after verified evidence');
  });

  it('renders AI unavailable as degraded state instead of low-risk success', () => {
    const hook = readFileSync(join(webRoot, 'hooks/use-create-relationship.ts'), 'utf8');
    const api = readFileSync(join(webRoot, 'lib/api/relationships.ts'), 'utf8');
    const createPage = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/new/create-relationship-client.tsx'),
      'utf8',
    );
    const aiPanel = readFileSync(join(webRoot, 'components/agents/ai-activity-panel.tsx'), 'utf8');

    expect(hook).toContain('AnomalyPreflightResult');
    expect(api).toContain('AnomalyPreflightResult');
    expect(createPage).toContain("anomalyResult?.status === 'UNAVAILABLE'");
    expect(createPage).toContain('Retry AI check');
    expect(createPage).toContain('AI anomaly analysis is unavailable');
    expect(aiPanel).toContain("if (!action.success) return 'FAILED'");
    expect(aiPanel).toContain('AI run failed');
    expect(aiPanel).toContain("action.promptVersion !== 'unknown'");
  });

  it('uses shared Walrus blob URLs and resilient proof preview fallbacks', () => {
    const walrus = readFileSync(join(webRoot, 'lib/walrus.ts'), 'utf8');
    const routes = readFileSync(join(webRoot, 'constants/routes.ts'), 'utf8');
    const deliverablesApi = readFileSync(join(webRoot, 'lib/api/deliverables.ts'), 'utf8');
    const relationshipsApi = readFileSync(join(webRoot, 'lib/api/relationships.ts'), 'utf8');
    const memoryTimeline = readFileSync(join(webRoot, 'components/memory/memory-timeline.tsx'), 'utf8');
    const proofDialog = readFileSync(
      join(webRoot, 'components/deliverables/deliverable-proof-dialog.tsx'),
      'utf8',
    );

    expect(walrus).toContain('/v1/blobs/');
    expect(routes).toContain('buildWalrusBlobUrl(blobId)');
    expect(deliverablesApi).toContain('buildWalrusBlobUrl(data.blobId)');
    expect(relationshipsApi).toContain('buildWalrusBlobUrl');
    expect(memoryTimeline).toContain('buildWalrusBlobUrl(entry.walrusBlobId)');
    expect(proofDialog).toContain("previewState === 'failed'");
    expect(proofDialog).toContain('Preview could not be loaded');
    expect(proofDialog).toContain('onError={() => setPreviewState');
  });

  it('prevents double create signing and redirects only after modal completion', () => {
    const signer = readFileSync(join(webRoot, 'hooks/use-ptb-signer.ts'), 'utf8');
    const createPage = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/new/create-relationship-client.tsx'),
      'utf8',
    );
    const modal = readFileSync(join(webRoot, 'components/blockchain/ptb-preview-modal.tsx'), 'utf8');

    expect(signer).toContain('prepareInFlightRef');
    expect(signer).toContain('signInFlightRef');
    expect(signer).toContain('onConfirmed?.(txDigest, relationshipId)');
    expect(createPage).toContain('Preparing transaction...');
    expect(createPage).toContain('Review transaction');
    expect(createPage).toContain('createSuccessTarget');
    expect(createPage).toContain('handlePtbModalClose');
    expect(createPage).not.toContain('router.push(relationshipsHref);');
    expect(modal).toContain('UITransactionStatus.PREPARING');
    expect(modal).toContain('UITransactionStatus.PENDING');
  });

  it('keeps relationship progress polling while verification and indexing are pending', () => {
    const detail = readFileSync(
      join(webRoot, 'app/[tenantSlug]/relationships/[id]/relationship-detail-client.tsx'),
      'utf8',
    );
    const milestone = readFileSync(join(webRoot, 'components/milestones/milestone-row.tsx'), 'utf8');

    expect(detail).toContain('refetchInterval');
    expect(detail).toContain("verificationStatus === 'SCANNING'");
    expect(detail).toContain('waitingForIndexing');
    expect(detail).toContain('Transaction confirmed on-chain');
    expect(milestone).toContain('ReleasePolicy.AUTO_AFTER_CHALLENGE');
    expect(milestone).toContain('challenge window');
    expect(milestone).toContain('Retry or ask a workspace admin to check AI settings');
    expect(milestone).toContain('Submit proof again');
    expect(milestone).toContain('Submit this proof on-chain again before AI verification can run.');
    expect(milestone).toContain('milestone.status === MilestoneStatus.SUBMITTED');
    expect(milestone).toContain('Retry verification');
    expect(milestone).toContain('onRetryVerification');
    expect(detail).toContain('handleRetryVerification');
    expect(detail).toContain('Submit the proof on-chain before retrying AI verification.');
    expect(detail).toContain('retry: true');
  });

  it('describes the public app flow without promising automatic AI releases', () => {
    const hero = readFileSync(join(webRoot, 'components/landing/hero.tsx'), 'utf8');
    const features = readFileSync(join(webRoot, 'components/landing/features.tsx'), 'utf8');
    const howItWorks = readFileSync(join(webRoot, 'components/landing/how-it-works.tsx'), 'utf8');
    const techStack = readFileSync(join(webRoot, 'components/landing/tech-stack.tsx'), 'utf8');
    const faq = readFileSync(join(webRoot, 'components/landing/faq.tsx'), 'utf8');
    const guide = readFileSync(join(webRoot, 'app/guide/page.tsx'), 'utf8');

    expect(hero).toContain('fund milestones on Sui');
    expect(hero).toContain('Payer can approve release on Sui');
    expect(hero).toContain('isReadyAuthenticated');
    expect(features).toContain('Payer/operator approval');
    expect(howItWorks).toContain('Auto-release is opt-in');
    expect(faq).toContain('it does not silently move funds');
    expect(guide).toContain('Submit Proof → Verify → Approve Release');
    expect(guide).toContain('AI verification proves evidence quality');
    expect(techStack).toContain('Walrus Memory');
    expect(techStack).not.toContain('Next.js & React Core');
    expect(`${hero}\n${faq}\n${guide}`).not.toContain('automatically unlocks the funds');
    expect(`${hero}\n${faq}\n${guide}`).not.toContain('Escrow automatically unlocked');
  });

  it('keeps admin prompts keyed by version and allows browser worker effects under CSP', () => {
    const admin = readFileSync(join(webRoot, 'app/[tenantSlug]/admin/admin-client.tsx'), 'utf8');
    const nextConfig = readFileSync(join(webRoot, 'next.config.ts'), 'utf8');

    expect(admin).toContain('key={p.id ?? `${p.key}:${p.version}`}');
    expect(nextConfig).toContain("worker-src 'self' blob:");
  });
});
