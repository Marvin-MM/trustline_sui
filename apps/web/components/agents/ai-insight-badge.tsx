'use client';

import { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CheckCircle, AlertTriangle, Shield, Tag, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightBadgeProps {
  actionType: string;
  decision: string;
  confidence: number | null;
  reasoningText?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

/**
 * AIInsightBadge — compact badge showing the most recent AI agent decision.
 * - Green checkmark: delivery verification passed
 * - Amber warning: anomaly flagged
 * Pulsing dot on HIGH severity. Popover with agent reasoning text on hover.
 */
export function AIInsightBadge({
  actionType,
  decision,
  confidence,
  reasoningText,
  severity,
}: AIInsightBadgeProps) {
  const isPositive = ['VERIFIED', 'CLEAN'].includes(decision);
  const isHighSeverity = severity === 'HIGH';

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
            isPositive
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
          )}
          aria-label={`AI: ${decision}${confidence !== null ? ` (${confidence}% confidence)` : ''}`}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isPositive ? 'bg-emerald-500' : 'bg-amber-500',
              isHighSeverity && 'animate-pulse-dot'
            )}
          />
          {isPositive ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          <span>{decision}</span>
          {confidence !== null && <span className="opacity-70">·{confidence}%</span>}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 max-w-xs rounded-xl border border-border bg-card p-4 shadow-xl animate-fade-in"
          side="top"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand shrink-0" />
              <p className="text-xs font-semibold text-foreground">AI Agent Insight</p>
            </div>

            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{actionType.replace(/_/g, ' ')}</span>
            </div>

            {reasoningText && (
              <p className="text-xs text-foreground leading-relaxed">{reasoningText}</p>
            )}

            {confidence !== null && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Confidence</span>
                  <span>{confidence}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      confidence >= 80 ? 'bg-emerald-500' : confidence >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
