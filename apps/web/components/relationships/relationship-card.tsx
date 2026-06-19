'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Calendar, MemoryStick } from 'lucide-react';
import { cn, formatRelativeTime, formatAmount } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { AddressDisplay } from '@/components/blockchain/address-display';
import type { RelationshipDto } from '@/lib/api/relationships';
import { ROUTES } from '@/constants/routes';
import { useTenant } from '@/hooks/use-tenant';
import { MilestoneStatus, RelationshipActorRole, RelationshipStatus } from '@bondflow/types';

interface RelationshipCardProps {
  relationship: RelationshipDto;
  index?: number;
  href?: string;
}

/**
 * RelationshipCard — summary card with framer-motion entrance, violet hover glow,
 * status badge, milestone progress bar, and Walrus memory space link.
 */
export function RelationshipCard({ relationship, index = 0, href }: RelationshipCardProps) {
  const { tenantSlug } = useTenant();

  const releasedMilestones = relationship.milestones.filter(
    (m) => m.status === MilestoneStatus.RELEASED
  ).length;
  const totalMilestones = relationship.milestones.length;
  const progressPct = totalMilestones > 0 ? (releasedMilestones / totalMilestones) * 100 : 0;

  const totalAmount = relationship.totalAmount;
  const releasedAmount = relationship.releasedAmount;
  const isIndexed = relationship.status !== RelationshipStatus.PENDING_ON_CHAIN
    && relationship.status !== RelationshipStatus.FAILED_ON_CHAIN;
  const counterpartyLabel = relationship.actorRole === RelationshipActorRole.RECIPIENT ? 'From' : 'To';
  const counterpartyWallet = relationship.actorRole === RelationshipActorRole.RECIPIENT
    ? relationship.payerWallet
    : relationship.recipientWallet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="group"
    >
      <Link
        href={href ?? (tenantSlug
            ? ROUTES.tenantRelationshipDetail(tenantSlug, relationship.id)
            : ROUTES.personalRelationshipDetail(relationship.id))}
        className={cn(
          'block rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-[0_0_0_1px_hsl(var(--brand)/0.2),0_4px_24px_hsl(var(--brand)/0.08)]',
          !isIndexed && 'opacity-90 bg-muted/20'
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {relationship.memo || 'Untitled relationship'}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{counterpartyLabel}</span>
              <AddressDisplay
                address={counterpartyWallet}
                truncate
                copyable={false}
                link={false}
                size="sm"
              />
            </div>
          </div>
          <StatusBadge status={relationship.status} size="sm" />
        </div>

        {/* Milestone progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {releasedMilestones}/{totalMilestones} milestones
            </span>
            <span className="font-mono-num text-xs text-muted-foreground">
              {formatAmount(releasedAmount, relationship.asset.decimals, relationship.asset.symbol)} / {formatAmount(totalAmount, relationship.asset.decimals, relationship.asset.symbol)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatRelativeTime(relationship.createdAt)}</span>
            </div>
            {relationship.walrusMemorySpaceId && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MemoryStick className="h-3.5 w-3.5" />
                <span>Memory</span>
              </div>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-brand" />
        </div>
        {!isIndexed && (
          <p className="mt-4 rounded-lg bg-brand/5 px-3 py-2 text-xs font-medium text-brand/80 border border-brand/20">
            On-chain setup incomplete. Click to view status or complete setup.
          </p>
        )}
        {relationship.legacyReadOnly && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200/50 dark:border-amber-900/50">
            Legacy v1 history. This relationship is view-only.
          </p>
        )}
        {!relationship.legacyReadOnly && relationship.lifecycleGuidance && (
          <p className="mt-4 rounded-lg bg-brand/5 px-3 py-2 text-xs font-medium text-muted-foreground border border-brand/10">
            <span className="font-semibold text-foreground">Next: </span>
            {relationship.lifecycleGuidance}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
