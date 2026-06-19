'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield, Activity, MessageSquare, Server, Loader2,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { featureFlagsApi } from '@/lib/api/feature-flags';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { FEATURE_FLAG_KEYS } from '@bondflow/types';
import { apiClient } from '@/lib/api-client';
import { formatRelativeTime, formatCost } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ADMIN_TABS = ['Overview', 'Prompt Management', 'Queue Monitor', 'Transactions'] as const;
type AdminTab = typeof ADMIN_TABS[number];

// Prompt management — lists all active prompt versions
interface PromptVersion {
  id?: string;
  key: string;
  version: string;
  model: string;
  promptType: string;
  description: string;
  activatedAt: string;
  invocationCount: number;
  avgCostUsd: number;
  successRate: number;
}

async function fetchPrompts(): Promise<PromptVersion[]> {
  const res = await apiClient.get<{ data: Array<PromptVersion & { promptKey?: string; isActive?: boolean; content?: string }> } | Array<PromptVersion & { promptKey?: string; isActive?: boolean; content?: string }>>('/admin/prompts');
  const rows = Array.isArray(res.data) ? res.data : res.data.data;
  return rows.map((prompt) => ({
    id: prompt.id,
    key: prompt.key ?? prompt.promptKey ?? 'unknown',
    version: prompt.version,
    model: prompt.model ?? 'gemini',
    promptType: prompt.promptType ?? 'agent',
    description: prompt.description ?? (prompt.content ? `${prompt.content.slice(0, 90)}...` : 'Prompt version'),
    activatedAt: prompt.activatedAt ?? new Date().toISOString(),
    invocationCount: prompt.invocationCount ?? 0,
    avgCostUsd: prompt.avgCostUsd ?? 0,
    successRate: prompt.successRate ?? 0,
  }));
}

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface AdminTransaction {
  id: string;
  digest: string;
  txType: string;
  status: string;
  submittedBy: string;
  gasUsed: string | null;
  submittedAt: string;
}

async function fetchQueues(): Promise<QueueStats[]> {
  const res = await apiClient.get<Record<string, Omit<QueueStats, 'name'>>>('/admin/queues');
  return Object.entries(res.data).map(([name, counts]) => ({
    name,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  }));
}

async function fetchTransactions(): Promise<AdminTransaction[]> {
  const res = await apiClient.get<{ data: AdminTransaction[] } | AdminTransaction[]>('/admin/transactions');
  return Array.isArray(res.data) ? res.data : res.data.data;
}

function OverviewCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function AdminPageClient({ tenantSlug, initialTab = 'Overview' }: { tenantSlug: string; initialTab?: AdminTab }) {
  const { tenantId, isPlatformAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const canAdmin = isPlatformAdmin;

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ['admin', 'prompts'],
    queryFn: fetchPrompts,
    enabled: activeTab === 'Prompt Management',
    staleTime: 30_000,
  });

  const { data: queues, isLoading: queuesLoading } = useQuery({
    queryKey: ['admin', 'queues'],
    queryFn: fetchQueues,
    enabled: activeTab === 'Queue Monitor',
    staleTime: 10_000,
    refetchInterval: activeTab === 'Queue Monitor' ? 10_000 : false,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['admin', 'transactions'],
    queryFn: fetchTransactions,
    enabled: activeTab === 'Transactions',
    staleTime: 10_000,
    refetchInterval: activeTab === 'Transactions' ? 10_000 : false,
  });

  if (!canAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-base font-semibold text-foreground">Admin access required</p>
        <p className="text-sm text-muted-foreground mt-1">
          You must sign in with the configured platform admin wallet to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="System health, prompt governance, and queue monitoring"
        icon={Shield}
      />

      {/* Tab nav */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <OverviewCard icon={Server} label="API Status" value="Healthy" color="text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" />
          <OverviewCard icon={Activity} label="Queue Jobs" value={queues ? String(queues.reduce((s, q) => s + q.active, 0)) : '—'} color="text-blue-500 bg-blue-100 dark:bg-blue-900/30" />
          <OverviewCard icon={MessageSquare} label="Active Prompts" value={prompts ? String(prompts.length) : '—'} color="text-violet-500 bg-violet-100 dark:bg-violet-900/30" />
          <OverviewCard icon={XCircle} label="Failed Jobs" value={queues ? String(queues.reduce((s, q) => s + q.failed, 0)) : '—'} color="text-rose-500 bg-rose-100 dark:bg-rose-900/30" />
        </div>
      )}

      {/* Prompt Management */}
      {activeTab === 'Prompt Management' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Active Prompt Versions</h2>
            <p className="text-xs text-muted-foreground">Live governance — these are the exact prompts running in production.</p>
          </div>

          {promptsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(prompts ?? []).map((p, i) => (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono-num text-sm font-semibold text-foreground">{p.key}</span>
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">v{p.version}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p.model}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-xs text-muted-foreground">{p.invocationCount.toLocaleString()} calls</p>
                      <p className="text-xs text-muted-foreground">avg {formatCost(p.avgCostUsd)}</p>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{p.successRate}% success</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Active since {formatRelativeTime(p.activatedAt)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue Monitor */}
      {activeTab === 'Queue Monitor' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">BullMQ Queues</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              Auto-refresh every 10s
            </span>
          </div>

          {queuesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(queues ?? []).map((queue) => {
                const hasIssues = queue.failed > 0;
                return (
                  <div
                    key={queue.name}
                    className={cn(
                      'rounded-xl border bg-card p-4',
                      hasIssues ? 'border-rose-300 dark:border-rose-800' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {hasIssues ? (
                          <XCircle className="h-4 w-4 text-rose-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                        <span className="font-mono-num text-sm font-semibold text-foreground">{queue.name}</span>
                      </div>
                      {queue.active > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {queue.active} running
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {[
                        { label: 'Waiting', value: queue.waiting, color: 'text-amber-600' },
                        { label: 'Active', value: queue.active, color: 'text-blue-600' },
                        { label: 'Done', value: queue.completed, color: 'text-emerald-600' },
                        { label: 'Failed', value: queue.failed, color: 'text-rose-600' },
                        { label: 'Delayed', value: queue.delayed, color: 'text-zinc-500' },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className={cn('font-mono-num text-sm font-bold tabular-nums', stat.value > 0 ? stat.color : 'text-muted-foreground')}>
                            {stat.value}
                          </p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Submitted Transactions</h2>
            <span className="text-xs text-muted-foreground">Auto-refresh every 10s</span>
          </div>

          {transactionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(transactions ?? []).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono-num text-xs text-foreground truncate">{tx.digest}</p>
                    <p className="text-xs text-muted-foreground">{tx.txType.replace(/_/g, ' ')} · {formatRelativeTime(tx.submittedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={tx.status} size="sm" />
                    <span className="font-mono-num text-xs text-muted-foreground">{tx.gasUsed ?? '—'} gas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
