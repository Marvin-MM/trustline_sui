/**
 * Prompt registry — loads versioned AI prompts from the database.
 * 5-minute in-memory cache. Prompts are never hardcoded in source files.
 */

import { prisma } from '../db/client';
import { logger } from './logger';
import type { PromptVersion } from '@prisma/client';

const prLogger = logger.child({ module: 'prompt-registry' });

interface CachedPrompt {
  prompt: PromptVersion;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class PromptRegistry {
  private readonly cache = new Map<string, CachedPrompt>();

  async getActivePrompt(promptKey: string): Promise<PromptVersion> {
    const cached = this.cache.get(promptKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.prompt;
    }

    const prompt = await prisma.promptVersion.findFirst({
      where: { promptKey, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!prompt) {
      throw new Error(`No active prompt found for key: ${promptKey}. Run the seed script.`);
    }

    this.cache.set(promptKey, { prompt, cachedAt: Date.now() });
    prLogger.debug({ promptKey, version: prompt.version }, 'Prompt loaded and cached');
    return prompt;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const promptRegistry = new PromptRegistry();
