'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Github, Twitter } from 'lucide-react';
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Features } from '@/components/landing/features';
import { TechStack } from '@/components/landing/tech-stack';
import { FAQ } from '@/components/landing/faq';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background [overflow-x:clip] font-sans">
      {/* Sticky Premium Navbar */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* How it Works Flow */}
      <HowItWorks />

      {/* Key Features Grid */}
      <Features />

      {/* Tech Stack Details */}
      <TechStack />

      {/* Advanced CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Glow behind the CTA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-brand/10 blur-[100px] pointer-events-none" />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/5 via-violet-500/5 to-indigo-500/5 p-12 md:p-16 backdrop-blur"
          >
            {/* Corner Decorative Lights */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-brand/25 to-transparent blur-xl rounded-tl-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-indigo-500/25 to-transparent blur-xl rounded-br-3xl pointer-events-none" />

            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl leading-tight">
              Ready to Upgrade Your Payment Relationships?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
              Connect your Sui wallet and create your first AI-verified milestone escrow agreement in under two minutes.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link
                href="/auth"
                className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/95 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Connect Wallet
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/auth"
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-border bg-card/50 px-8 py-4 text-base font-semibold text-foreground transition-all hover:bg-muted hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Launch Platform
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* High-fidelity Footer */}
      <footer className="border-t border-border/60 bg-muted/10 dark:bg-muted/5 py-12 px-6 rounded-t-3xl">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Column 1: Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center mb-4 w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <Image 
                  src="/logos/trustline-logo.png" 
                  alt="Trustline Logo" 
                  width={140} 
                  height={32} 
                  className="object-contain dark:hidden" 
                />
                <Image 
                  src="/logos/trustline-logo-dark.png" 
                  alt="Trustline Logo" 
                  width={140} 
                  height={32} 
                  className="object-contain hidden dark:block" 
                />
              </Link>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                A programmable payment relationship protocol on Sui. AI-verified milestones, encrypted memory, and verifiable reputation for modern collaborations.
              </p>
            </div>

            {/* Column 2: Platform Links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Platform</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    Launch App
                  </Link>
                </li>
                <li>
                  <a href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#tech-stack" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    Tech Stack
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Community & Docs */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Community</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    <Github className="h-3.5 w-3.5" /> GitHub
                  </a>
                </li>
                <li>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                    <Twitter className="h-3.5 w-3.5" /> Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Sui Testnet Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Walrus Storage Live
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Gemini Agent Online
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} BondFlow Protocol. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
