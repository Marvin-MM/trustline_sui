/**
 * Reputation builder agent — analyzes attestations for reputation narrative.
 */

import { AgentRunner } from './agent-runner';
import { featureFlagService } from '../services/feature-flags';
import { distributedLock } from '../lib/distributed-lock';
import { logger } from '../lib/logger';
import { FEATURE_FLAG_KEYS, PROMPT_KEYS, ReputationBuilderOutputSchema, type ReputationBuilderOutput } from '@bondflow/types';
import { AGENT_MODELS } from './models';

const rbLogger = logger.child({ module: 'reputation-builder-agent' });

export async function runReputationBuilder(params: {
  walletAddress: string;
  attestationData: string;
  successfulCount: number;
  disputedCount: number;
  totalVolume: string;
  completionRate: number;
  avgCompletionTime: string;
  tenantId?: string;
}): Promise<ReputationBuilderOutput> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_REPUTATION_PROOF, params.tenantId);
  if (!enabled) {
    return { summary: 'Reputation proof generation is disabled', strengthAreas: [], riskAreas: [], overallRating: 'fair', narrativeDescription: '' };
  }

  const lockResource = `bondflow:lock:reputation:${params.walletAddress}`;
  return distributedLock.withLock(lockResource, 30000, () =>
    AgentRunner.run<ReputationBuilderOutput>({
      promptKey: PROMPT_KEYS.REPUTATION_BUILDER,
      model: AGENT_MODELS.reasoning,
      userMessage: `Attestation Data:\n${params.attestationData}\n\nStatistics:\n- Successful: ${params.successfulCount}\n- Disputed: ${params.disputedCount}\n- Volume: ${params.totalVolume} USDC\n- Rate: ${params.completionRate}%\n- Avg Time: ${params.avgCompletionTime}`,
      outputSchema: ReputationBuilderOutputSchema,
      actionType: 'REPUTATION_BUILT',
      tenantId: params.tenantId,
      metadata: { walletAddress: params.walletAddress },
    }),
  );
}
