'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Brain, Shield, Star, Zap, AlertCircle } from 'lucide-react';
import { cn, formatRelativeTime, formatAbsoluteTime } from '@/lib/utils';
import type { MemoryEntryDto } from '@/lib/api/memory';
import { buildWalrusBlobUrl } from '@/lib/walrus';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

const HEALTH_COLORS = {
  healthy: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30',
  needs_attention: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30',
  at_risk: 'text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-900/30',
};

const HEALTH_ICONS = {
  healthy: Star,
  needs_attention: AlertCircle,
  at_risk: Zap,
};

function MemoryCard({ entry }: { entry: MemoryEntryDto }) {
  const HealthIcon = HEALTH_ICONS[entry.relationshipHealth];

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 space-y-3',
      entry.isCritical && 'border-rose-300 dark:border-rose-800'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <TooltipPrimitive.Provider>
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <span className="text-xs text-muted-foreground cursor-default">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content className="z-50 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-lg">
              {formatAbsoluteTime(entry.createdAt)}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>

        <div className="flex items-center gap-2">
          {entry.isCritical && (
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse-dot" aria-label="Critical event" />
          )}
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', HEALTH_COLORS[entry.relationshipHealth])}>
            <HealthIcon className="h-3 w-3" />
            {entry.relationshipHealth.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-foreground leading-relaxed">{entry.summary}</p>

      {/* Key insights */}
      {entry.keyInsights.length > 0 && (
        <div className="space-y-1">
          {entry.keyInsights.slice(0, 3).map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Walrus storage status */}
      <div className="flex items-center gap-1.5">
        <Brain className="h-3 w-3 text-muted-foreground" />
        {entry.walrusBlobId ? (
          <a
            href={buildWalrusBlobUrl(entry.walrusBlobId)}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-mono-num text-xs text-brand hover:underline"
          >
            Stored on Walrus
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            {entry.storageStatus === 'FAILED' ? 'Factual entry saved; Walrus retry pending' : 'Walrus indexing pending'}
          </span>
        )}
      </div>
    </div>
  );
}

interface MemoryTimelineProps {
  entries: MemoryEntryDto[];
}

/**
 * MemoryTimeline — virtual scrolled timeline of memory entries.
 * Stagger animation on initial load. Framer-motion entry per card.
 * Uses @tanstack/react-virtual for performance when entries exceed 50.
 */
export function MemoryTimeline({ entries }: MemoryTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-16rem)] overflow-y-auto pr-2"
      style={{ contain: 'strict' }}
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          if (!entry) return null;

          return (
            <motion.div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(virtualRow.index * 0.03, 0.3) }}
            >
              <div className="pb-3">
                <MemoryCard entry={entry} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
