'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing/navbar';
import { AlertCircle, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('getting-started');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px' }
    );

    const sections = document.querySelectorAll('h1[id], section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <div className="pt-32 pb-24 px-6 mx-auto max-w-7xl flex flex-col md:flex-row gap-12 lg:gap-16 items-start">
        {/* Sticky Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0 md:sticky md:top-28 hidden md:block">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-4">
            On this page
          </div>
          <nav className="space-y-1.5 border-l-2 border-border/60 relative">
            <a 
              href="#getting-started" 
              className={`block pl-4 py-1 text-sm font-medium transition-colors ${
                activeSection === 'getting-started' 
                  ? 'text-brand border-l-2 border-brand -ml-[2px]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Getting Started
            </a>
            <a 
              href="#auth-onboarding" 
              className={`block pl-4 py-1 text-sm font-medium transition-colors ${
                activeSection === 'auth-onboarding' 
                  ? 'text-brand border-l-2 border-brand -ml-[2px]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              1. Authentication & Onboarding
            </a>
            <a 
              href="#navigating-core" 
              className={`block pl-4 py-1 text-sm font-medium transition-colors ${
                activeSection === 'navigating-core' 
                  ? 'text-brand border-l-2 border-brand -ml-[2px]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              2. Navigating the Core App
            </a>
            <a 
              href="#executing-core" 
              className={`block pl-4 py-1 text-sm font-medium transition-colors ${
                activeSection === 'executing-core' 
                  ? 'text-brand border-l-2 border-brand -ml-[2px]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              3. Executing Core Functions
            </a>
            <a 
              href="#best-practices" 
              className={`block pl-4 py-1 text-sm font-medium transition-colors ${
                activeSection === 'best-practices' 
                  ? 'text-brand border-l-2 border-brand -ml-[2px]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              4. Operational Checklist
            </a>
          </nav>

          <div className="mt-8 pl-4">
            <Link
              href="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-3xl">
          {/* Breadcrumb / Category Tag */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <span className="text-brand bg-brand/10 px-2 py-0.5 rounded-md">User Journey</span>
            <ChevronRight className="h-4 w-4" />
            <span>Documentation</span>
          </div>

          <h1 id="getting-started" className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mb-8 leading-tight">
            Getting Started with BondFlow
          </h1>

          {/* Admonition Box */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 mb-10 flex items-start gap-4 shadow-sm">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-500 mb-1">Important Note</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Before you begin, ensure you have an active internet connection, the Sui Wallet browser extension installed, and a small amount of SUI token for transaction gas fees. The platform operates on the Sui Testnet.
              </p>
            </div>
          </div>

          {/* High-Level Overview & Diagram */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-foreground mb-3">High-Level Overview</h3>
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              BondFlow is a programmable payment relationship protocol that completely modernizes escrow and freelance engagements. Instead of blindly trusting a counterparty, you lock funds securely on the Sui blockchain, set clear milestones, and allow AI agents to objectively verify deliverables via the Walrus storage network before releasing payments.
            </p>

            <div className="bg-card border border-border/60 rounded-xl p-5 overflow-x-auto shadow-sm">
              <pre className="text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed">
{`[Wallet Login]
      │
      ▼
[Dashboard & Metrics] ──► [Create Relationship]
                                │
                                ▼
                       [Define Milestones]
                                │
                                ▼
                      [Fund Escrow on Sui]
                                │
                                ▼
                      [AI Verification & Release]`}
              </pre>
            </div>
          </div>

          <hr className="border-border/60 mb-12" />

          {/* Section 1 */}
          <section id="auth-onboarding" className="mb-14 scroll-mt-28">
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Authentication & Onboarding</h2>
            <p className="text-muted-foreground mb-4">
              BondFlow eliminates traditional passwords by utilizing Sign-In With Sui (SIWS). This guarantees that your wallet address acts as your unique, cryptographically secure identity.
            </p>
            
            <div className="bg-muted/30 rounded-xl border border-border/50 p-6 mb-6">
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground font-medium">
                <li>Click <code className="bg-card text-brand px-1.5 py-0.5 rounded border border-border/50">Launch App</code> on the homepage.</li>
                <li>When prompted, select your preferred Sui wallet (e.g., Sui Wallet, Ethos, or Surf).</li>
                <li>Review the signature request and click <code className="bg-card text-brand px-1.5 py-0.5 rounded border border-border/50">Approve</code> to verify your wallet ownership.</li>
              </ol>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Best Practice:</strong> Always ensure the signature request clearly displays "Sign in to BondFlow" to prevent phishing.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Constraint:</strong> You cannot proceed without a supported web3 wallet extension active in your browser.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section id="navigating-core" className="mb-14 scroll-mt-28">
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Navigating to the Core App</h2>
            <p className="text-muted-foreground mb-4">
              After successful authentication, you are immediately routed to your primary <code className="bg-muted px-1.5 py-0.5 rounded text-sm text-foreground">/dashboard</code>. 
            </p>
            <p className="text-muted-foreground mb-4">
              The dashboard acts as your mission control. On the left, a persistent sidebar provides access to your <strong>Relationships</strong>, <strong>Reputation</strong>, and <strong>Settings</strong>. The main view displays high-level metrics: Total Value Locked (TVL), Active Agreements, and Recent Activity.
            </p>
            <p className="text-muted-foreground">
              If you have pending items requiring your attention (like a deliverable awaiting review), they will be highlighted at the top of your active relationship list.
            </p>
          </section>

          {/* Section 3 */}
          <section id="executing-core" className="mb-14 scroll-mt-28">
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Executing Core App Functions</h2>
            <p className="text-muted-foreground mb-6">
              The absolute main purpose of BondFlow is to create and execute a programmable <strong>Payment Relationship</strong>. This replaces standard freelance contracts or trusting someone to send funds after work is completed.
            </p>

            <h4 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">The Happy Path</h4>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h5 className="font-semibold text-foreground">Initiate the Relationship</h5>
                  <p className="text-sm text-muted-foreground mt-1">Navigate to <strong>Relationships</strong> and click <code className="bg-muted px-1.5 py-0.5 rounded">Create Relationship</code>. Enter the contractor's wallet address.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h5 className="font-semibold text-foreground">Define Milestones</h5>
                  <p className="text-sm text-muted-foreground mt-1">Add specific milestones with monetary values. Set conditions like <code className="bg-muted px-1.5 py-0.5 rounded">Deliverable Upload</code> or <code className="bg-muted px-1.5 py-0.5 rounded">Time-Gated</code>.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h5 className="font-semibold text-foreground">Fund Escrow on Sui</h5>
                  <p className="text-sm text-muted-foreground mt-1">Click <code className="bg-muted px-1.5 py-0.5 rounded">Complete On-Chain Setup</code>. Your wallet will prompt you to deposit the total SUI required into the smart contract escrow.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h5 className="font-semibold text-foreground">Verify & Release</h5>
                  <p className="text-sm text-muted-foreground mt-1">Once the contractor uploads their work to Walrus, our Gemini AI verifies it against your initial requirements and automatically unlocks the funds.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="best-practices" className="mb-8 scroll-mt-28">
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Operational Checklist & Best Practices</h2>
            <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Verify Counterparty Addresses:</strong> Double-check the recipient's Sui wallet address before finalizing an escrow. Blockchain transactions are immutable and cannot be reversed.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Write Clear Conditions:</strong> Because the AI agent validates deliverables against your stated conditions, be explicitly clear in your milestone descriptions about what constitutes "done".</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Monitor Gas Balances:</strong> Always keep a small reserve of SUI in your wallet to cover network gas fees for releasing funds or raising disputes.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Do Not Abandon Drafts:</strong> If you cancel a wallet signature during setup, the relationship will be marked as "Setup Incomplete." Click it in your dashboard to resume and properly fund the escrow.</p>
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
