/**
 * Re-indexer script — rebuilds PostgreSQL state from BlockchainEvent table.
 * Invoked manually via: bun run reindex
 * This is event-driven recovery, not full event sourcing.
 */

import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { applyBlockchainEvent } from './event-handlers';

const reindexLogger = logger.child({ module: 'reindexer' });

async function confirm(): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Type REINDEX to truncate derived tables and replay blockchain events: ');
    return answer.trim() === 'REINDEX';
  } finally {
    rl.close();
  }
}

async function reindex(): Promise<void> {
  reindexLogger.warn('This will truncate PaymentRelationship, Milestone, CompletionAttestation, and ReputationProof');
  if (!(await confirm())) {
    reindexLogger.info('Re-index cancelled');
    return;
  }

  await prisma.$transaction([
    prisma.milestone.deleteMany({}),
    prisma.completionAttestation.deleteMany({}),
    prisma.reputationProof.deleteMany({}),
    prisma.paymentRelationship.deleteMany({}),
  ]);

  const events = await prisma.blockchainEvent.findMany({ orderBy: { createdAt: 'asc' } });
  let processed = 0;
  for (const event of events) {
    await applyBlockchainEvent({
      suiEventId: event.suiEventId,
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
      sender: event.sender,
      markProcessed: false,
    });
    processed++;
    if (processed % 100 === 0) {
      reindexLogger.info({ processed, total: events.length }, 'Re-index progress');
    }
  }

  reindexLogger.info({
    processed,
    relationships: await prisma.paymentRelationship.count(),
    attestations: await prisma.completionAttestation.count(),
    reputationProofs: await prisma.reputationProof.count(),
  }, 'Re-indexing complete');
}

reindex()
  .catch((error) => {
    reindexLogger.error({ error: (error as Error).message }, 'Re-index failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
