/**
 * Memory insight agent — on-demand insights from MemWal.
 */

import { AgentRunner } from './agent-runner';
import { featureFlagService } from '../services/feature-flags';
import { walrusService } from '../services/walrus';
import { logger } from '../lib/logger';
import { FEATURE_FLAG_KEYS, PROMPT_KEYS, MemoryInsightOutputSchema, type MemoryInsightOutput } from '@bondflow/types';
import { AGENT_MODELS } from './models';

const miLogger = logger.child({ module: 'memory-insight-agent' });

export async function runMemoryInsight(params: {
  relationshipId: string;
  walrusMemorySpaceId: string;
  question: string;
  relationshipData: string;
  factualMemoryContext?: string;
  tenantId?: string;
  walletAddress?: string;
}): Promise<MemoryInsightOutput> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, params.tenantId);
  if (!enabled) {
    return { insight: 'AI verification is disabled', confidence: 0, relevantEntries: [] };
  }

  const memoryEntries = await walrusService.searchMemory(params.walrusMemorySpaceId, params.question);
  const memoryContext = memoryEntries.length > 0
    ? memoryEntries.map(e => `[${e.timestamp}] ${e.content}`).join('\n')
    : params.factualMemoryContext || 'No memory entries found for this relationship.';

  return AgentRunner.run<MemoryInsightOutput>({
    promptKey: PROMPT_KEYS.MEMORY_INSIGHT,
    model: AGENT_MODELS.reasoning,
    userMessage: `Memory Entries:\n${memoryContext}\n\nRelationship Data:\n${params.relationshipData}\n\nQuestion:\n${params.question}`,
    outputSchema: MemoryInsightOutputSchema,
    actionType: 'MEMORY_INSIGHT_GENERATED',
    relationshipId: params.relationshipId,
    tenantId: params.tenantId,
    metadata: { walletAddress: params.walletAddress ?? 'unknown' },
  });
}
