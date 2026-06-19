/**
 * Memory writer agent — compresses relationship events into MemWal entries.
 */

import { AgentRunner } from './agent-runner';
import { featureFlagService } from '../services/feature-flags';
import { walrusService } from '../services/walrus';
import { distributedLock } from '../lib/distributed-lock';
import { logger } from '../lib/logger';
import { FEATURE_FLAG_KEYS, PROMPT_KEYS, MemoryWriterOutputSchema, type MemoryWriterOutput } from '@bondflow/types';
import { AGENT_MODELS } from './models';

const mwLogger = logger.child({ module: 'memory-writer-agent' });

export async function runMemoryWriter(params: {
  relationshipId: string;
  walrusMemorySpaceId: string;
  eventData: string;
  existingMemory: string;
  relationshipSummary: string;
  tenantId?: string;
  walletAddress?: string;
}): Promise<MemoryWriterOutput | null> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, params.tenantId);
  if (!enabled) { mwLogger.info('AI disabled — skipping memory write'); return null; }

  const lockResource = `bondflow:lock:memory:${params.relationshipId}`;
  return distributedLock.withLock(lockResource, 30000, async () => {
    const result = await AgentRunner.run<MemoryWriterOutput>({
      promptKey: PROMPT_KEYS.MEMORY_WRITER,
      model: AGENT_MODELS.reasoning,
      userMessage: `Event Data:\n${params.eventData}\n\nExisting Memory:\n${params.existingMemory}\n\nRelationship Summary:\n${params.relationshipSummary}`,
      outputSchema: MemoryWriterOutputSchema,
      actionType: 'MEMORY_WRITTEN',
      relationshipId: params.relationshipId,
      tenantId: params.tenantId,
      metadata: { walletAddress: params.walletAddress ?? 'system' },
    });

    await walrusService.writeMemoryEntry(params.walrusMemorySpaceId, {
      content: JSON.stringify(result),
      metadata: { relationshipId: params.relationshipId, timestamp: new Date().toISOString() },
    });

    mwLogger.info({ relationshipId: params.relationshipId }, 'Memory entry written');
    return result;
  });
}
