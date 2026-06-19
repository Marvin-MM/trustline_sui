'use client';

import { motion } from 'framer-motion';
import { GitBranch, Lock, Award, FileCode, CheckSquare, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  {
    step: '01',
    title: 'Define Relationship & Escrow',
    subtitle: 'Step 1',
    description: 'Establish milestones, conditions, and custom payment rules. AI automatically checks parameters for compliance and anomalies before committing to the chain.',
    icon: GitBranch,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10 border-violet-500/20',
    detail: {
      label: 'On-Chain Agreement',
      value: 'Sui Escrow Locked',
      icon: FileCode,
    },
  },
  {
    step: '02',
    title: 'Verify Deliverables via AI',
    subtitle: 'Step 2',
    description: 'Submit milestones for verification. Gemini-powered agents access encrypted relationship memory stored on Walrus to verify work and check safety bounds.',
    icon: Lock,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    detail: {
      label: 'Agent Auditing',
      value: 'Walrus Hist. Verification',
      icon: CheckSquare,
    },
  },
  {
    step: '03',
    title: 'Unlock Payments & Grow Reputation',
    subtitle: 'Step 3',
    description: 'Escrow unlocks instantly upon milestone completion. Immutable proof of success is minted on Sui, permanently upgrading your profile reputation.',
    icon: Award,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    detail: {
      label: 'Reputation Minted',
      value: 'Attestation +15 Rep',
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
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
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
            BondFlow replaces trust with smart code, AI-verification, and verifiable reputation.
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand/80 transition-colors"
            >
              Read the Detailed User Guide <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>

        {/* Split Layout Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mt-16">
          {/* Left Column: Sticky 3D Walrus mascot holding stablecoin */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 flex flex-col items-center">
            <div className="relative w-full max-w-[360px] aspect-square rounded-2xl border border-border/60 bg-gradient-to-b from-brand/10 via-brand/5 to-transparent p-6 shadow-2xl flex items-center justify-center overflow-hidden group">
              {/* Backlight / Glow effect */}
              <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-violet-600/20 to-brand/20 opacity-40 blur-2xl group-hover:opacity-50 transition-opacity duration-500" />
              
              {/* The Walrus Image */}
              <img
                src="/images/walrus_character.png"
                alt="Walrus Mascot holding USDC stablecoin"
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(139,92,246,0.35)] transition-transform duration-500 group-hover:scale-105"
              />

              {/* Floating UI status badges */}
              <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between items-center bg-background/80 border border-border/60 p-2.5 rounded-xl backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-foreground">Sui USDC Escrow</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Network: Sui Testnet</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/80 font-medium text-center">
              Walrus storage ensures encrypted agreement memory remains immutable.
            </p>
          </div>

          {/* Right Column: Vertical Timeline Steps */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="lg:col-span-7 space-y-8 relative pl-4 lg:pl-8"
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
                  className="group relative flex gap-6 items-start bg-card/25 dark:bg-card/10 border border-border/40 hover:border-brand/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg backdrop-blur"
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
