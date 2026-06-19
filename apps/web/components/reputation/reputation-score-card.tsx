'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Award, ExternalLink } from 'lucide-react';
import { formatAmount } from '@/lib/utils';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import type { ReputationProfileDto } from '@/lib/api/reputation';

function AnimatedScore({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + increment, target);
      setCurrent(Math.round(start));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return <span className="tabular-nums">{current}</span>;
}

interface ReputationScoreCardProps {
  profile: ReputationProfileDto;
}

/**
 * ReputationScoreCard — animated score counter, radial arc progress,
 * key stats grid, Sui on-chain proof badge, and Walrus attestation link.
 */
function ReputationScoreCardInner({ profile }: ReputationScoreCardProps) {
  const score = Math.round(profile.factual.completionRateBps / 100);
  const circumference = 2 * Math.PI * 54; // radius 54
  const offset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Reputation Score</h2>
        {profile.proof && (
          <span className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            <Shield className="h-3.5 w-3.5" />
            On-chain proof
          </span>
        )}
      </div>

      {/* Score ring */}
      <div className="flex justify-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" width="160" height="160" viewBox="0 0 160 160">
            {/* Track */}
            <circle cx="80" cy="80" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
            {/* Progress */}
            <circle
              cx="80"
              cy="80"
              r="54"
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="text-center">
            <p className="text-4xl font-bold text-brand">
              <AnimatedScore target={score} />
            </p>
            <p className="text-xs text-muted-foreground">completion rate</p>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed text-center">
        {profile.aiAnalysis?.narrativeDescription ?? 'This score is calculated from released and cancelled milestones recorded on-chain.'}
      </p>

      {/* Strengths & risks */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Strengths
          </p>
          <ul className="space-y-1">
            {(profile.aiAnalysis?.strengthAreas ?? []).slice(0, 3).map((s, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
            <Award className="h-3.5 w-3.5" />
            Risk Areas
          </p>
          <ul className="space-y-1">
            {(profile.aiAnalysis?.riskAreas ?? []).slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Released milestones</p>
          <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">{profile.factual.successfulCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Verified volume</p>
          <p className="mt-0.5 text-sm font-bold text-foreground">
            {formatAmount(profile.factual.totalVolume, profile.asset.decimals, profile.asset.symbol)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Disputed / cancelled</p>
          <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
            {profile.factual.disputedCount} / {profile.factual.cancelledCount}
          </p>
        </div>
        {profile.proof?.walrusAttestationSpaceId && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Walrus Storage</p>
            <a
              href={`https://aggregator.walrus-testnet.walrus.space/v1/${profile.proof.walrusAttestationSpaceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand hover:underline"
            >
              View attestations <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ReputationScoreCard({ profile }: ReputationScoreCardProps) {
  return (
    <ComponentErrorBoundary>
      <ReputationScoreCardInner profile={profile} />
    </ComponentErrorBoundary>
  );
}
