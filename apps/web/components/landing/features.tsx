'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, Star, Zap, Check, ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useStickyScrollProgress } from '@/hooks/use-sticky-scroll-progress';
import {
  NeuralNetworkSVG,
  ShieldScanSVG,
  ConstellationSVG,
  CircuitBoardSVG,
} from '@/components/landing/feature-illustrations';
import { cn } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number) { return Math.max(0, Math.min(1, v)); }
function localP(global: number, start: number, end: number) {
  return clamp((global - start) / (end - start));
}

// ─── Feature metadata ─────────────────────────────────────────────────────────
const FEATURES = [
  {
    id: 'feat-memory',
    band: [0, 0.25] as [number, number],
    Icon: Brain,
    Illustration: NeuralNetworkSVG,
    step: '01',
    title: 'Factual Relationship Memory',
    subtitle: 'Walrus + Indexed Timeline',
    description:
      'Every creation, proof upload, verification, release, dispute, and attestation becomes a factual memory entry stored as an immutable blob on Walrus. The indexed timeline is always in sync — no AI required to access raw history.',
    bullets: ['Walrus blob records', 'Idempotent event indexing', 'Memory works without AI'],
    colors: {
      accent: 'violet',
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      glow: 'bg-violet-600/20',
      badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      check: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      dot: 'bg-violet-500',
    },
  },
  {
    id: 'feat-ai',
    band: [0.25, 0.50] as [number, number],
    Icon: Shield,
    Illustration: ShieldScanSVG,
    step: '02',
    title: 'Auditable AI Verification',
    subtitle: 'Prompted Agent Runs',
    description:
      'AI acts as an explicit verifier: anomaly checks before funding, deliverable scans after upload. Every decision persists the prompt key, model version, confidence score, reasoning trace, and failure state.',
    bullets: ['Non-mutating preflight checks', 'Deliverable scan states', 'Explainable AI activity'],
    colors: {
      accent: 'blue',
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      glow: 'bg-blue-600/20',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      check: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      dot: 'bg-blue-500',
    },
  },
  {
    id: 'feat-rep',
    band: [0.50, 0.75] as [number, number],
    Icon: Star,
    Illustration: ConstellationSVG,
    step: '03',
    title: 'Recipient-Owned Reputation',
    subtitle: 'Sui Completion Attestations',
    description:
      'Every released milestone mints a CompletionAttestation on Sui for the recipient. Reputation proofs aggregate factual totals — volume, rates, dispute ratios — without exposing private relationship details.',
    bullets: ['Automatic attestations', 'Factual volume and rates', 'Portable proof objects'],
    colors: {
      accent: 'amber',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      glow: 'bg-amber-500/20',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      check: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-500',
    },
  },
  {
    id: 'feat-escrow',
    band: [0.75, 1.00] as [number, number],
    Icon: Zap,
    Illustration: CircuitBoardSVG,
    step: '04',
    title: 'Programmable USDC Milestones',
    subtitle: 'Sui Smart Escrow Contracts',
    description:
      'Fund milestone relationships in USDC, then release manually, after verified deliverables, after time gates, or through opt-in auto-release with a built-in challenge window. Every path is permissioned and operator-extensible.',
    bullets: ['Shared Sui objects', 'Payer/operator approval', 'Optional auto-release'],
    colors: {
      accent: 'emerald',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      glow: 'bg-emerald-600/20',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      check: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-500',
    },
  },
] as const;

// ─── Section header outside scroll tunnel ─────────────────────────────────────
function FeaturesHeader() {
  return (
    <div className="relative z-10 mx-auto max-w-3xl py-24 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4"
      >
        Capabilities
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
      >
        Turning Transactions into Trusted Alliances
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-4 text-muted-foreground text-lg"
      >
        Scroll through four programmable pillars that make every payment relationship verifiable, auditable, and trustless.
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex justify-center"
        aria-hidden
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span>Scroll to explore</span>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Sidebar progress rail ─────────────────────────────────────────────────────
function ProgressRail({
  activeIndex,
  progress,
}: {
  activeIndex: number;
  progress: number;
}) {
  return (
    <div className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 flex-col gap-5 z-30">
      {FEATURES.map((f, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <a key={f.id} href={`#${f.id}`} className="group flex items-center gap-3">
            <div
              className={cn(
                'relative h-2.5 w-2.5 rounded-full transition-all duration-500',
                isActive && `${f.colors.dot} scale-125 shadow-[0_0_8px_2px_currentColor]`,
                isDone && `${f.colors.dot} opacity-60`,
                !isActive && !isDone && 'bg-border'
              )}
            >
              {isActive && (
                <span className={cn('absolute inset-0 rounded-full animate-ping opacity-40', f.colors.dot)} />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 opacity-0 group-hover:opacity-100',
                isActive ? `${f.colors.text} opacity-100` : 'text-muted-foreground'
              )}
            >
              {f.step}
            </span>
          </a>
        );
      })}
      {/* Continuous fill line */}
      <div className="absolute left-[4px] top-0 bottom-0 w-px bg-border/40 -z-10">
        <div
          className="w-full bg-gradient-to-b from-violet-500 via-blue-500 to-emerald-500 transition-all duration-100"
          style={{ height: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Features export ──────────────────────────────────────────────────────
export function Features() {
  const { containerRef, progress } = useStickyScrollProgress();

  // Compute which feature is currently dominant
  const activeIndex = useMemo(
    () => Math.min(FEATURES.length - 1, Math.floor(progress * FEATURES.length)),
    [progress]
  );

  const activeFeature = FEATURES[activeIndex]!;

  return (
    <div id="features" className="relative bg-background">
      {/* Section intro — outside the scroll tunnel */}
      <FeaturesHeader />

      {/*
       * SCROLL TUNNEL
       * Outer: 400vh — gives 300vh of scroll space after the viewport is filled.
       * 4 features × (400vh / 4) = 100vh of effective scroll space each.
       * Inner: sticky top-0 h-screen — the viewport-filling stage.
       */}
      <div ref={containerRef} style={{ height: '400vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Ambient background color that bleeds between features */}
          <div
            className={cn(
              'absolute inset-0 transition-all duration-700',
              activeFeature.colors.glow,
              'opacity-30 blur-[160px] pointer-events-none'
            )}
            style={{ transform: 'scale(1.5)' }}
            aria-hidden
          />

          {/* Progress rail (desktop) */}
          <ProgressRail activeIndex={activeIndex} progress={progress} />

          {/* Main split-screen layout */}
          <div className="relative h-full mx-auto max-w-7xl px-6 lg:px-16 flex items-center">
            <div className="grid w-full grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* ── LEFT: Animated SVG Illustration ── */}
              <div className="relative flex items-center justify-center order-2 lg:order-1">
                {/* Glow ring behind illustration */}
                <div
                  className={cn(
                    'absolute w-72 h-72 rounded-full blur-3xl opacity-25 transition-colors duration-700',
                    activeFeature.colors.glow
                  )}
                />
                {/* Illustration card */}
                <div className={cn(
                  'relative w-72 h-72 sm:w-80 sm:h-80 rounded-3xl border bg-card/30 backdrop-blur-md p-6 shadow-2xl transition-all duration-700',
                  activeFeature.colors.border
                )}>
                  {/* Step badge */}
                  <span className={cn(
                    'absolute -top-3.5 left-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                    activeFeature.colors.badge
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', activeFeature.colors.dot)} />
                    Feature {activeFeature.step}
                  </span>

                  {/* Render ALL illustrations, only the active one is visible.
                      All are always mounted so their anime.js timelines persist. */}
                  {FEATURES.map((f, i) => {
                    const lp = localP(progress, f.band[0], f.band[1]);
                    const isVisible = i === activeIndex;
                    return (
                      <div
                        key={f.id}
                        className="absolute inset-6 transition-opacity duration-500"
                        style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none' }}
                      >
                        <f.Illustration progress={lp} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── RIGHT: Text content — AnimatePresence cross-fade ── */}
              <div className="order-1 lg:order-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Subtitle tag */}
                    <span className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-5',
                      activeFeature.colors.badge
                    )}>
                      {activeFeature.subtitle}
                    </span>

                    <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl mb-4">
                      {activeFeature.title}
                    </h2>
                    <p className="text-base sm:text-lg leading-relaxed text-muted-foreground mb-7 max-w-lg">
                      {activeFeature.description}
                    </p>

                    {/* Bullet list */}
                    <ul className="space-y-3 mb-8">
                      {activeFeature.bullets.map((b, i) => (
                        <motion.li
                          key={b}
                          className="flex items-center gap-3 text-sm font-medium text-foreground/80"
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.07, ease: 'easeOut' }}
                        >
                          <span className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                            activeFeature.colors.check
                          )}>
                            <Check className="h-3 w-3" />
                          </span>
                          {b}
                        </motion.li>
                      ))}
                    </ul>

                    <Link
                      href="/auth"
                      className={cn(
                        'group inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80',
                        activeFeature.colors.text
                      )}
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>
                </AnimatePresence>

                {/* Feature mini-nav (mobile and fallback) */}
                <div className="flex gap-2 mt-10 lg:hidden">
                  {FEATURES.map((f, i) => (
                    <a key={f.id} href={`#${f.id}`}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        i === activeIndex ? `w-6 ${f.colors.dot}` : 'w-1.5 bg-border'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-blue-500 via-amber-500 to-emerald-500 transition-all duration-75"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Current step counter */}
          <div className="absolute bottom-6 right-8 text-xs font-mono text-muted-foreground tabular-nums">
            <span className={cn('font-bold', activeFeature.colors.text)}>
              {activeFeature.step}
            </span>
            {' / '}
            {String(FEATURES.length).padStart(2, '0')}
          </div>
        </div>
      </div>
    </div>
  );
}
