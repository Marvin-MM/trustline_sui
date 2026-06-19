'use client';

import { motion } from 'framer-motion';
import { Brain, Shield, Star, Zap, Check, Lock, History, Search } from 'lucide-react';

const FEATURES = [
  {
    icon: Brain,
    title: 'Encrypted Memory',
    subtitle: 'Walrus Protocol Storage',
    description:
      'Every interaction builds a permanent, end-to-end encrypted relationship memory on Walrus. AI agents safely read history to check previous contexts and confirm deliverable milestones.',
    bullets: ['AES-256 local encryption', 'Decentralised Walrus storage', 'Zero-knowledge access logs'],
    color: 'text-violet-500',
    borderColor: 'group-hover:border-violet-500/30',
    glowColor: 'bg-violet-500/10',
    iconBg: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  },
  {
    icon: Shield,
    title: 'AI Agent Verification',
    subtitle: 'Gemini 2.5 Pro Engine',
    description:
      'Gemini-powered models verify file integrity, match specifications, detect duplicate payments, and screen for anomalies. Every run logs model version and verification hash.',
    bullets: ['Automated milestone audit', 'Plagiarism & similarity check', 'Multi-agent double check'],
    color: 'text-blue-500',
    borderColor: 'group-hover:border-blue-500/30',
    glowColor: 'bg-blue-500/10',
    iconBg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  {
    icon: Star,
    title: 'Verifiable Reputation',
    subtitle: 'Sui Attestation System',
    description:
      'Successful relationships issue soulbound attestation certificates on the Sui blockchain. Build a decentralized trust score that clients verify instantly without third parties.',
    bullets: ['Soulbound NFT credentials', 'Tamper-proof transaction log', 'Public/Private API access'],
    color: 'text-amber-500',
    borderColor: 'group-hover:border-amber-500/30',
    glowColor: 'bg-amber-500/10',
    iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  {
    icon: Zap,
    title: 'Programmable Conditions',
    subtitle: 'Sui Smart Escrow Contracts',
    description:
      'Define payment rules atomically on-chain. Escrow funds unlock automatically via manual signature, time-based countdowns, or AI agent cryptographic verify signatures.',
    bullets: ['Atomic escrow swaps', 'Multi-sig authorization', 'Programmable timeout fallback'],
    color: 'text-emerald-500',
    borderColor: 'group-hover:border-emerald-500/30',
    glowColor: 'bg-emerald-500/10',
    iconBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 25 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export function Features() {
  return (
    <section id="features" className="py-24 px-6 bg-muted/10 dark:bg-muted/5 relative overflow-hidden">
      {/* Background design accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-brand/5 blur-3xl" />

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
            BondFlow replaces the friction of traditional contracts with programmable safeguards.
          </motion.p>
        </div>

        {/* Feature Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                variants={cardVariants}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 dark:bg-card/25 p-6 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 backdrop-blur"
              >
                {/* Glow Backdrop */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl ${feat.glowColor}`} />

                {/* Top Content */}
                <div>
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110 ${feat.iconBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">
                    {feat.subtitle}
                  </span>
                  <h3 className="text-lg font-bold text-foreground mb-3 transition-colors group-hover:text-primary">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {feat.description}
                  </p>
                </div>

                {/* Bullets List */}
                <ul className="space-y-2.5 border-t border-border/60 pt-5">
                  {feat.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2 text-xs text-foreground/80">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
