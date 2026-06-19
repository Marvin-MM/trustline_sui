'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Cpu,
  Shield,
  Star,
  Search,
  Ban,
  Brain,
  Lightbulb,
  ScanSearch,
  ChartNoAxesCombined,
  ScrollText,
} from 'lucide-react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { formatRelativeTime, formatCost, cn } from '@/lib/utils';
import type { AgentActionDto } from '@/lib/api/relationships';
import { StatusBadge } from '@/components/ui/status-badge';
import { PromptVersionTooltip } from './prompt-version-tooltip';

const ACTION_TYPE_LABELS: Record<string, string> = {
  ANOMALY_DETECTED: 'Anomaly Detection',
  PATTERN_RECOGNIZED: 'Pattern Recognition',
  DELIVERABLE_VERIFIED: 'Delivery Verification',
  DUPLICATE_PREVENTED: 'Duplicate Prevention',
  CONDITION_REGISTERED: 'Condition Registered',
  MILESTONE_RELEASED: 'Milestone Released',
  MEMORY_WRITTEN: 'Memory Written',
  MEMORY_INSIGHT_GENERATED: 'Insight Generated',
  CONTENT_SCANNED: 'Content Scan',
  REPUTATION_BUILT: 'Reputation Built',
  ATTESTATION_MINTED: 'Attestation Minted',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  ANOMALY_DETECTED: Shield,
  PATTERN_RECOGNIZED: Star,
  DELIVERABLE_VERIFIED: Search,
  DUPLICATE_PREVENTED: Ban,
  MEMORY_WRITTEN: Brain,
  MEMORY_INSIGHT_GENERATED: Lightbulb,
  CONTENT_SCANNED: ScanSearch,
  REPUTATION_BUILT: ChartNoAxesCombined,
  ATTESTATION_MINTED: ScrollText,
};

function getDecisionStatus(action: AgentActionDto): string {
  if (!action.success) return 'FAILED';
  if ('verified' in action.result) return action.result['verified'] ? 'VERIFIED' : 'REJECTED';
  if ('isAnomaly' in action.result) return action.result['isAnomaly'] ? 'FLAGGED' : 'CLEAN';
  if ('isSafe' in action.result) return action.result['isSafe'] ? 'CLEAN' : 'FLAGGED';
  if ('isDuplicate' in action.result) return action.result['isDuplicate'] ? 'FLAGGED' : 'CLEAN';
  return 'UNKNOWN';
}

interface AgentActionCardProps {
  action: AgentActionDto;
}

function AgentActionCard({ action }: AgentActionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const decision = getDecisionStatus(action);
  const label = ACTION_TYPE_LABELS[action.actionType] ?? action.actionType;
  const Icon = ACTION_ICONS[action.actionType] ?? Cpu;
  const hasKnownPromptVersion = Boolean(action.promptVersion && action.promptVersion !== 'unknown' && action.promptVersion !== 'vunknown');

  return (
    <CollapsiblePrimitive.Root open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <StatusBadge status={decision} size="sm" />
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {action.model && (
                <span className="font-mono-num">
                  {action.model}
                  {hasKnownPromptVersion && action.promptVersion && (
                    <PromptVersionTooltip
                      promptKey={action.promptKey ?? ''}
                      version={action.promptVersion}
                    />
                  )}
                  {!hasKnownPromptVersion && action.promptKey && (
                    <span className="ml-1 text-muted-foreground">· {action.promptKey}</span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {action.durationMs}ms
              </span>
              {action.estimatedCostUsd && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatCost(parseFloat(action.estimatedCostUsd))}
                </span>
              )}
              <span>{formatRelativeTime(action.createdAt)}</span>
            </div>
          </div>

          <CollapsiblePrimitive.Trigger asChild>
            <button className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsiblePrimitive.Trigger>
        </div>

        {/* Confidence bar */}
        {action.confidence !== null && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Confidence</span>
              <span>{action.confidence}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  action.confidence >= 80 ? 'bg-emerald-500' : action.confidence >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                )}
                style={{ width: `${action.confidence}%` }}
              />
            </div>
          </div>
        )}

        {!action.success && action.errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-medium text-destructive">AI run failed</p>
            <p className="mt-1 text-xs text-destructive/80">{action.errorMessage}</p>
          </div>
        )}

        {/* Expandable JSON */}
        <CollapsiblePrimitive.Content>
          <div className="mt-2 space-y-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Payload</p>
              <pre className="text-xs font-mono-num text-foreground overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Result</p>
              <pre className="text-xs font-mono-num text-foreground overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(action.result, null, 2)}
              </pre>
            </div>
          </div>
        </CollapsiblePrimitive.Content>
      </div>
    </CollapsiblePrimitive.Root>
  );
}

interface AIActivityPanelProps {
  actions: AgentActionDto[];
  totalCostUsd?: number;
  totalInvocations?: number;
  successRate?: number;
  mostUsedModel?: string;
}

/**
 * AIActivityPanel — full agent action timeline with model, prompt version,
 * cost, duration, confidence, and expandable payload/result JSON.
 * Shown as a tab on the relationship detail page.
 */
export function AIActivityPanel({
  actions,
  totalCostUsd = 0,
  totalInvocations = 0,
  successRate = 0,
  mostUsedModel,
}: AIActivityPanelProps) {
  return (
    <div className="space-y-4">
      {/* Aggregate stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Invocations', value: String(totalInvocations) },
          { label: 'Total Cost', value: formatCost(totalCostUsd) },
          { label: 'Success Rate', value: `${successRate}%` },
          { label: 'Top Model', value: mostUsedModel ?? '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground font-mono-num">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Action timeline */}
      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Cpu className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No AI activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              This is expected for manual approvals. Only actual anomaly checks, verification, scans, or AI insights appear here.
            </p>
          </div>
        ) : (
          actions.map((action) => (
            <AgentActionCard key={action.id} action={action} />
          ))
        )}
      </div>
    </div>
  );
}
