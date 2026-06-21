'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Navbar } from '@/components/landing/navbar';
import { AlertCircle, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { FlowDiagram } from '@/components/guide/flow-diagram';
import { useAuthStore } from '@/stores/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';

const SECTIONS = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'auth-onboarding', title: '1. Authentication & Onboarding' },
  { id: 'navigating-core', title: '2. Navigating the Core App' },
  { id: 'executing-core', title: '3. Executing Core Functions' },
  { id: 'best-practices', title: '4. Operational Checklist & Best Practices' },
];

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  
  const { isAuthenticated } = useAuthStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated }))
  );

  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleScroll = () => {
      const headings = Array.from(document.querySelectorAll('h1[id], section[id]'));
      let currentActiveId = 'getting-started';
      
      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        // 140px threshold accounts for sticky navbar + spacing
        if (rect.top <= 150) {
          currentActiveId = heading.id;
        }
      }
      
      // Force last section if scrolled to the absolute bottom
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (scrollPosition >= documentHeight - 10 && headings.length > 0) {
        const lastHeading = headings[headings.length - 1];
        if (lastHeading) {
          currentActiveId = lastHeading.id;
        }
      }
      
      setActiveSection(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeTitle = SECTIONS.find((s) => s.id === activeSection)?.title || 'Guide';

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* Mobile Top Progress Bar */}
      <div className="md:hidden sticky top-[72px] z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-5 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-full">
          {/* Circular Progress */}
          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-muted/30"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
              />
              <motion.path
                className="text-primary"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ pathLength: scrollYProgress }}
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground truncate w-[85%] leading-tight">
            {activeTitle}
          </span>
        </div>
      </div>
      
      <div className="pt-12 md:pt-32 pb-24 px-6 mx-auto max-w-7xl flex flex-col md:flex-row gap-12 lg:gap-16 items-start">
        {/* Sticky Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0 md:sticky md:top-28 hidden md:block">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-4">
            On this page
          </div>
          <nav className="space-y-1.5 border-l-2 border-border/60 relative">
            {SECTIONS.map((section) => (
              <a 
                key={section.id}
                href={`#${section.id}`} 
                className={`block pl-4 py-1 text-sm font-medium transition-all ${
                  activeSection === section.id 
                    ? 'text-primary border-l-2 border-primary -ml-[2px] bg-primary/5' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {section.title}
              </a>
            ))}
          </nav>

          <div className="mt-8 pl-4 pr-2">
            <Link
              href={isAuthenticated ? '/dashboard' : '/auth'}
              className="flex justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
            >
              <HoverBorderGradient
                containerClassName="rounded-full w-full"
                as="span"
                className="flex w-full items-center justify-center gap-2 bg-primary text-white font-semibold py-2 px-5 hover:bg-primary/90"
              >
                {isAuthenticated ? 'Dashboard' : 'Launch App'}
                <ArrowRight className="h-4 w-4" />
              </HoverBorderGradient>
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
                Before you begin, install a supported Sui wallet and keep a small SUI balance for gas. Payers also need USDC for milestone funding. The current deployment operates on Sui Testnet.
              </p>
            </div>
          </div>

          {/* High-Level Overview & Diagram */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-foreground mb-3">High-Level Overview</h3>
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              BondFlow is a programmable USDC payment relationship platform. A payer creates milestone terms, funds a shared Sui relationship object, recipients submit proof to Walrus, AI verifies deliverable evidence, and authorized payers or operators release funds. Every release mints an on-chain completion attestation for the recipient.
            </p>

            <FlowDiagram />
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
              After successful authentication, you land in the personal dashboard by default unless you are returning to a page you were using before sign-out.
            </p>
            <p className="text-muted-foreground mb-4">
              The personal area is wallet-owned. It shows relationships assigned to your wallet as a recipient, pending workspace invitations, and your recipient reputation. You do not need to belong to the payer&apos;s workspace to see relationships where your wallet is the recipient.
            </p>
            <p className="text-muted-foreground">
              Workspaces are where teams create and manage outgoing relationships, analytics, members, settings, and payer/operator actions. Workspace operators can approve, dispute, or cancel only when their role and on-chain capability allow it.
            </p>
          </section>

          {/* Section 3 */}
          <section id="executing-core" className="mb-14 scroll-mt-28">
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Executing Core App Functions</h2>
            <p className="text-muted-foreground mb-6">
              The main purpose of BondFlow is to create and execute a programmable <strong>Payment Relationship</strong>: clear terms, locked USDC, durable evidence, explicit approval, and portable recipient reputation.
            </p>

            <h4 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">The Happy Path</h4>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h5 className="font-semibold text-foreground">Initiate the Relationship</h5>
                  <p className="text-sm text-muted-foreground mt-1">Open a workspace, go to <strong>Relationships</strong>, and click <code className="bg-muted px-1.5 py-0.5 rounded">Create Relationship</code>. Enter the recipient&apos;s Sui wallet and a clear memo.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h5 className="font-semibold text-foreground">Define Milestones</h5>
                  <p className="text-sm text-muted-foreground mt-1">Add human USDC amounts such as <code className="bg-muted px-1.5 py-0.5 rounded">200.00</code>. Choose manual approval, deliverable proof, or time-gated release, and write requirements that a human and verifier can understand.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h5 className="font-semibold text-foreground">Review AI Preflight and Fund</h5>
                  <p className="text-sm text-muted-foreground mt-1">The anomaly check is advisory and non-mutating. Then review the PTB preview and sign once to lock the total USDC in the BondFlow Sui contract.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h5 className="font-semibold text-foreground">Submit, Verify, Approve, or Dispute</h5>
                  <p className="text-sm text-muted-foreground mt-1">For deliverable milestones, the recipient uploads proof to Walrus and signs a submit transaction. The backend verifier marks it verified or rejected. By default the payer or operator approves release; auto-release is opt-in and waits through its challenge window.</p>
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
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Verify Counterparty Addresses:</strong> Double-check the recipient&apos;s Sui wallet address before funding. Blockchain transactions are immutable and cannot be reversed casually.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Write Clear Conditions:</strong> Deliverable verification compares proof against your stated requirement. Avoid vague text like &quot;approved by payer&quot; for a deliverable milestone; use manual approval if no proof is required.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Monitor Gas Balances:</strong> Always keep a small reserve of SUI in your wallet to cover network gas fees for releasing funds or raising disputes.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">Understand Release Control:</strong> AI verification proves evidence quality; payment release remains payer/operator controlled unless auto-release was explicitly enabled for that milestone.</p>
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
