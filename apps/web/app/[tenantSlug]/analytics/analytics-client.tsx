'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, DollarSign, Cpu, HardDrive, Activity } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { queryKeys } from '@/lib/query-keys';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/layout/page-header';
import { StatsCardSkeleton } from '@/components/ui/skeletons';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import { formatAmount, formatCost, formatBytes } from '@/lib/utils';
import { cn } from '@/lib/utils';

type DateRange = '7d' | '30d' | '90d';
const RANGES: { label: string; value: DateRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

const CHART_COLORS = ['hsl(263,70%,50%)', 'hsl(199,89%,48%)', 'hsl(160,84%,39%)', 'hsl(45,93%,47%)'];

function chartAmount(baseUnits: string, decimals: number): number {
  const divisor = 10 ** decimals;
  return Number(baseUnits) / divisor;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono-num text-foreground">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export function AnalyticsPageClient({ tenantSlug }: { tenantSlug: string }) {
  const { tenantId } = useAuthStore();
  const [range, setRange] = useState<DateRange>('30d');

  const { data: usage, isLoading } = useQuery({
    queryKey: queryKeys.tenants.usage(tenantId ?? '', range),
    queryFn: () => tenantsApi.getUsage(tenantId!, range),
    enabled: !!tenantId,
    staleTime: 120_000,
  });

  const volumeData = (usage?.relationships.volumePerDay ?? []).map((d) => ({
    date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
    funded: chartAmount(d.fundedBaseUnits, usage?.asset.decimals ?? 6),
    released: chartAmount(d.releasedBaseUnits, usage?.asset.decimals ?? 6),
  }));

  const aiCostData = (usage?.aiCostPerDay ?? []).map((d) => ({
    date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
    cost: d.costUsd,
    tokens: d.tokens,
  }));

  const gasData = (usage?.gasPerDay ?? []).map((d) => ({
    date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
    txCount: d.txCount,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Usage metrics for your workspace over the last ${range}`}
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  range === r.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            {[
              { icon: TrendingUp, label: 'Funded Volume', value: formatAmount(usage?.relationships.fundedBaseUnits ?? '0', usage?.asset.decimals ?? 6, usage?.asset.symbol ?? 'USDC'), sub: `${usage?.relationships.totalRelationships ?? 0} relationships`, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
              { icon: DollarSign, label: 'Released / Locked', value: formatAmount(usage?.relationships.releasedBaseUnits ?? '0', usage?.asset.decimals ?? 6, usage?.asset.symbol ?? 'USDC'), sub: `${formatAmount(usage?.relationships.lockedBaseUnits ?? '0', usage?.asset.decimals ?? 6, usage?.asset.symbol ?? 'USDC')} still locked`, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' },
              { icon: Activity, label: 'Completion Rate', value: `${usage?.relationships.milestoneCompletionRate?.toFixed(1) ?? '—'}%`, sub: `${usage?.relationships.releasedMilestones ?? 0} of ${usage?.relationships.totalMilestones ?? 0} milestones`, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' },
              { icon: Cpu, label: 'AI Cost', value: formatCost(usage?.totalCostUsd ?? 0), sub: `${(usage?.totalTokens ?? 0).toLocaleString()} tokens`, color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Charts grid */}
      {!isLoading && usage && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Volume chart */}
          <ComponentErrorBoundary>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">USDC Volume</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="funded" name="Funded (USDC)" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#aGrad)" />
                    <Area type="monotone" dataKey="released" name="Released (USDC)" stroke={CHART_COLORS[2]} strokeWidth={2} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ComponentErrorBoundary>

          {/* AI cost chart */}
          <ComponentErrorBoundary>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">AI Cost per Day</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aiCostData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cost" name="Cost ($)" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ComponentErrorBoundary>

          {/* Tx count chart */}
          <ComponentErrorBoundary>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Transactions per Day</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gasData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="txCount" name="Transactions" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ComponentErrorBoundary>

          {/* Walrus storage growth */}
          <ComponentErrorBoundary>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Walrus Storage Growth</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={(usage.walrusStorage.growthPerDay ?? []).map((d) => ({
                      date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
                      bytes: d.bytes / 1024,
                    }))}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[3]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[3]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}KB`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="bytes" name="Storage (KB)" stroke={CHART_COLORS[3]} strokeWidth={2} fill="url(#sGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ComponentErrorBoundary>
        </div>
      )}

      {!isLoading && usage && (
        <div className="grid gap-3 md:grid-cols-2">
          {usage.totalTokens === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              AI cost is zero because no AI agent ran in this period. Manual approvals do not create AI usage.
            </div>
          )}
          {usage.walrusStorage.totalBytes === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              Walrus usage is zero until a deliverable, dispute artifact, or factual memory entry is stored.
            </div>
          )}
        </div>
      )}

      {/* Most expensive agent */}
      {usage?.mostExpensiveAgentType && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-violet-500" />
            <span className="text-sm text-muted-foreground">Highest cost agent type:</span>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              {usage.mostExpensiveAgentType.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
