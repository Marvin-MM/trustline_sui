'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, FileText, AlertTriangle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { cn, formatAmount, formatRelativeTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { AIInsightBadge } from '@/components/agents/ai-insight-badge';
import { DeliverableProofDialog } from '@/components/deliverables/deliverable-proof-dialog';
import { ConditionType, MilestoneStatus, DisputeStatus, RelationshipAction, ReleasePolicy } from '@bondflow/types';
import type { MilestoneDto } from '@/lib/api/relationships';

const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  [ConditionType.MANUAL]: 'Manual approval',
  [ConditionType.TIME_GATED]: 'Time-locked',
  [ConditionType.DELIVERABLE]: 'Deliverable required',
};

const CONDITION_ICONS: Record<ConditionType, React.ElementType> = {
  [ConditionType.MANUAL]: CheckCircle,
  [ConditionType.TIME_GATED]: Clock,
  [ConditionType.DELIVERABLE]: FileText,
};

interface MilestoneRowProps {
  milestone: MilestoneDto;
  index: number;
  relationshipId: string;
  asset?: { symbol: string; decimals: number };
  onRelease?: (index: number) => void;
  onRaiseDispute?: (index: number) => void;
  onUploadDeliverable?: (index: number) => void;
  onRetryVerification?: (index: number) => void;
  onResolveDispute?: (index: number, resolution: 2 | 3) => void;
  latestAiAction?: {
    actionType: string;
    decision: string;
    confidence: number | null;
    reasoning?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  } | null;
}

/**
 * MilestoneRow — full state machine rendering with contextual actions.
 * AI insight badge shows the most recent agent action for this milestone.
 * Actions gated by useHasPermission.
 */
export function MilestoneRow({
  milestone,
  index,
  relationshipId,
  asset = { symbol: 'USDC', decimals: 6 },
  onRelease,
  onRaiseDispute,
  onUploadDeliverable,
  onRetryVerification,
  onResolveDispute,
  latestAiAction,
}: MilestoneRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  const canRelease = milestone.actions.includes(RelationshipAction.APPROVE_RELEASE);
  const canDispute = milestone.actions.includes(RelationshipAction.RAISE_DISPUTE);
  const canUpload = milestone.actions.includes(RelationshipAction.SUBMIT_DELIVERABLE);
  const canResolve = milestone.actions.includes(RelationshipAction.RESOLVE_DISPUTE);
  const uploadLabel = milestone.deliverable?.verificationStatus === 'UPLOADED'
    ? 'Continue submission'
    : milestone.deliverable && ['REJECTED', 'FAILED'].includes(milestone.deliverable.verificationStatus)
      ? milestone.status === MilestoneStatus.PENDING ? 'Submit proof again' : 'Retry upload'
      : 'Upload proof';
  const verificationLabel = milestone.deliverable?.verificationStatus === 'UPLOADED'
    ? 'Uploaded to Walrus; submit on-chain to start verification'
    : milestone.deliverable?.verificationStatus
      ? `Verification: ${milestone.deliverable.verificationStatus.replaceAll('_', ' ')}`
      : null;
  const verificationNote = milestone.deliverable?.reason?.includes('abort code: 1004')
    && milestone.status === MilestoneStatus.PENDING
    ? 'Submit this proof on-chain again before AI verification can run.'
    : milestone.deliverable?.reason;
  const challengeDeadlineMs = milestone.challengeDeadline ? new Date(milestone.challengeDeadline).getTime() : null;
  const isChallengeWindowOpen = milestone.releasePolicy === ReleasePolicy.AUTO_AFTER_CHALLENGE
    && milestone.status === MilestoneStatus.CONDITION_MET
    && challengeDeadlineMs !== null
    && challengeDeadlineMs > Date.now();

  const ConditionIcon = CONDITION_ICONS[milestone.conditionType];
  const isReleasable = canRelease;
  const isPending = milestone.status === MilestoneStatus.PENDING;
  const isReleased = milestone.status === MilestoneStatus.RELEASED;
  const isDisputed = milestone.status === MilestoneStatus.DISPUTED;

  return (
    <CollapsiblePrimitive.Root open={expanded} onOpenChange={setExpanded}>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          'rounded-xl border border-border bg-card p-4 transition-all',
          isReleasable && 'border-cyan-300 dark:border-cyan-800',
          isDisputed && 'border-rose-300 dark:border-rose-800'
        )}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Milestone number */}
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            isReleased ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
            isReleasable ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
            isDisputed ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
            'bg-muted text-muted-foreground'
          )}>
            {index + 1}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground font-mono-num">
                {formatAmount(milestone.amount, asset.decimals, asset.symbol)}
              </span>
              <StatusBadge status={milestone.status} size="sm" />
              {latestAiAction && (
                <AIInsightBadge
                  actionType={latestAiAction.actionType}
                  decision={latestAiAction.decision}
                  confidence={latestAiAction.confidence}
                  reasoningText={latestAiAction.reasoning}
                  severity={latestAiAction.severity}
                />
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <ConditionIcon className="h-3.5 w-3.5" />
              <span>{CONDITION_TYPE_LABELS[milestone.conditionType]}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate">{milestone.conditionValue}</span>
            </div>

            {milestone.releasedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Released {formatRelativeTime(milestone.releasedAt)}
              </p>
            )}
            {milestone.deliverable && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {milestone.deliverable.verificationStatus === 'SCANNING' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                  {verificationLabel}
                </span>
                {milestone.deliverable.verificationStatus === 'FAILED' && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                    Retry or ask a workspace admin to check AI settings
                  </span>
                )}
                {milestone.deliverable.confidence !== null && (
                  <span className="text-muted-foreground">{milestone.deliverable.confidence}% confidence</span>
                )}
                <a
                  href={milestone.deliverable.walrusUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                >
                  View on Walrus <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setProofOpen(true)}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:text-brand hover:underline"
                >
                  Preview proof
                </button>
              </div>
            )}
            {isChallengeWindowOpen && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Auto-release is waiting through the 24-hour challenge window. It can release after {formatRelativeTime(milestone.challengeDeadline!)} if no dispute is raised.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Upload deliverable */}
            {canUpload && isPending && milestone.conditionType === ConditionType.DELIVERABLE && (
              <TooltipPrimitive.Provider>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <button
                      onClick={() => onUploadDeliverable?.(index)}
                      disabled={!canUpload}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        canUpload
                          ? 'bg-brand/10 text-brand hover:bg-brand/20'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      {uploadLabel}
                    </button>
                  </TooltipPrimitive.Trigger>
                  {!canUpload && (
                    <TooltipPrimitive.Content className="z-50 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-lg">
                      You don&apos;t have permission to upload deliverables
                    </TooltipPrimitive.Content>
                  )}
                </TooltipPrimitive.Root>
              </TooltipPrimitive.Provider>
            )}
            {milestone.deliverable?.verificationStatus === 'FAILED' && milestone.status === MilestoneStatus.SUBMITTED && (
              <button
                onClick={() => onRetryVerification?.(index)}
                className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
              >
                Retry verification
              </button>
            )}

            {/* Release button */}
            {canRelease && (
              <TooltipPrimitive.Provider>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <button
                      onClick={() => onRelease?.(index)}
                      disabled={!canRelease}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        canRelease
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      Release
                    </button>
                  </TooltipPrimitive.Trigger>
                  {!canRelease && (
                    <TooltipPrimitive.Content className="z-50 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-lg">
                      You don&apos;t have permission to release milestones
                    </TooltipPrimitive.Content>
                  )}
                </TooltipPrimitive.Root>
              </TooltipPrimitive.Provider>
            )}

            {/* Dispute button — contract requires milestone.status == CONDITION_MET */}
            {canDispute && (
              <button
                onClick={() => onRaiseDispute?.(index)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Dispute
              </button>
            )}
            {canResolve && (
              <>
                <button
                  onClick={() => onResolveDispute?.(index, 2)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Pay Recipient
                </button>
                <button
                  onClick={() => onResolveDispute?.(index, 3)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Refund Payer
                </button>
              </>
            )}

            {/* Expand */}
            <CollapsiblePrimitive.Trigger asChild>
              <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsiblePrimitive.Trigger>
          </div>
        </div>

        {/* Expanded content */}
        <CollapsiblePrimitive.Content>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {milestone.walrusBlobId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Blob ID:</span>
                <span className="font-mono-num text-xs text-foreground">{milestone.walrusBlobId}</span>
              </div>
            )}
            {verificationNote && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground">Verification note:</span>
                <span className="text-xs text-foreground">{verificationNote}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Release policy:</span>
              <span className="text-xs text-foreground">{milestone.releasePolicy.replaceAll('_', ' ')}</span>
            </div>
            {milestone.challengeDeadline && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Challenge window ends {formatRelativeTime(milestone.challengeDeadline)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Condition value:</span>
              <span className="text-xs text-foreground">{milestone.conditionValue}</span>
            </div>
            {milestone.disputeStatus !== DisputeStatus.NONE && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs text-rose-600 dark:text-rose-400">
                  Dispute: {milestone.disputeStatus.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </CollapsiblePrimitive.Content>
      </motion.div>
      {milestone.deliverable && (
        <DeliverableProofDialog
          open={proofOpen}
          onOpenChange={setProofOpen}
          blobId={milestone.deliverable.blobId}
          walrusUrl={milestone.deliverable.walrusUrl}
          mimeType={milestone.deliverable.mimeType}
          sizeBytes={milestone.deliverable.sizeBytes}
          milestoneLabel={`Milestone ${index + 1} proof`}
        />
      )}
    </CollapsiblePrimitive.Root>
  );
}
