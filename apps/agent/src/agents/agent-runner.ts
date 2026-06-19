/**
 * Agent runner — the single entry point for ALL AI invocations.
 * Handles prompt fetching, governance, cost tracking, and audit logging.
 * Every AI decision is permanently linked to the exact prompt that produced it.
 */

import { generateObject, generateText, stepCountIs, type ToolSet } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { prisma } from '../db/client';
import { promptRegistry } from '../lib/prompt-registry';
import { estimateCost } from '../lib/cost-estimator';
import { logger } from '../lib/logger';
import { AI_TOKEN_RESOURCE_TYPE } from './models';
import {
  tracer, SpanStatusCode, context,
  agentInvocationsCounter, agentDurationHistogram, agentTokensCounter,
} from '../tracing';
import { trace } from '@opentelemetry/api';
import type { AgentRunnerConfig, AgentRunnerToolConfig } from '@bondflow/types';
import type { AgentActionType } from '@prisma/client';

const arLogger = logger.child({ module: 'agent-runner' });

export class AgentRunner {
  /**
   * Run a structured output AI invocation via generateObject.
   * All four core functions use this method.
   */
  static async run<T>(config: AgentRunnerConfig<T> & { actionType: AgentActionType }): Promise<T> {
    const span = tracer.startSpan('agent.run', {
      attributes: {
        'bondflow.agent.prompt_key': config.promptKey,
        'bondflow.agent.model': config.model,
      },
    });

    const startTime = Date.now();
    let promptVersion = 'unknown';

    try {
      // 1. Fetch the active prompt from PromptRegistry
      const prompt = await promptRegistry.getActivePrompt(config.promptKey);
      promptVersion = prompt.version;
      span.setAttribute('bondflow.agent.prompt_version', promptVersion);

      // 2. Call the AI SDK with the fetched prompt
      const result = await generateObject({
        model: google(config.model),
        system: config.systemPromptOverride ?? prompt.content,
        prompt: config.userMessage,
        schema: config.outputSchema as z.ZodType<T>,
      });

      const durationMs = Date.now() - startTime;
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      const totalTokens = result.usage.totalTokens ?? inputTokens + outputTokens;
      const estimatedCostUsd = estimateCost(config.model, inputTokens, outputTokens);

      // 3. Record metrics
      agentInvocationsCounter.add(1, { agent_type: config.actionType, model: config.model, success: 'true' });
      agentDurationHistogram.record(durationMs, { agent_type: config.actionType, model: config.model });
      agentTokensCounter.add(inputTokens, { agent_type: config.actionType, model: config.model, token_type: 'input' });
      agentTokensCounter.add(outputTokens, { agent_type: config.actionType, model: config.model, token_type: 'output' });

      // 4. Get OTel trace ID for correlation
      const activeSpan = trace.getSpan(context.active());
      const traceId = activeSpan?.spanContext().traceId ?? null;

      // 5. Write the complete AgentAction record
      await prisma.agentAction.create({
        data: {
          relationshipId: config.relationshipId ?? null,
          tenantId: config.tenantId ?? null,
          correlationId: config.correlationId ?? null,
          actionType: config.actionType,
          payload: { promptKey: config.promptKey, userMessage: config.userMessage, ...config.metadata } as object,
          result: result.object as object,
          aiModel: config.model,
          promptVersion,
          tokensUsed: totalTokens,
          inputTokens,
          outputTokens,
          estimatedCostUsd,
          durationMs,
          success: true,
          traceId,
        },
      });

      // 6. Record usage
      if (config.relationshipId || config.tenantId) {
        const walletAddress = config.metadata?.['walletAddress'] ?? 'system';
        const bucketDate = new Date();
        bucketDate.setUTCHours(0, 0, 0, 0);
        await prisma.usageRecord.create({
          data: {
            walletAddress,
            tenantId: config.tenantId ?? null,
            relationshipId: config.relationshipId ?? null,
            resourceType: AI_TOKEN_RESOURCE_TYPE,
            quantity: BigInt(totalTokens),
            model: config.model,
            estimatedCostUsd,
            recordedAt: new Date(),
          },
        });
        await prisma.usageAggregation.upsert({
          where: {
            walletAddress_tenantId_resourceType_bucketDate: {
              walletAddress,
              tenantId: config.tenantId ?? '',
              resourceType: AI_TOKEN_RESOURCE_TYPE,
              bucketDate,
            },
          },
          update: {
            quantity: { increment: BigInt(totalTokens) },
            estimatedCostUsd: { increment: estimatedCostUsd },
          },
          create: {
            walletAddress,
            tenantId: config.tenantId ?? '',
            resourceType: AI_TOKEN_RESOURCE_TYPE,
            bucketDate,
            quantity: BigInt(totalTokens),
            estimatedCostUsd,
          },
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      arLogger.info(
        { promptKey: config.promptKey, model: config.model, durationMs, tokens: totalTokens, cost: estimatedCostUsd },
        'Agent invocation completed',
      );

      return result.object;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      agentInvocationsCounter.add(1, { agent_type: config.actionType, model: config.model, success: 'false' });

      const activeSpan = trace.getSpan(context.active());
      const traceId = activeSpan?.spanContext().traceId ?? null;

      await prisma.agentAction.create({
        data: {
          relationshipId: config.relationshipId ?? null,
          tenantId: config.tenantId ?? null,
          correlationId: config.correlationId ?? null,
          actionType: config.actionType,
          payload: { promptKey: config.promptKey, userMessage: config.userMessage } as object,
          result: {} as object,
          aiModel: config.model,
          promptVersion,
          durationMs,
          estimatedCostUsd: 0,
          success: false,
          errorMessage: (error as Error).message,
          traceId,
        },
      }).catch(dbErr => arLogger.error({ error: (dbErr as Error).message }, 'Failed to record agent action'));

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Run a multi-step tool-calling AI invocation via generateText.
   */
  static async runWithTools(config: AgentRunnerToolConfig & { actionType: AgentActionType }): Promise<string> {
    const span = tracer.startSpan('agent.runWithTools', {
      attributes: {
        'bondflow.agent.prompt_key': config.promptKey,
        'bondflow.agent.model': config.model,
      },
    });
    const startTime = Date.now();
    let promptVersion = 'unknown';

    try {
      const prompt = await promptRegistry.getActivePrompt(config.promptKey);
      promptVersion = prompt.version;
      span.setAttribute('bondflow.agent.prompt_version', promptVersion);

      const result = await generateText({
        model: google(config.model),
        system: config.systemPromptOverride ?? prompt.content,
        prompt: config.userMessage,
        tools: config.tools as ToolSet,
        stopWhen: stepCountIs(config.maxSteps),
      });

      const durationMs = Date.now() - startTime;
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      const totalTokens = result.usage.totalTokens ?? inputTokens + outputTokens;
      const estimatedCostUsd = estimateCost(config.model, inputTokens, outputTokens);
      const activeSpan = trace.getSpan(context.active());
      const traceId = activeSpan?.spanContext().traceId ?? null;

      agentInvocationsCounter.add(1, { agent_type: config.actionType, model: config.model, success: 'true' });
      agentDurationHistogram.record(durationMs, { agent_type: config.actionType, model: config.model });
      agentTokensCounter.add(inputTokens, { agent_type: config.actionType, model: config.model, token_type: 'input' });
      agentTokensCounter.add(outputTokens, { agent_type: config.actionType, model: config.model, token_type: 'output' });

      await prisma.agentAction.create({
        data: {
          relationshipId: config.relationshipId ?? null,
          tenantId: config.tenantId ?? null,
          actionType: config.actionType,
          payload: { promptKey: config.promptKey, userMessage: config.userMessage, ...config.metadata } as object,
          result: { text: result.text } as object,
          aiModel: config.model,
          promptVersion,
          tokensUsed: totalTokens,
          inputTokens,
          outputTokens,
          estimatedCostUsd,
          durationMs,
          success: true,
          traceId,
        },
      });

      if (config.relationshipId || config.tenantId) {
        const walletAddress = config.metadata?.['walletAddress'] ?? 'system';
        const bucketDate = new Date();
        bucketDate.setUTCHours(0, 0, 0, 0);
        await prisma.usageRecord.create({
          data: {
            walletAddress,
            tenantId: config.tenantId ?? null,
            relationshipId: config.relationshipId ?? null,
            resourceType: AI_TOKEN_RESOURCE_TYPE,
            quantity: BigInt(totalTokens),
            model: config.model,
            estimatedCostUsd,
            recordedAt: new Date(),
          },
        });
        await prisma.usageAggregation.upsert({
          where: {
            walletAddress_tenantId_resourceType_bucketDate: {
              walletAddress,
              tenantId: config.tenantId ?? '',
              resourceType: AI_TOKEN_RESOURCE_TYPE,
              bucketDate,
            },
          },
          update: {
            quantity: { increment: BigInt(totalTokens) },
            estimatedCostUsd: { increment: estimatedCostUsd },
          },
          create: {
            walletAddress,
            tenantId: config.tenantId ?? '',
            resourceType: AI_TOKEN_RESOURCE_TYPE,
            bucketDate,
            quantity: BigInt(totalTokens),
            estimatedCostUsd,
          },
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result.text;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const activeSpan = trace.getSpan(context.active());
      const traceId = activeSpan?.spanContext().traceId ?? null;
      agentInvocationsCounter.add(1, { agent_type: config.actionType, model: config.model, success: 'false' });
      await prisma.agentAction.create({
        data: {
          relationshipId: config.relationshipId ?? null,
          tenantId: config.tenantId ?? null,
          actionType: config.actionType,
          payload: { promptKey: config.promptKey, userMessage: config.userMessage, ...config.metadata } as object,
          result: {} as object,
          aiModel: config.model,
          promptVersion,
          durationMs,
          estimatedCostUsd: 0,
          success: false,
          errorMessage: (error as Error).message,
          traceId,
        },
      }).catch(dbErr => arLogger.error({ error: (dbErr as Error).message }, 'Failed to record tool agent action'));
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
