'use client';

import type { ElementType } from 'react';
import { Brain, GitBranch, Cpu, Bell, Zap } from 'lucide-react';
import { cn, formatRelativeTime, formatGas } from '@/lib/utils';
import { useAuditLog, type AuditEvent } from '@/hooks/use-audit-log';

const EVENT_CONFIGS: Record<string, { icon: ElementType; color: string; label: (e: AuditEvent) => string }> = {
  audit: {
    icon: GitBranch,
    color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    label: (e) => e.summary,
  },
  blockchain: {
    icon: GitBranch,
    color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    label: (e) => e.summary,
  },
  ai_action: {
    icon: Cpu,
    color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30',
    label: (e) => e.summary,
  },
  notification: {
    icon: Bell,
    color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
    label: (e) => e.summary,
  },
  transaction: {
    icon: Zap,
    color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
    label: (e) => e.summary,
  },
};

interface AuditTimelineProps {
  relationshipId: string;
}

/**
 * AuditTimeline — unified chronological timeline of all audit events.
 * Event types: blockchain events, AI actions, notifications, transactions.
 * Uses vertical line + dots. Infinite scroll via useInfiniteQuery.
 */
export function AuditTimeline({ relationshipId }: AuditTimelineProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAuditLog(relationshipId);

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="w-0.5 flex-1 bg-muted mt-2" />
            </div>
            <div className="flex-1 pb-6 space-y-2">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Brain className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No audit events yet</p>
        <p className="text-xs text-muted-foreground mt-1">Events will appear here as actions are taken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, i) => {
        const config = EVENT_CONFIGS[entry.type];
        if (!config) return null;
        const Icon = config.icon;
        const isLast = i === entries.length - 1;
        const digest = String(entry.metadata['transactionDigest'] ?? entry.metadata['digest'] ?? '');
        const gasUsed = entry.metadata['gasUsed'];
        const hasGasUsed = gasUsed !== null && gasUsed !== undefined && gasUsed !== '';

        return (
          <div key={entry.id} className="flex gap-4">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.color)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {config.label(entry)}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>

              {/* Event-specific details */}
              {entry.type === 'blockchain' && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono-num truncate">
                  {digest}
                  {hasGasUsed && (
                    <span className="ml-2">· Gas: {formatGas(BigInt(String(gasUsed)))}</span>
                  )}
                </p>
              )}

              {entry.type === 'ai_action' && entry.metadata['confidence'] !== null && entry.metadata['confidence'] !== undefined && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confidence: {String(entry.metadata['confidence'])}% · {String(entry.metadata['durationMs'] ?? '—')}ms
                </p>
              )}

              {entry.type === 'transaction' && hasGasUsed && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono-num">
                  Gas: {formatGas(BigInt(String(gasUsed)))} · {digest.slice(0, 16)}...
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
