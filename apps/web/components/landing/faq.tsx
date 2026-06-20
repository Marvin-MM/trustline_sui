'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    question: 'How does the AI verify deliverables?',
    answer: 'Recipients upload proof to Walrus and sign a submit transaction. BondFlow then runs a verifier agent that checks the blob, compares it with the milestone requirement, and records model, prompt version, confidence, reasoning, cost, and evidence hash. By default, that verification prepares the payer or workspace operator to approve release; it does not silently move funds.',
  },
  {
    question: 'Is my payment safe in the escrow contract?',
    answer: 'Yes. When you fund a relationship, USDC is locked directly in the BondFlow Sui contract. Milestones can be released by the payer, an authorized workspace operator, an explicitly scoped auto-release capability, or an admin dispute resolution. Refunds always return to the original funder.',
  },
  {
    question: 'What happens if the AI fails to verify a milestone?',
    answer: 'The upload is marked rejected or failed with the reason visible in the app. The recipient can retry with better evidence, while the payer/operator can review the relationship, raise a dispute when appropriate, or release only when the contract state allows it.',
  },
  {
    question: 'What is the role of Walrus Protocol in BondFlow?',
    answer: 'Walrus stores deliverable proofs, dispute evidence, and canonical relationship memory entries. Sui keeps compact hashes and object state; Walrus keeps the larger evidence payloads previewable and durable.',
  },
  {
    question: 'Do I need SUI tokens to use BondFlow?',
    answer: 'Yes. You need a small amount of SUI for gas, and payers need USDC for the milestone funding amount. Recipients also need SUI gas to submit deliverables or sign other on-chain actions.',
  },
  {
    question: 'When do reputation proofs become available?',
    answer: 'Every successful milestone release mints a CompletionAttestation for the recipient wallet. Once at least one attestation is indexed, the recipient can mint or update a ReputationProof from their personal reputation page.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 px-6 relative overflow-hidden border-t border-border/40">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2 opacity-60" />
      <div className="absolute bottom-0 right-10 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-4xl relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
            Got Questions?
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-muted-foreground text-base">
            Everything you need to know about BondFlow payment relationships, AI verification, and contract safety.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-card/45 dark:bg-card/20 overflow-hidden transition-all duration-300 hover:border-brand/30 hover:shadow-sm"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start gap-4">
                    <HelpCircle className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                    <span className="font-semibold text-foreground text-base sm:text-lg">
                      {faq.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-brand' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 pl-14 text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
