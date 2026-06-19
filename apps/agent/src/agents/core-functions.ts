/**
 * Four core AI functions — all use generateObject with Zod schemas via AgentRunner.
 * All check relevant feature flags before invoking Gemini.
 */

import { AgentRunner } from './agent-runner';
import { featureFlagService } from '../services/feature-flags';
import { FEATURE_FLAG_KEYS, PROMPT_KEYS } from '@bondflow/types';
import {
  AnomalyDetectionOutputSchema, PatternRecognitionOutputSchema,
  DeliveryVerificationOutputSchema, DuplicatePreventionOutputSchema,
  SAFE_DEFAULTS,
  type AnomalyDetectionOutput, type AnomalyPreflightResult, type PatternRecognitionOutput,
  type DeliveryVerificationOutput, type DuplicatePreventionOutput,
} from '@bondflow/types';
import { logger } from '../lib/logger';
import { AGENT_MODELS } from './models';

const cfLogger = logger.child({ module: 'core-functions' });

interface AgentContext {
  relationshipId?: string;
  tenantId?: string;
  walletAddress?: string;
  correlationId?: string;
}

export async function detectAnomaly(
  params: { transactionData: string; historicalContext: string },
  ctx: AgentContext,
): Promise<AnomalyPreflightResult> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, ctx.tenantId);
  if (!enabled) {
    return {
      status: 'DISABLED',
      reason: 'AI anomaly analysis is disabled for this workspace.',
    };
  }

  try {
    const result = await AgentRunner.run<AnomalyDetectionOutput>({
      promptKey: PROMPT_KEYS.ANOMALY_DETECTION,
      model: AGENT_MODELS.fast,
      userMessage: `Historical Context:\n${params.historicalContext}\n\nCurrent Transaction Data:\n${params.transactionData}`,
      outputSchema: AnomalyDetectionOutputSchema,
      actionType: 'ANOMALY_DETECTED',
      relationshipId: ctx.relationshipId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      metadata: { walletAddress: ctx.walletAddress ?? 'unknown' },
    });
    return { status: 'COMPLETED', result };
  } catch (error) {
    const message = (error as Error).message;
    cfLogger.error({ error: message }, 'Anomaly detection unavailable');
    return {
      status: 'UNAVAILABLE',
      reason: message || SAFE_DEFAULTS.anomalyDetection.reason,
    };
  }
}

export async function recognizePattern(
  params: { transactionHistory: string; memoryContext: string; relationshipData: string },
  ctx: AgentContext,
): Promise<PatternRecognitionOutput> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, ctx.tenantId);
  if (!enabled) return SAFE_DEFAULTS.patternRecognition;

  try {
    return await AgentRunner.run<PatternRecognitionOutput>({
      promptKey: PROMPT_KEYS.PATTERN_RECOGNITION,
      model: AGENT_MODELS.fast,
      userMessage: `Memory Context:\n${params.memoryContext}\n\nTransaction History:\n${params.transactionHistory}\n\nRelationship Data:\n${params.relationshipData}`,
      outputSchema: PatternRecognitionOutputSchema,
      actionType: 'PATTERN_RECOGNIZED',
      relationshipId: ctx.relationshipId,
      tenantId: ctx.tenantId,
      metadata: { walletAddress: ctx.walletAddress ?? 'unknown' },
    });
  } catch (error) {
    cfLogger.error({ error: (error as Error).message }, 'Pattern recognition failed — returning safe default');
    return SAFE_DEFAULTS.patternRecognition;
  }
}

export async function verifyDelivery(
  params: { milestoneCondition: string; deliverableMetadata: string; deliverableContent: string; expectedBlobId: string; actualBlobId: string },
  ctx: AgentContext,
): Promise<DeliveryVerificationOutput> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, ctx.tenantId);
  if (!enabled) return SAFE_DEFAULTS.deliveryVerification;

  try {
    return await AgentRunner.run<DeliveryVerificationOutput>({
      promptKey: PROMPT_KEYS.DELIVERY_VERIFICATION,
      model: AGENT_MODELS.fast,
      userMessage: `Milestone Condition:\n${params.milestoneCondition}\n\nDeliverable Metadata:\n${params.deliverableMetadata}\n\nDeliverable Content:\n${params.deliverableContent}\n\nExpected Blob ID: ${params.expectedBlobId}\nActual Blob ID: ${params.actualBlobId}`,
      outputSchema: DeliveryVerificationOutputSchema,
      actionType: 'DELIVERABLE_VERIFIED',
      relationshipId: ctx.relationshipId,
      tenantId: ctx.tenantId,
      metadata: { walletAddress: ctx.walletAddress ?? 'unknown' },
    });
  } catch (error) {
    cfLogger.error({ error: (error as Error).message }, 'Delivery verification failed — returning safe default');
    return SAFE_DEFAULTS.deliveryVerification;
  }
}

export async function preventDuplicate(
  params: { transactionData: string; recentTransactions: string },
  ctx: AgentContext,
): Promise<DuplicatePreventionOutput> {
  const enabled = await featureFlagService.isEnabled(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, ctx.tenantId);
  if (!enabled) return SAFE_DEFAULTS.duplicatePrevention;

  try {
    return await AgentRunner.run<DuplicatePreventionOutput>({
      promptKey: PROMPT_KEYS.ANOMALY_DETECTION,
      model: AGENT_MODELS.fast,
      userMessage: `Check for duplicate transaction.\n\nNew Transaction:\n${params.transactionData}\n\nRecent Transactions:\n${params.recentTransactions}`,
      outputSchema: DuplicatePreventionOutputSchema,
      actionType: 'DUPLICATE_PREVENTED',
      relationshipId: ctx.relationshipId,
      tenantId: ctx.tenantId,
      metadata: { walletAddress: ctx.walletAddress ?? 'unknown' },
    });
  } catch (error) {
    cfLogger.error({ error: (error as Error).message }, 'Duplicate prevention failed — returning safe default');
    return SAFE_DEFAULTS.duplicatePrevention;
  }
}
