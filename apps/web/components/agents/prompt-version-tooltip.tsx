'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Shield, CalendarCheck, Tag, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAbsoluteTime } from '@/lib/utils';

interface PromptVersionTooltipProps {
  promptKey: string;
  version: string;
  activatedAt?: string;
  className?: string;
}

/**
 * PromptVersionTooltip — clickable prompt version text in the AI Activity Panel.
 * Shows: prompt key, version number, activation date, trust copy.
 * This is a trust-building feature: "This is the exact AI prompt that produced this decision."
 */
export function PromptVersionTooltip({
  promptKey,
  version,
  activatedAt,
  className,
}: PromptVersionTooltipProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          className={cn(
            'ml-1 font-mono-num text-xs text-muted-foreground underline-offset-2 hover:text-brand hover:underline',
            className
          )}
          aria-label={`Prompt version: ${version}`}
        >
          · v{version}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 max-w-[280px] rounded-xl border border-border bg-card p-4 shadow-xl animate-fade-in"
          side="top"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand shrink-0" />
              <p className="text-xs font-semibold text-foreground">AI Prompt Governance</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Prompt Key</p>
                  <p className="font-mono-num text-xs font-medium text-foreground">{promptKey || '—'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-mono-num text-xs font-medium text-foreground">v{version}</p>
                </div>
              </div>

              {activatedAt && (
                <div className="flex items-start gap-2">
                  <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Activated</p>
                    <p className="text-xs text-foreground">{formatAbsoluteTime(activatedAt)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
              <p className="text-xs text-brand leading-relaxed">
                This is the exact AI prompt that produced this decision.
              </p>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
