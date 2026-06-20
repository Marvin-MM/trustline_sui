'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  ArrowRight, 
  Shield, 
  Brain, 
  Star, 
  Zap, 
  Fingerprint, 
  Key, 
  CheckCircle2, 
  Loader2, 
  Activity, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { useAuthStore } from '@/stores/auth.store';
import { useWalletAuth } from '@/hooks/use-wallet-auth';
import { WalletConnectButton } from '@/components/blockchain/wallet-connect-button';

const BENEFITS = [
  { 
    icon: Shield, 
    title: 'Sign-in with Sui (SIWS)',
    desc: 'Instant cryptographic authorization without vulnerable passwords.' 
  },
  { 
    icon: Brain, 
    title: 'Zero-Knowledge Audits',
    desc: 'Milestones validated by Gemini and stored securely on Walrus.' 
  },
  { 
    icon: Star, 
    title: 'Verifiable Reputation',
    desc: 'Grow a permanent, tamper-proof reputation attestation score.' 
  },
];

const WALLETS = [
  { name: 'Sui Wallet', color: 'bg-blue-500' },
  { name: 'Suiet', color: 'bg-indigo-500' },
  { name: 'Slush', color: 'bg-emerald-500' },
  { name: 'Nightly', color: 'bg-amber-500' },
  { name: 'Phantom', color: 'bg-purple-500' }
];

export function AuthPageClient() {
  const { isAuthenticated, isAuthenticating, walletAddress } = useAuthStore();
  const { signIn } = useWalletAuth();
  const dAppKit = useDAppKit();
  const [authStep, setAuthStep] = useState(0);

  // Animate mock attestation checks on the left panel
  useEffect(() => {
    const timer = setInterval(() => {
      setAuthStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden font-sans">
      {/* Background ambient lighting for the whole auth page */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Left panel — Branding & Mockups (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-[hsl(263_70%_5%)] border-r border-border/20">
        {/* Decorative Grid & glowing orbs */}
        <div className="absolute inset-0 bg-grid opacity-[0.03]" />
        <div className="pointer-events-none absolute -bottom-48 -right-48 h-[500px] w-[500px] rounded-full bg-brand/10 blur-[130px]" />
        <div className="pointer-events-none absolute -top-48 -left-48 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[130px]" />

        {/* Top Header Logo */}
        <Link href="/" className="group relative z-10 flex items-center">
          <Image 
            src="/logos/trustline-logo.png" 
            alt="Trustline Logo" 
            width={140} 
            height={32} 
            className="object-contain" 
            priority
          />
        </Link>

        {/* Middle: Graphics & Explainer */}
        <div className="relative z-10 my-auto max-w-lg space-y-12">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h1 className="text-4xl font-extrabold text-white leading-tight">
              Sovereign Identity<br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                verified instantly.
              </span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Connect your cryptographic key to manage escrows, execute smart milestones, and check workspace memories.
            </p>
          </motion.div>

          {/* Interactive Secure Authorization Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-md"
          >
            {/* Corner glows */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/10 blur-xl pointer-events-none rounded-tr-2xl" />

            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-brand">
                  <Fingerprint className="h-3.5 w-3.5 text-brand" />
                </div>
                <span className="text-[10px] font-semibold text-white/80 font-mono-num uppercase tracking-wider">
                  Cryptographic Attestation
                </span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-400 border border-violet-500/20">
                <Activity className="h-2.5 w-2.5 animate-pulse" /> Node Live
              </span>
            </div>

            {/* Check stages */}
            <div className="space-y-2.5 text-[11px] font-medium text-white/70">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-violet-400" />
                  <span>Generate unique session challenge</span>
                </div>
                {authStep >= 1 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <span>Sign challenge in wallet sandbox</span>
                </div>
                {authStep >= 2 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : authStep === 1 ? (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Attest signature on Sui ledger</span>
                </div>
                {authStep >= 3 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : authStep === 2 ? (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                )}
              </div>
            </div>
          </motion.div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 gap-5">
            {BENEFITS.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/80">
                  <benefit.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{benefit.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{benefit.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Network and Status footer */}
        <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-white/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
          </span>
          Sui Testnet Environment Connected
        </div>
      </div>

      {/* Right panel — Authenticator Container */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo header (shows only on small screens) */}
          <Link href="/" className="flex items-center mb-8 lg:hidden">
            <Image 
              src="/logos/trustline-logo.png" 
              alt="Trustline Logo" 
              width={140} 
              height={32} 
              className="object-contain" 
              priority
            />
          </Link>

          {/* Authenticator Card */}
          <div className="rounded-3xl border border-border/80 bg-card/60 dark:bg-card/20 p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Subtle light reflections */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-2xl rounded-full pointer-events-none" />

            {/* Auth icon */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-6 border border-brand/20 shadow-sm"
            >
              <Wallet className="h-6 w-6" />
            </motion.div>

            <h2 className="text-2xl font-bold text-foreground">Connect Cryptographic Wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Use Sign-In with Sui (SIWS) to confirm your identity. Secure, key-based sandbox login with zero gas requirements.
            </p>

            <div className="mt-8 space-y-5">
              <AnimatePresence mode="wait">
                {isAuthenticated ? (
                  <motion.div
                    key="authenticated-loader"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Animated Completion UI */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col items-center text-center">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-3 border border-emerald-500/20">
                        <span className="absolute animate-ping h-8 w-8 rounded-full bg-emerald-500/10 opacity-75" />
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground">Identity Verified</h4>
                      <p className="text-xs text-muted-foreground mt-1 break-all px-2 font-mono">
                        {walletAddress?.slice(0, 18)}...{walletAddress?.slice(-10)}
                      </p>
                    </div>

                    {/* Staggered progress status list */}
                    <div className="space-y-2.5 text-xs text-muted-foreground bg-muted/20 dark:bg-muted/10 p-4 rounded-xl border border-border/60">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        <span>Initializing secure memory index...</span>
                      </div>
                      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-brand rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: '80%' }}
                          transition={{ duration: 2, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Retrieving attestation certificates from Sui testnet...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="login-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    {/* Wallet Connect trigger wrapper */}
                    <div className="space-y-3">
                      <WalletConnectButton
                        className="w-full py-4 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl"
                        onConnect={(address) =>
                          signIn(address, async (message) => {
                            const result = await dAppKit.signPersonalMessage({
                              message: new TextEncoder().encode(message),
                            });
                            return result.signature;
                          })
                        }
                      />
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center gap-4 py-2">
                      <div className="flex-1 border-t border-border/80" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Supported Wallets
                      </span>
                      <div className="flex-1 border-t border-border/80" />
                    </div>

                    {/* Wallet Chip Badges grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {WALLETS.map((w) => (
                        <div
                          key={w.name}
                          className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10 px-3.5 py-2.5 transition-all hover:bg-muted/40 hover:-translate-y-0.5"
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${w.color} shrink-0`} />
                          <span className="text-xs font-semibold text-foreground/80">{w.name}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Security disclaimer */}
            <p className="mt-8 text-center text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-5">
              By connecting your wallet, you agree to sign a authentication challenge. No transaction fees are generated. Your private keys remain fully sandboxed and are never shared.
            </p>
          </div>

          {/* Back to homepage link */}
          <p className="mt-6 text-center">
            <Link 
              href="/" 
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-1" />
              Back to home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
