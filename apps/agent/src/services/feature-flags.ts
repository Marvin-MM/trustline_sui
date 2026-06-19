/**
 * Feature flag service with Redis caching (60s TTL).
 * Tenant-specific overrides take precedence over platform-wide defaults.
 */

import { prisma } from '../db/client';
import { redis } from '../lib/redis-client';
import { logger } from '../lib/logger';
import { FEATURE_FLAG_CATALOG } from '@bondflow/types';
import { FEATURE_FLAG_SEEDS } from '../../prisma/seed';

const ffLogger = logger.child({ module: 'feature-flags' });
const CACHE_TTL = 60; // seconds
const DEFAULT_FLAG_VALUES = new Map(FEATURE_FLAG_SEEDS.map((flag) => [flag.key, flag.enabled]));

export class FeatureFlagService {
  private cacheKey(key: string, tenantId?: string | null): string {
    return `bondflow:ff:${key}:${tenantId ?? 'global'}`;
  }

  private async invalidate(key: string, tenantId?: string | null): Promise<void> {
    const keys = tenantId
      ? [this.cacheKey(key, tenantId)]
      : await redis.keys(`bondflow:ff:${key}:*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.publish('bondflow:events', JSON.stringify({ type: 'FeatureFlagUpdated', key, tenantId: tenantId ?? null }));
  }

  async isEnabled(key: string, tenantId?: string | null): Promise<boolean> {
    // Check Redis cache first
    const cacheKey = this.cacheKey(key, tenantId);
    const cached = await redis.get(cacheKey);
    if (cached !== null) return cached === '1';

    // Check tenant-specific override first
    if (tenantId) {
      const tenantFlag = await prisma.featureFlag.findFirst({
        where: { key, tenantId },
      });
      if (tenantFlag) {
        await redis.setex(cacheKey, CACHE_TTL, tenantFlag.enabled ? '1' : '0');
        return tenantFlag.enabled;
      }
    }

    // Fall back to platform-wide default
    const globalFlag = await prisma.featureFlag.findFirst({
      where: { key, tenantId: null },
    });
    const enabled = globalFlag?.enabled ?? DEFAULT_FLAG_VALUES.get(key) ?? false;
    await redis.setex(cacheKey, CACHE_TTL, enabled ? '1' : '0');
    return enabled;
  }

  async listForTenant(tenantId?: string | null) {
    const flags = await prisma.featureFlag.findMany({
      where: tenantId ? { OR: [{ tenantId: null }, { tenantId }] } : { tenantId: null },
      orderBy: [{ key: 'asc' }, { tenantId: 'asc' }],
    });

    const byKey = new Map<string, (typeof flags)[number]>();
    for (const flag of flags) {
      const existing = byKey.get(flag.key);
      if (!existing || flag.tenantId === tenantId) {
        byKey.set(flag.key, flag);
      }
    }
    const now = new Date();
    return Object.entries(FEATURE_FLAG_CATALOG)
      .map(([key, definition]) => byKey.get(key) ?? {
        id: `virtual:${tenantId ?? 'global'}:${key}`,
        key,
        enabled: DEFAULT_FLAG_VALUES.get(key) ?? false,
        tenantId: tenantId ?? null,
        description: definition.description,
        createdAt: now,
        updatedAt: now,
      })
      .concat(Array.from(byKey.values()).filter((flag) => !(flag.key in FEATURE_FLAG_CATALOG)));
  }

  async enable(key: string, tenantId?: string | null): Promise<void> {
    await this.setFlag(key, true, tenantId);
    ffLogger.info({ key, tenantId }, 'Feature flag enabled');
  }

  async disable(key: string, tenantId?: string | null): Promise<void> {
    await this.setFlag(key, false, tenantId);
    ffLogger.info({ key, tenantId }, 'Feature flag disabled');
  }

  private async setFlag(key: string, enabled: boolean, tenantId?: string | null): Promise<void> {
    const existing = await prisma.featureFlag.findFirst({ where: { key, tenantId: tenantId ?? null } });
    if (existing) {
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { enabled } });
    } else {
      await prisma.featureFlag.create({
        data: {
          key,
          enabled,
          tenantId: tenantId ?? null,
          description: FEATURE_FLAG_CATALOG[key as keyof typeof FEATURE_FLAG_CATALOG]?.description ?? `Feature flag: ${key}`,
        },
      });
    }
    await this.invalidate(key, tenantId);
  }
}

export const featureFlagService = new FeatureFlagService();
