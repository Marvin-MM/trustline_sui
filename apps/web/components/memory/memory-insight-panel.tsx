'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from 'ai/react';
import { X, Sparkles, Send, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface MemoryInsightPanelProps {
  relationshipId: string;
  health: 'healthy' | 'needs_attention' | 'at_risk' | null;
  onClose: () => void;
}

const HEALTH_CONFIG = {
  healthy: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Healthy' },
  needs_attention: { icon: Minus, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Needs Attention' },
  at_risk: { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'At Risk' },
};

const SUGGESTED_QUESTIONS = [
  'What are the main risk factors?',
  'Is this relationship on track?',
  'Any anomalies detected recently?',
  'What patterns are emerging?',
];

/**
 * MemoryInsightPanel — slides in from the right.
 * Streaming AI insights via Vercel AI SDK useChat hook.
 * Shows: health badge, trajectory arrow, streaming insight text, follow-up suggestions.
 */
export function MemoryInsightPanel({ relationshipId, health, onClose }: MemoryInsightPanelProps) {
  const { accessToken, tenantId } = useAuthStore();
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: `/api/memory/insights/stream/${relationshipId}`,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    },
  });

  const healthConfig = health ? HEALTH_CONFIG[health] : null;
  const HealthIcon = healthConfig?.icon ?? Minus;

  const handleSuggestion = (question: string) => {
    setInput(question);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-96 border-l border-border bg-card shadow-2xl z-30 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-foreground">Memory Insights</span>
          </div>
          <div className="flex items-center gap-2">
            {healthConfig && (
              <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', healthConfig.bg, healthConfig.color)}>
                <HealthIcon className="h-3.5 w-3.5" />
                {healthConfig.label}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close insights panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="mx-auto h-8 w-8 text-brand/50 mb-3" />
              <p className="text-sm text-muted-foreground">Ask anything about this relationship&apos;s memory.</p>
              <div className="mt-4 space-y-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'rounded-xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'ml-4 bg-brand/10 text-foreground'
                  : 'mr-4 border border-border bg-muted/30 text-foreground'
              )}
            >
              {m.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                  <span className="text-xs font-medium text-brand">AI Insight</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}

          {isLoading && (
            <div className="mr-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-brand animate-pulse" />
                <span className="text-xs text-muted-foreground">Analyzing memories...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-4 flex gap-2"
        >
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about this relationship..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
