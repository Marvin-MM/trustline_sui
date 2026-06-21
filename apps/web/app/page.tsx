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
import { Footer } from '@/components/landing/footer';
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

      <Footer />
    </div>
  );
}
