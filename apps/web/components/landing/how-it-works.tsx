'use client';

import { motion } from 'framer-motion';
import { GitBranch, Lock, Award, FileCode, CheckSquare, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { EASE_OUT } from '@/lib/animation/motion';

const STEPS = [
  {
    step: '01',
    title: 'Create and Fund the Relationship',
    subtitle: 'Step 1',
    description: 'Choose a workspace, enter the recipient wallet, define USDC milestones, and review a non-mutating AI anomaly check before signing the Sui funding transaction.',
    icon: GitBranch,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10 border-violet-500/20',
    detail: {
      label: 'On-Chain Relationship',
      value: 'USDC Locked on Sui',
      icon: FileCode,
    },
  },
  {
    step: '02',
    title: 'Upload Proof and Verify',
    subtitle: 'Step 2',
    description: 'Recipients upload deliverables to Walrus and sign a submit transaction. The backend verifier records AI evidence on-chain with a scoped capability.',
    icon: Lock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    detail: {
      label: 'Verification',
      value: 'Walrus Proof Checked',
      icon: CheckSquare,
    },
  },
  {
    step: '03',
    title: 'Approve, Release, and Build Reputation',
    subtitle: 'Step 3',
    description: 'Payers or approved workspace operators release verified or manual milestones by default. Auto-release is opt-in and waits through a challenge window. Every release mints an attestation.',
    icon: Award,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    detail: {
      label: 'Reputation',
      value: 'Completion Attestation',
      icon: Sparkles,
    },
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 px-6 overflow-hidden">
      {/* Background design elements */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2 opacity-60" />

      <div className="mx-auto max-w-7xl relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4"
          >
            Workflow Lifecycle
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            From Escrow to Trust in Three Phases
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-muted-foreground text-lg"
          >
            TrustLine replaces trust with smart code, AI-verification, and verifiable reputation.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6"
          >
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
            >
              Read the Detailed User Guide <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>

        {/* Split Layout Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 items-start mt-16">
          {/* Left Column: Sticky Walrus mascot — full height, bleeds right into timeline */}
          <div className="hidden lg:flex lg:col-span-5 lg:sticky lg:top-24 flex-col items-end justify-start self-start" style={{ height: 'calc(3 * 14rem + 4rem)' }}>
            <div className="relative w-full h-full overflow-visible group">
              {/* Ambient glow behind the figure */}
              <div className="pointer-events-none absolute inset-0 -right-16 bg-gradient-to-tr from-violet-600/15 to-brand/15 blur-3xl rounded-full opacity-60 group-hover:opacity-80 transition-opacity duration-700" />

              {/* Walrus image — fills column, bleeds 72px into the timeline column */}
              <img
                src="/images/walrus_character1.png"
                alt="Walrus Mascot holding USDC stablecoin"
                className="relative z-10 w-full h-full object-contain object-bottom drop-shadow-[0_16px_40px_rgba(139,92,246,0.30)] transition-transform duration-700 group-hover:scale-[1.03] translate-x-10 lg:translate-x-16"
              />

              {/* Floating status badge — bottom left of the image */}
              <div className="absolute bottom-6 left-2 z-20 flex items-center gap-2 bg-background/80 border border-border/60 px-3 py-2 rounded-xl backdrop-blur-md shadow-md">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-foreground whitespace-nowrap">Sui USDC Escrow</span>
                <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">· Testnet</span>
              </div>
            </div>
          </div>

          {/* Right Column: Vertical Timeline Steps */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="lg:col-span-7 space-y-8 relative pl-4 lg:pl-8 z-10"
          >
            {/* Vertical connector line */}
            <div className="absolute left-[28px] lg:left-[44px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-brand/80 via-blue-500/80 to-emerald-500/80" />

            {STEPS.map((step, idx) => {
              const IconComponent = step.icon;
              const DetailIcon = step.detail.icon;
              return (
                <motion.div
                  key={step.step}
                  variants={cardVariants}
                  className="group relative flex gap-6 items-start bg-card/25 dark:bg-card/10 border border-border/40 hover:border-brand/30 hover:bg-card/35 dark:hover:bg-card/15 rounded-2xl p-6 transition-all duration-300 backdrop-blur"
                >
                  {/* Step icon wrapper serving as timeline node */}
                  <div className={`relative z-10 flex h-10 w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl border ${step.bgColor}`}>
                    <IconComponent className={`h-5 w-5 lg:h-6 lg:w-6 ${step.iconColor}`} />
                    <span className="absolute -top-2.5 -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 border border-brand/20 text-[10px] font-bold text-brand">
                      {step.step}
                    </span>
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono-num text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                      {step.subtitle}
                    </span>
                    <h3 className="text-lg lg:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {step.description}
                    </p>

                    {/* Interactive Inner Feature Pill */}
                    <div className="inline-flex items-center gap-3 bg-muted/40 border border-border/40 p-2.5 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-muted-foreground border border-border/40">
                        <DetailIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-left">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block font-semibold leading-none mb-0.5">
                          {step.detail.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground leading-none">
                          {step.detail.value}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
