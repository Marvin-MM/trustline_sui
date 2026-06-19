'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  GitBranch, Star, Brain, Plus, TrendingUp, DollarSign,
  ArrowRight, Shield, Activity, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { relationshipsApi } from '@/lib/api/relationships';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore } from '@/stores/auth.store';
import { RelationshipStatus, MilestoneStatus } from '@bondflow/types';
import { PageHeader } from '@/components/layout/page-header';
import { RelationshipCard } from '@/components/relationships/relationship-card';
import { StatsCardSkeleton, RelationshipCardSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { formatAmount, formatCost, formatRelativeTime } from '@/lib/utils';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import { UsageChart } from '@/components/analytics/usage-chart';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  trend?: { value: number; label: string };
  delay?: number;
}

function StatCard({ icon: Icon, label, value, sub, color, trend, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          <TrendingUp className="h-3.5 w-3.5" />
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </div>
      )}
    </motion.div>
  );
}

interface TenantDashboardClientProps {
  tenantSlug: string;
}

export function TenantDashboardClient({ tenantSlug }: TenantDashboardClientProps) {
  const { tenantId, tenantName } = useAuthStore();

  const { data: relationships, isLoading: relLoading } = useQuery({
    queryKey: queryKeys.relationships.list(tenantId, 1),
    queryFn: () => relationshipsApi.list({ page: 1, limit: 5 }),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: queryKeys.tenants.usage(tenantId ?? '', '30d'),
    queryFn: () => tenantsApi.getUsage(tenantId!, '30d'),
    enabled: !!tenantId,
    staleTime: 120_000,
  });

  const recentRelationships = relationships?.data.slice(0, 5) ?? [];
  const activeCount = recentRelationships.filter((r) => r.status === RelationshipStatus.ACTIVE).length;
  const disputedCount = recentRelationships.filter((r) =>
    r.milestones.some((m) => m.status === MilestoneStatus.DISPUTED)
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={tenantName ?? 'Dashboard'}
        description="Workspace overview and recent activity"
        actions={
          <Link
            href={ROUTES.tenantNewRelationship(tenantSlug)}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Relationship
          </Link>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {relLoading || usageLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={GitBranch}
              label="Relationships"
              value={String(relationships?.pagination.total ?? 0)}
              sub={`${activeCount} active`}
              color="text-blue-500 bg-blue-100 dark:bg-blue-900/30"
              delay={0}
            />
            <StatCard
              icon={DollarSign}
              label="30d Funded"
              value={usage ? formatAmount(usage.relationships.fundedBaseUnits, usage.asset.decimals, usage.asset.symbol) : '—'}
              sub={`${usage?.relationships.releasedMilestones ?? 0}/${usage?.relationships.totalMilestones ?? 0} milestones released`}
              color="text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30"
              delay={0.05}
            />
            <StatCard
              icon={Activity}
              label="AI Cost (30d)"
              value={usage ? formatCost(usage.totalCostUsd) : '—'}
              sub={`${usage?.totalTokens?.toLocaleString() ?? '—'} tokens`}
              color="text-violet-500 bg-violet-100 dark:bg-violet-900/30"
              delay={0.1}
            />
            <StatCard
              icon={disputedCount > 0 ? AlertTriangle : CheckCircle}
              label="Disputes"
              value={String(disputedCount)}
              sub={`${usage?.relationships.disputeRate?.toFixed(1) ?? '—'}% dispute rate`}
              color={
                disputedCount > 0
                  ? 'text-rose-500 bg-rose-100 dark:bg-rose-900/30'
                  : 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30'
              }
              delay={0.15}
            />
          </>
        )}
      </div>

      {/* Usage chart */}
      {!usageLoading && usage && (
        <ComponentErrorBoundary>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Volume (30 days)</h2>
              <Link
                href={ROUTES.tenantAnalytics(tenantSlug)}
                className="flex items-center gap-1 text-sm text-brand hover:underline"
              >
                Full analytics <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <UsageChart data={usage.relationships.volumePerDay} />
          </div>
        </ComponentErrorBoundary>
      )}

      {/* Recent relationships */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Recent Relationships</h2>
          <Link
            href={ROUTES.tenantRelationships(tenantSlug)}
            className="flex items-center gap-1 text-sm text-brand hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {relLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <RelationshipCardSkeleton key={i} />
            ))}
          </div>
        ) : recentRelationships.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No relationships yet"
            description="Create your first payment relationship to start building trust on-chain."
            action={
              <Link
                href={ROUTES.tenantNewRelationship(tenantSlug)}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                <Plus className="h-4 w-4" />
                Create Relationship
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentRelationships.map((rel, i) => (
              <RelationshipCard key={rel.id} relationship={rel} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
