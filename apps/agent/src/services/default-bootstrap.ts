/**
 * Startup bootstrap for operational defaults that the app needs to function.
 * This is intentionally idempotent and only touches platform-wide prompt and
 * feature-flag defaults. Tenant overrides remain user-controlled.
 */

import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { PROMPT_SEEDS, FEATURE_FLAG_SEEDS } from '../../prisma/seed';
import { redis } from '../lib/redis-client';

const bootstrapLogger = logger.child({ module: 'default-bootstrap' });

export async function bootstrapOperationalDefaults(): Promise<void> {
  for (const prompt of PROMPT_SEEDS) {
    const existing = await prisma.promptVersion.findUnique({
      where: {
        promptKey_version: {
          promptKey: prompt.promptKey,
          version: prompt.version,
        },
      },
    });

    if (!existing) {
      await prisma.promptVersion.create({
        data: {
          promptKey: prompt.promptKey,
          version: prompt.version,
          content: prompt.content,
          isActive: true,
          activatedAt: new Date(),
        },
      });
    }

    await prisma.$transaction([
      prisma.promptVersion.updateMany({
        where: {
          promptKey: prompt.promptKey,
          version: { not: prompt.version },
          isActive: true,
        },
        data: { isActive: false },
      }),
      prisma.promptVersion.updateMany({
        where: { promptKey: prompt.promptKey, version: prompt.version },
        data: { isActive: true, activatedAt: new Date() },
      }),
    ]);
  }

  for (const flag of FEATURE_FLAG_SEEDS) {
    const existing = await prisma.featureFlag.findFirst({
      where: { key: flag.key, tenantId: null },
    });

    if (existing) {
      await prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          enabled: flag.enabled,
          description: flag.description,
        },
      });
    } else {
      await prisma.featureFlag.create({
        data: {
          key: flag.key,
          enabled: flag.enabled,
          tenantId: null,
          description: flag.description,
        },
      });
    }
    const cachedKeys = await redis.keys(`bondflow:ff:${flag.key}:*`);
    if (cachedKeys.length > 0) {
      await redis.del(...cachedKeys);
    }
  }

  bootstrapLogger.info({
    prompts: PROMPT_SEEDS.length,
    featureFlags: FEATURE_FLAG_SEEDS.length,
  }, 'Operational defaults bootstrapped');
}
