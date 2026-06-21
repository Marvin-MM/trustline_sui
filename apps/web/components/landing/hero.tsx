'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, Shield, Zap, CheckCircle, Database, Award, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export function Hero() {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated }))
  );
  const isReadyAuthenticated = mounted && isAuthenticated;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Cycle through states of the interactive mockup
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-16">
      {/* Background Gradients & Effects */}
      <div className="absolute inset-0 bg-grid opacity-[0.03] dark:opacity-[0.05]" />
      
      {/* Ambient background glows - Toned down for minimalism */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={
            prefersReducedMotion
              ? { opacity: 0.05 }
              : { scale: [1, 1.05, 1], opacity: [0.03, 0.08, 0.03], x: [0, 20, 0], y: [0, -15, 0] }
          }
          transition={prefersReducedMotion ? { duration: 0.5 } : { duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute h-[500px] w-[500px] rounded-full bg-brand/10 blur-[130px]"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? { opacity: 0.05 }
              : { scale: [1.05, 1, 1.05], opacity: [0.03, 0.08, 0.03], x: [0, -20, 0], y: [0, 15, 0] }
          }
          transition={prefersReducedMotion ? { duration: 0.5 } : { duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[140px]"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Side: Typography and CTAs */}
        <div className="lg:col-span-7 flex flex-col text-left lg:pr-6">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 self-start inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 dark:bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
            </span>
            Built on Sui · Powered by Walrus & Gemini AI
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl xl:text-7xl leading-[1.1]"
          >
            Payments are{' '}
            <span className="text-foreground">
              relationships
            </span>
            ,<br />not transfers.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed"
          >
            TrustLine turns USDC payments into programmable relationships: fund milestones on Sui,
            store deliverables and factual memory on Walrus, verify evidence with AI, and mint portable proof of completed work.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center gap-4"
          >
            <Link
              href={isReadyAuthenticated ? '/dashboard' : '/auth'}
              className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/95 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isReadyAuthenticated ? 'Go to Dashboard' : 'Get Started'}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur px-8 py-4 text-base font-medium text-foreground transition-all hover:bg-muted hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View on GitHub
            </a>
          </motion.div>

          {/* Trust points */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-12 flex items-center gap-6 flex-wrap"
          >
            {[
              { label: 'Sui Network', color: 'bg-blue-500' },
              { label: 'Walrus Protocol', color: 'bg-violet-500' },
              { label: 'Gemini Agent Checks', color: 'bg-amber-500' },
              { label: 'Verifiable Reputation', color: 'bg-emerald-500' },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                {badge.label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Side: Interactive Mockup Simulation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-5 relative w-full"
        >
          {/* Glass Card Container - Minimalist Solid Surface */}
          <div className="relative rounded-2xl border border-border bg-card p-7 shadow-sm">
            {/* Header of Simulated Card */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground font-mono-num">AGREEMENT #BF-4089</h3>
                  <p className="text-[10px] text-muted-foreground">Sui USDC Relationship Active</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                ACTIVE
              </span>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-muted/30 p-3.5 rounded-lg border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-0.5">Client</span>
                <span className="font-semibold text-foreground">Aura Ventures</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-0.5">Contractor</span>
                <span className="font-semibold text-foreground">Satoshi Lab</span>
              </div>
            </div>

            {/* Interactive Timeline Stages */}
            <div className="space-y-4 mb-5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                Milestones & Verification Flow
              </span>

              {/* Milestone 1 */}
              <div className="relative rounded-xl border border-border bg-background p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand mt-0.5">
                      1
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Upload first logo draft</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Milestone funding: 200 USDC</p>
                    </div>
                  </div>
                  
                  {/* Action/State Pill */}
                  <div>
                    {step === 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Escrow Locked
                      </span>
                    )}
                    {step === 1 && (
                      <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-500 animate-pulse">
                        <Brain className="h-3 w-3 animate-bounce" /> AI Checking...
                      </span>
                    )}
                    {(step === 2 || step === 3) && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                        <CheckCircle className="h-3 w-3" /> AI Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Verification Detail Drawer */}
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="checking"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 border-t border-dashed border-border/80 pt-3"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-indigo-500 font-medium">
                        <Sparkles className="h-3.5 w-3.5 animate-spin" />
                        <span>AI verifier checking Walrus proof...</span>
                      </div>
                      <div className="mt-1 bg-muted/30 p-2 rounded text-[9px] font-mono text-muted-foreground break-all">
                        Reading blob 03e7...753 from Walrus decentralized storage...
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="verified"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 border-t border-dashed border-border/80 pt-3"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-semibold">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Milestone Verified</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Confidence 94% · evidence hash recorded. Payer can approve release on Sui.
                      </p>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="transferred"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 border-t border-dashed border-border/80 pt-3"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Released to Satoshi Lab
                        </span>
                        <span className="font-mono text-muted-foreground">Tx: 0x5a2...f3b</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Milestone 2 */}
              <div className="relative rounded-xl border border-border bg-muted/20 p-4 opacity-70 grayscale-[0.2]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground mt-0.5">
                      2
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground">Final brand package</h4>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Milestone funding: 300 USDC</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Locked
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Section: Real-time Stats update in simulation */}
            <div className="border-t border-border/60 pt-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Database className="h-3.5 w-3.5 text-violet-500" />
                <span>Walrus Memory</span>
              </div>
              <div className="flex items-center gap-1 text-foreground font-semibold">
                <Award className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Completion rate: </span>
                <span className="font-mono-num">
                  {step === 3 ? (
                    <motion.span
                      initial={{ scale: 1.2, color: '#f59e0b' }}
                      animate={{ scale: 1, color: 'currentColor' }}
                      className="text-amber-500"
                    >
                      1 attestation
                    </motion.span>
                  ) : (
                    'pending'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation/Flow Indicators below the card */}
          <div className="mt-4 flex justify-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  step === i ? 'w-6 bg-brand' : 'w-1.5 bg-border hover:bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Floating Scroll Indicator */}
      <button
        type="button"
        className="absolute bottom-8 flex flex-col items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
        onClick={() => {
          const element = document.getElementById('how-it-works');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        <motion.div
          animate={prefersReducedMotion ? { y: 0 } : { y: [0, 6, 0] }}
          transition={prefersReducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="h-8 w-0.5 rounded-full bg-brand/60"
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Scroll to Explore</span>
      </button>
    </section>
  );
}
