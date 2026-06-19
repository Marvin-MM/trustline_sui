'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { useDAppKit } from '@mysten/dapp-kit-react';
import {
  GitBranch, Brain, Activity, Shield,
  ChevronLeft, Cpu, Sparkles, Upload, X, UserRound, Users,
  BadgeDollarSign, CheckCircle2, TrendingUp, Clock
} from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { relationshipsApi } from '@/lib/api/relationships';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { MilestoneRow } from '@/components/milestones/milestone-row';
import { AIActivityPanel } from '@/components/agents/ai-activity-panel';
import { AuditTimeline } from '@/components/audit/audit-timeline';
import { AddressDisplay } from '@/components/blockchain/address-display';
import { PtbPreviewModal } from '@/components/blockchain/ptb-preview-modal';
import { TransactionStatusToast } from '@/components/blockchain/transaction-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import { ROUTES } from '@/constants/routes';
import { formatAmount, formatRelativeTime } from '@/lib/utils';
import { usePtbSigner } from '@/hooks/use-ptb-signer';
import { UITransactionStatus } from '@/lib/transaction-status';
import { cn } from '@/lib/utils';
import { parseDAppKitExecutionResult } from '@/lib/dapp-kit-result';
import { MilestoneStatus, RelationshipAction, RelationshipStatus } from '@bondflow/types';
import { RaiseDisputeModal } from '@/components/milestones/raise-dispute-modal';
import { AgentCapModal } from '@/components/relationships/agent-cap-modal';
import { OperatorCapModal } from '@/components/relationships/operator-cap-modal';
import { UploadZone } from '@/components/deliverables/upload-zone';
import { deliverablesApi } from '@/lib/api/deliverables';
import { DAppKitConnectModal } from '@/components/blockchain/dapp-kit-connect-modal';
import { useSigningWallet } from '@/hooks/use-signing-wallet';
import { memoryApi } from '@/lib/api/memory';
import { MemoryTimeline } from '@/components/memory/memory-timeline';
import { EmptyState } from '@/components/ui/empty-state';

const TABS = ['Milestones', 'AI Activity', 'Memory', 'Audit Log'] as const;
type Tab = typeof TABS[number];

interface RelationshipDetailClientProps {
  tenantSlug?: string;
  relationshipId: string;
}

export function RelationshipDetailClient({
  tenantSlug,
  relationshipId,
}: RelationshipDetailClientProps) {
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const signingWallet = useSigningWallet();
  const [activeTab, setActiveTab] = useState<Tab>('Milestones');
  const [ptbModalOpen, setPtbModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [pendingReleaseIndex, setPendingReleaseIndex] = useState<number | null>(null);
  const [pendingCancelConfirm, setPendingCancelConfirm] = useState(false);
  const [disputeMilestoneIndex, setDisputeMilestoneIndex] = useState<number | null>(null);
  const [uploadMilestoneIndex, setUploadMilestoneIndex] = useState<number | null>(null);
  const [pendingBlobId, setPendingBlobId] = useState<string | null>(null);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [pendingResolution, setPendingResolution] = useState<{ index: number; resolution: 2 | 3 } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const pendingReleaseIndexRef = useRef<number | null>(null);
  const pendingResolutionRef = useRef<{ index: number; resolution: 2 | 3 } | null>(null);

  const { data: relationship, isLoading } = useQuery({
    queryKey: queryKeys.relationships.detail(relationshipId),
    queryFn: () => relationshipsApi.getById(relationshipId),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      const shouldPoll = data?.status === RelationshipStatus.PENDING_ON_CHAIN
        || data?.milestones.some((milestone) =>
          milestone.deliverable?.verificationStatus === 'SCANNING'
          || milestone.status === MilestoneStatus.SUBMITTED
          || milestone.status === MilestoneStatus.CONDITION_MET);
      return shouldPoll ? 5_000 : false;
    },
  });

  const { data: agentActionsData } = useQuery({
    queryKey: queryKeys.agentActions.byRelationship(relationshipId, 1),
    queryFn: () => relationshipsApi.getAgentActions(relationshipId, { page: 1, limit: 20 }),
    enabled: activeTab === 'AI Activity',
    staleTime: 60_000,
  });

  const { data: memoryEntriesData, isLoading: memoryLoading } = useQuery({
    queryKey: queryKeys.memory.entries(relationshipId, 1),
    queryFn: () => memoryApi.getEntries(relationshipId, { page: 1, limit: 20 }),
    enabled: activeTab === 'Memory',
    staleTime: 30_000,
  });

  // Release milestone PTB signer
  const releaseSigner = usePtbSigner({
    txType: 'RELEASE_MILESTONE',
    fetchPtb: async () => {
      if (pendingReleaseIndexRef.current === null) throw new Error('No milestone selected');
      return relationshipsApi.getReleasePtb(relationshipId, pendingReleaseIndexRef.current);
    },
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memory.entries(relationshipId, 1) });
      toast.success('Milestone released!');
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
    },
    invalidateKeys: [queryKeys.relationships.detail(relationshipId)],
  });

  // Retry Create Signer
  const retryCreateSigner = usePtbSigner({
    txType: 'CREATE_RELATIONSHIP',
    fetchPtb: () => relationshipsApi.getRetryCreatePtb(relationshipId),
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      toast.success('Relationship creation submitted to the blockchain!');
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
    },
  });

  // Cancel relationship PTB signer
  const cancelSigner = usePtbSigner({
    txType: 'CANCEL_RELATIONSHIP',
    fetchPtb: () => relationshipsApi.getCancelPtb(relationshipId),
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      toast.success('Relationship cancelled.');
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
    },
  });

  const submitDeliverableSigner = usePtbSigner({
    txType: 'SUBMIT_DELIVERABLE',
    fetchPtb: async () => {
      if (uploadMilestoneIndex === null || !pendingBlobId) throw new Error('No upload context');
      return deliverablesApi.getSubmitPtb({
        relationshipId,
        milestoneIndex: uploadMilestoneIndex,
        blobId: pendingBlobId,
      });
    },
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      let verificationMessage = 'Deliverable submitted. Verification is running.';
      if (uploadMilestoneIndex !== null && pendingBlobId) {
        try {
          const queued = await deliverablesApi.queueVerification({
            relationshipId,
            milestoneIndex: uploadMilestoneIndex,
            blobId: pendingBlobId,
          });
          verificationMessage = queued.verificationStatus === 'SCANNING'
            ? 'Deliverable submitted. Verification is running.'
            : queued.verificationStatus === 'FAILED'
              ? `Deliverable submitted, but verification failed: ${queued.message}`
              : `Deliverable submitted. Verification is ${queued.verificationStatus.toLowerCase()}.`;
        } catch (error) {
          verificationMessage = `Deliverable submitted, but verification could not start: ${error instanceof Error ? error.message : 'unknown error'}`;
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memory.entries(relationshipId, 1) });
      if (verificationMessage.includes('failed')) {
        toast.warning(verificationMessage);
      } else {
        toast.success(verificationMessage);
      }
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
    },
    invalidateKeys: [queryKeys.relationships.detail(relationshipId)],
  });

  const resolveDisputeSigner = usePtbSigner({
    txType: 'RESOLVE_DISPUTE',
    fetchPtb: async () => {
      if (!pendingResolutionRef.current) throw new Error('No dispute resolution selected');
      return relationshipsApi.getResolveDisputePtb(
        relationshipId,
        pendingResolutionRef.current.index,
        pendingResolutionRef.current.resolution,
      );
    },
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memory.entries(relationshipId, 1) });
      toast.success('Dispute resolved on-chain.');
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
    },
  });

  const handleRelease = (milestoneIndex: number) => {
    pendingReleaseIndexRef.current = milestoneIndex;
    setPendingReleaseIndex(milestoneIndex);
    setPtbModalOpen(true);
    void releaseSigner.prepare();
  };

  const handleCancelConfirmed = () => {
    setPendingCancelConfirm(false);
    setPtbModalOpen(true);
    void cancelSigner.prepare();
  };

  if (isLoading || !relationship) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const totalMilestones = relationship.milestones.length;
  const releasedMilestones = relationship.milestones.filter((m) => m.status === MilestoneStatus.RELEASED).length;
  const progressPct = totalMilestones > 0 ? Math.round((releasedMilestones / totalMilestones) * 100) : 0;
  const activeSignerState = isRetrying ? retryCreateSigner
    : pendingResolution !== null ? resolveDisputeSigner
    : pendingBlobId !== null ? submitDeliverableSigner
    : pendingReleaseIndex !== null ? releaseSigner
    : cancelSigner;
  const resetPtbContext = () => {
    activeSignerState.reset();
    pendingReleaseIndexRef.current = null;
    pendingResolutionRef.current = null;
    setPendingReleaseIndex(null);
    setPendingResolution(null);
    setUploadMilestoneIndex(null);
    setPendingBlobId(null);
    setIsRetrying(false);
  };
  const relationshipsHref = tenantSlug
    ? ROUTES.tenantRelationships(tenantSlug)
    : ROUTES.personalRelationships();
  const waitingForIndexing = activeSignerState.status === UITransactionStatus.CONFIRMED;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href={relationshipsHref}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Relationships
        </Link>
        <PageHeader
          title={relationship.memo || 'Untitled Relationship'}
          icon={GitBranch}
          breadcrumbs={[
            { label: tenantSlug ? 'Relationships' : 'Assigned to Me', href: relationshipsHref },
            { label: relationship.memo || 'Untitled' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={relationship.status} />
              {relationship.status === RelationshipStatus.ACTIVE && !relationship.legacyReadOnly && (
                <>
                  {relationship.availableActions.includes(RelationshipAction.MANAGE_AUTOMATION) && (
                    <button
                      onClick={() => setAutomationModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {relationship.automation.active ? 'Automation Active' : 'Configure Automation'}
                    </button>
                  )}
                  {relationship.availableActions.includes(RelationshipAction.MANAGE_OPERATORS) && (
                    <button
                      onClick={() => setOperatorModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Add Operator
                    </button>
                  )}
                  {relationship.availableActions.includes(RelationshipAction.CANCEL_REMAINING) && (
                  <button
                    onClick={() => setPendingCancelConfirm(true)}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    Cancel Remaining
                  </button>
                  )}
                </>
              )}
            </div>
          }
        />
      </div>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-5 w-5 text-brand" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your role: {relationship.actorRole}</p>
              <p className="mt-1 text-sm text-muted-foreground">{relationship.lifecycleGuidance}</p>
              {relationship.actorRole === 'RECIPIENT' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Your completion attestation is minted automatically when the payer releases a milestone.
                </p>
              )}
              {relationship.legacyReadOnly && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Legacy v1 history is view-only.
                </p>
              )}
            </div>
          </div>
          {relationship.status === RelationshipStatus.PENDING_ON_CHAIN && relationship.actorRole === 'PAYER' && (
            <button
              onClick={() => {
                setIsRetrying(true);
                setPtbModalOpen(true);
                void retryCreateSigner.prepare();
              }}
              className="flex-shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors shadow-sm"
            >
              Complete On-Chain Setup
            </button>
          )}
        </div>
      </div>

      {waitingForIndexing && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-muted-foreground">
          Transaction confirmed on-chain. BondFlow is refreshing indexed milestones, memory, attestations, and notifications now.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Amount', value: formatAmount(BigInt(relationship.totalAmount), relationship.asset.decimals, relationship.asset.symbol), icon: BadgeDollarSign },
          { label: 'Released', value: formatAmount(BigInt(relationship.releasedAmount), relationship.asset.decimals, relationship.asset.symbol), icon: CheckCircle2 },
          { label: 'Progress', value: `${progressPct}%`, icon: TrendingUp },
          { label: 'Created', value: formatRelativeTime(relationship.createdAt), icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="group rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-brand/30 hover:shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <stat.icon className="h-4 w-4 text-brand/70 group-hover:text-brand transition-colors" />
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground font-mono-num group-hover:text-brand transition-colors">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
          <span className="text-sm font-semibold text-foreground">
            Milestone Progress
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {releasedMilestones} of {totalMilestones} released (<span className="text-brand font-mono-num font-semibold">{progressPct}%</span>)
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
          <div
            className="h-full rounded-full bg-brand transition-all duration-700 ease-out shadow-[0_0_10px_rgba(var(--brand),0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand/30 group">
          <p className="text-xs font-medium text-muted-foreground mb-2 group-hover:text-brand transition-colors">Payer Wallet</p>
          <AddressDisplay address={relationship.payerWallet} truncate link size="md" />
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand/30 group">
          <p className="text-xs font-medium text-muted-foreground mb-2 group-hover:text-brand transition-colors">Recipient Wallet</p>
          <AddressDisplay address={relationship.recipientWallet} truncate link size="md" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-1.5 border border-border/50">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                activeTab === tab
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {tab === 'Milestones' && <GitBranch className={cn("h-4 w-4", activeTab === tab ? "text-brand" : "")} />}
              {tab === 'AI Activity' && <Cpu className={cn("h-4 w-4", activeTab === tab ? "text-brand" : "")} />}
              {tab === 'Memory' && <Brain className={cn("h-4 w-4", activeTab === tab ? "text-brand" : "")} />}
              {tab === 'Audit Log' && <Activity className={cn("h-4 w-4", activeTab === tab ? "text-brand" : "")} />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Milestones' && (
          <div className="space-y-3">
            {relationship.milestones.map((milestone, i) => (
              <MilestoneRow
                key={i}
                milestone={milestone}
                index={i}
                relationshipId={relationshipId}
                asset={relationship.asset}
                onRelease={handleRelease}
                onRaiseDispute={(idx) => setDisputeMilestoneIndex(idx)}
                onUploadDeliverable={(idx) => {
                  setUploadMilestoneIndex(idx);
                  const existingUpload = relationship.milestones[idx]?.deliverable;
                  setPendingBlobId(existingUpload?.verificationStatus === 'UPLOADED'
                    ? existingUpload.blobId
                    : null);
                }}
                onResolveDispute={(index, resolution) => {
                  pendingResolutionRef.current = { index, resolution };
                  setPendingResolution({ index, resolution });
                  setPtbModalOpen(true);
                  void resolveDisputeSigner.prepare();
                }}
              />
            ))}

            {/* Inline deliverable upload section */}
            {uploadMilestoneIndex !== null && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4 text-brand" />
                    Upload Deliverable — Milestone {uploadMilestoneIndex + 1}
                  </h3>
                  <button
                    onClick={() => { setUploadMilestoneIndex(null); setPendingBlobId(null); }}
                    className="rounded-sm opacity-70 hover:opacity-100"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <UploadZone
                  relationshipId={relationshipId}
                  milestoneIndex={uploadMilestoneIndex}
                  onSuccess={(result) => setPendingBlobId(result.blobId)}
                />
                {pendingBlobId && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground font-mono-num truncate">
                      Blob ID: {pendingBlobId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submit the Walrus blob on-chain. BondFlow resolves the scoped verifier capability automatically.
                    </p>
                    <button
                      onClick={() => { setPtbModalOpen(true); void submitDeliverableSigner.prepare(); }}
                      className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
                    >
                      Submit Deliverable
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'AI Activity' && (
          <ComponentErrorBoundary>
            <AIActivityPanel
              actions={agentActionsData?.data ?? []}
              totalInvocations={agentActionsData?.pagination.total ?? 0}
            />
          </ComponentErrorBoundary>
        )}

        {activeTab === 'Memory' && (
          <div className="space-y-4">
            {memoryLoading ? (
              <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
            ) : memoryEntriesData?.data.length ? (
              <MemoryTimeline entries={memoryEntriesData.data} />
            ) : (
              <EmptyState
                icon={Brain}
                title="No factual memory indexed yet"
                description="Lifecycle events will appear here after blockchain reconciliation. Manual approvals create factual memory without creating AI activity."
              />
            )}
            {relationship.walrusMemorySpaceId && tenantSlug && (
              <Link
                href={ROUTES.tenantMemory(tenantSlug, relationshipId)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20"
              >
                <Sparkles className="h-4 w-4" />
                Open full memory and Ask AI
              </Link>
            )}
          </div>
        )}

        {activeTab === 'Audit Log' && (
          <ComponentErrorBoundary>
            <AuditTimeline relationshipId={relationshipId} />
          </ComponentErrorBoundary>
        )}
      </div>

      {/* PTB Preview Modal */}
      <PtbPreviewModal
        open={ptbModalOpen}
        onOpenChange={(open) => { if (!open) { setPtbModalOpen(false); resetPtbContext(); }}}
        description={activeSignerState.ptbDescription}
        estimatedGas={activeSignerState.estimatedGas}
        ptbBytes={activeSignerState.ptbBytes}
        status={activeSignerState.status}
        errorMessage={activeSignerState.errorMessage}
        digest={activeSignerState.digest}
        walletAddress={signingWallet.displayAddress}
        walletConnected={signingWallet.isMatch}
        walletWarning={signingWallet.warning}
        onConnectWallet={() => setConnectModalOpen(true)}
        onConfirm={() => void activeSignerState.sign()}
        onClose={() => { setPtbModalOpen(false); resetPtbContext(); }}
      />
      <DAppKitConnectModal
        open={connectModalOpen}
        onClosed={() => setConnectModalOpen(false)}
      />

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        open={pendingCancelConfirm}
        onOpenChange={setPendingCancelConfirm}
        title="Cancel Remaining Milestones"
        description="This returns only pending milestone funds to the original payer. Submitted, verified, and disputed milestones remain active for review or resolution."
        confirmLabel="Cancel Pending Milestones"
        variant="destructive"
        onConfirm={handleCancelConfirmed}
      />

      {/* Transaction toasts */}
      <TransactionStatusToast
        digest={retryCreateSigner.digest}
        status={retryCreateSigner.status}
      />
      <TransactionStatusToast
        digest={releaseSigner.digest}
        status={releaseSigner.status}
      />
      <TransactionStatusToast
        digest={cancelSigner.digest}
        status={cancelSigner.status}
      />
      <TransactionStatusToast
        digest={submitDeliverableSigner.digest}
        status={submitDeliverableSigner.status}
      />
      <TransactionStatusToast
        digest={resolveDisputeSigner.digest}
        status={resolveDisputeSigner.status}
      />

      {/* Raise dispute modal */}
      <RaiseDisputeModal
        open={disputeMilestoneIndex !== null}
        onOpenChange={(open) => { if (!open) setDisputeMilestoneIndex(null); }}
        relationshipId={relationshipId}
        milestoneIndex={disputeMilestoneIndex}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
          setDisputeMilestoneIndex(null);
        }}
      />

      <AgentCapModal
        open={automationModalOpen}
        onOpenChange={setAutomationModalOpen}
        mode={relationship.automation.active ? 'revoke' : 'grant'}
        relationshipId={relationshipId}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
          setAutomationModalOpen(false);
        }}
      />
      <OperatorCapModal
        open={operatorModalOpen}
        onOpenChange={setOperatorModalOpen}
        relationshipId={relationshipId}
      />

    </div>
  );
}
