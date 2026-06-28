'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from 'ai/react';
import { X, Sparkles, Send, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface MemoryInsightPanelProps {
  relationshipId: string;
  health: 'healthy' | 'needs_attention' | 'at_risk' | null;
  open: boolean;
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

const MAX_TEXTAREA_HEIGHT_PX = 120;

/**
 * MemoryInsightPanel — full-height chat drawer over the relationship's memory.
 * Streams real Groq output via the Vercel AI SDK `useChat` hook (see the route handler
 * at app/api/memory/insights/stream/[relationshipId]).
 *
 * Deliberately covers the full viewport height (rather than docking under the app's
 * TopBar) so it doesn't depend on the TopBar's height, which varies with sidebar state —
 * matching that exactly was fragile and caused the alignment gap/clipping seen before.
 */
export function MemoryInsightPanel({ relationshipId, health, open, onClose }: MemoryInsightPanelProps) {
  const { accessToken, tenantId } = useAuthStore();
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: `/api/memory/insights/stream/${relationshipId}`,
    // Scopes the chat session to this relationship — switching relationships starts fresh.
    id: relationshipId,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    },
  });

  const healthConfig = health ? HEALTH_CONFIG[health] : null;
  const HealthIcon = healthConfig?.icon ?? Minus;

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep the conversation pinned to the latest message/streamed token, like any chat UI.
  useEffect(() => {
    if (open) scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, messages]);

  // Focus the input the moment the drawer opens, and lock background scroll while it's up.
  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  // Escape closes the drawer, matching standard overlay/drawer behavior.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleSuggestion = (question: string) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  };

  const submitIfPossible = () => {
    if (isLoading || !input.trim()) return;
    formRef.current?.requestSubmit();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — click to close, also dims the rest of the app while chatting */}
          <motion.div
            key="memory-insight-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            key="memory-insight-drawer"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Memory insights chat"
            className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[100] flex h-[100dvh] w-full sm:h-[600px] sm:w-[400px] sm:max-h-[calc(100vh-3rem)] flex-col overflow-hidden sm:rounded-2xl border-l sm:border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground leading-none">TrustLine AI</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Memory Insights</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {healthConfig && (
                  <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider', healthConfig.bg, healthConfig.color)}>
                    <HealthIcon className="h-3 w-3" />
                    {healthConfig.label}
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  aria-label="Close insights panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Ephemeral session note */}
            <p className="shrink-0 border-b border-border bg-muted/20 px-5 py-2 text-xs text-muted-foreground">
              This conversation isn&apos;t saved — it stays while you&apos;re on this page and clears when you leave.
            </p>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">How can I help?</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Ask anything about this relationship&apos;s memory.</p>
                  <div className="space-y-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSuggestion(q)}
                        className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-brand/30 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                      >
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand/70" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex w-full',
                      isUser ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                        isUser
                          ? 'rounded-tr-sm bg-brand text-white'
                          : 'rounded-tl-sm border border-border bg-muted/40 text-foreground'
                      )}
                    >
                      <p className="whitespace-pre-wrap">
                        {m.content}
                        {isLoading && m.id === messages[messages.length - 1]?.id && !isUser && (
                          <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-current opacity-70 align-middle" aria-hidden="true" />
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}

              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex w-full justify-start">
                  <div className="flex max-w-[85%] items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-muted/40 px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
                  </div>
                </div>
              )}

              <div ref={scrollAnchorRef} />
            </div>

            {/* Input */}
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-border bg-card p-4"
            >
              <div className="relative flex items-end gap-2 rounded-xl border border-border bg-muted/20 pl-3 pr-2 py-2 focus-within:border-brand/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-brand/50 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { handleInputChange(e); autoGrow(e.target); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitIfPossible();
                    }
                  }}
                  placeholder="Ask a question..."
                  rows={1}
                  className="flex-1 max-h-[120px] resize-none bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </button>
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] text-muted-foreground">AI can make mistakes. Consider verifying important info.</p>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
