'use client';

import { motion } from 'framer-motion';
import { Cpu, Database, Flame, HardDrive, Layout, ShieldAlert } from 'lucide-react';

const TECHS = [
  {
    name: 'Sui Blockchain',
    role: 'Escrow & Identity',
    description:
      'Sui provides sub-second transaction speeds and atomic execution of complex multi-sig milestones. We use Sui smart contracts to secure client deposits, and mint soulbound reputation attestations directly on-chain.',
    icon: Flame,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/10 hover:border-blue-500/30',
    glowColor: 'bg-blue-500/5',
    bullets: ['Sub-second latency', 'Soulbound NFTs', 'Programmable transaction blocks'],
  },
  {
    name: 'Walrus Protocol',
    role: 'Decentralized Storage',
    description:
      'Unlike central databases, BondFlow relationship history and documents are encrypted and uploaded to Walrus. This ensures relationship history is permanent, verifiable, and cannot be deleted or manipulated by any party.',
    icon: HardDrive,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/10 hover:border-purple-500/30',
    glowColor: 'bg-purple-500/5',
    bullets: ['Immutable archives', 'Cost-effective storage node redundancy', 'Verifiable storage attestations'],
  },
  {
    name: 'Gemini AI Integration',
    role: 'Autonomous Auditing',
    description:
      'Gemini-powered agents read the encrypted deliverables and relationship history. They audit milestones, flag security anomalies, and verify submission requirements to ensure contract criteria are fully satisfied.',
    icon: Cpu,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/10 hover:border-amber-500/30',
    glowColor: 'bg-amber-500/5',
    bullets: ['Milestone validation logic', 'Confidence metrics', 'Cryptographic verification logs'],
  },
  {
    name: 'Next.js & React Core',
    role: 'App Framework',
    description:
      'A blazing-fast frontend built with modern React. Next-generation server routing, theme optimization, and responsive design systems ensure a seamless, high-performance workspace environment.',
    icon: Layout,
    color: 'text-slate-400',
    borderColor: 'border-slate-500/10 hover:border-slate-500/30',
    glowColor: 'bg-slate-500/5',
    bullets: ['Dynamic hydration loading', 'Responsive CSS viewport grid', 'Optimal client state caching'],
  },
];

export function TechStack() {
  return (
    <section id="tech-stack" className="py-24 px-6 relative overflow-hidden">
      {/* Visual background helper grids */}
      <div className="absolute inset-0 bg-grid opacity-[0.02] dark:opacity-[0.04]" />

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
            System Architecture
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Built on the Frontiers of Trust
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-muted-foreground text-lg"
          >
            A technology stack chosen for maximum speed, security, and cryptographic verifiability.
          </motion.p>
        </div>

        {/* Tech Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {TECHS.map((tech, i) => {
            const TechIcon = tech.icon;
            return (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`group relative rounded-2xl border ${tech.borderColor} bg-card/40 dark:bg-card/15 p-8 shadow-sm backdrop-blur transition-all duration-300 hover:shadow-md`}
              >
                {/* Accent glow */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-2xl ${tech.glowColor}`} />

                <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
                  {/* Icon */}
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/40 dark:bg-muted/10 border border-border/60 ${tech.color} transition-transform duration-300 group-hover:scale-110`}>
                    <TechIcon className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <div>
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-primary uppercase block mb-1">
                      {tech.role}
                    </span>
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {tech.name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                      {tech.description}
                    </p>

                    {/* Bullet pills */}
                    <div className="flex flex-wrap gap-2">
                      {tech.bullets.map((bullet) => (
                        <span
                          key={bullet}
                          className="inline-flex items-center rounded-md bg-muted/50 dark:bg-muted/20 px-2.5 py-0.5 text-xs font-medium text-foreground/80 border border-border/40"
                        >
                          {bullet}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
