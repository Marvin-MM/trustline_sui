/**
 * Non-destructive derived-state repair for deliverable event handling.
 *
 * Use when older processed events stored deliverable blob IDs as on-chain bytes
 * while local uploads kept the original Walrus blob ID. This replays only the
 * deliverable/verification state events, avoiding release-side notification
 * side effects.
 */

import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { applyBlockchainEvent } from './event-handlers';

const repairLogger = logger.child({ module: 'repair-deliverable-events' });

const REPAIRABLE_EVENT_NAMES = new Set([
  'DeliverableSubmittedEvent',
  'DeliverableVerifiedEvent',
  'DeliverableRejectedEvent',
  'MilestoneConditionMetEvent',
]);
const STALE_SCANNING_MS = 10 * 60 * 1000;
const RECOVERABLE_METADATA_FAILURE = 'Failed to retrieve metadata for the provided Blob ID';

function eventName(type: string): string {
  return type.split('::').at(-1) ?? type;
}

async function repairDeliverableEvents(): Promise<void> {
  const events = await prisma.blockchainEvent.findMany({
    orderBy: { createdAt: 'asc' },
  });

  let replayed = 0;
  for (const event of events) {
    if (!REPAIRABLE_EVENT_NAMES.has(eventName(event.eventType))) continue;
    await applyBlockchainEvent({
      suiEventId: event.suiEventId,
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
      sender: event.sender,
      markProcessed: false,
    });
    replayed++;
  }

  const stale = await prisma.deliverableUpload.updateMany({
    where: {
      verificationStatus: 'SCANNING',
      updatedAt: { lt: new Date(Date.now() - STALE_SCANNING_MS) },
    },
    data: {
      verificationStatus: 'FAILED',
      verificationConfidence: 0,
      verificationReason: 'Verification was left scanning without an active verifier job. Retry verification to enqueue a fresh AI verifier run.',
    },
  });

  const recoverableMetadataFailures = await prisma.deliverableUpload.updateMany({
    where: {
      verificationStatus: 'REJECTED',
      verificationReason: { contains: RECOVERABLE_METADATA_FAILURE, mode: 'insensitive' },
    },
    data: {
      verificationStatus: 'FAILED',
      verificationConfidence: 0,
      verificationReason: 'Walrus metadata verification used an obsolete raw-blob parser. Retry verification to re-check this proof.',
    },
  });

  const payerApprovalDeadlinesCleared = await prisma.milestone.updateMany({
    where: {
      releasePolicy: 'PAYER_APPROVAL',
      challengeDeadline: { not: null },
    },
    data: { challengeDeadline: null },
  });

  repairLogger.info(
    {
      replayed,
      staleVerificationUploadsMarkedFailed: stale.count,
      recoverableMetadataFailuresMarkedFailed: recoverableMetadataFailures.count,
      payerApprovalDeadlinesCleared: payerApprovalDeadlinesCleared.count,
    },
    'Deliverable derived-state repair complete',
  );
}

repairDeliverableEvents()
  .catch((error) => {
    repairLogger.error({ error: error instanceof Error ? error.message : String(error) }, 'Deliverable derived-state repair failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
