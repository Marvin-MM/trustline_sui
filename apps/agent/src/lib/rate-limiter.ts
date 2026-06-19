/**
 * Redis-based sliding window rate limiter.
 * 
 * Uses Redis sorted sets for accurate sliding window counting.
 * Returns standard rate limit headers on every response.
 * 
 * Rate limit tiers (configurable via env):
 * - Auth endpoints: 10 req/min/IP
 * - File upload: 5 req/min/user
 * - AI pipeline: 20 req/min/user
 * - Tenant management: 30 req/min/user
 * - General API: 100 req/min/user
 */

import { redis } from './redis-client';
import { env } from '../config/env';
import { logger } from './logger';
export { setRateLimitHeaders } from './rate-limit-headers';

const rlLogger = logger.child({ module: 'rate-limiter' });

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  retryAfter: number | null; // Seconds until rate limit resets (null if not limited)
}

export enum RateLimitTier {
  AUTH = 'auth',
  UPLOAD = 'upload',
  AI_PIPELINE = 'ai_pipeline',
  TENANT = 'tenant',
  GENERAL = 'general',
}

const TIER_LIMITS: Record<RateLimitTier, number> = {
  [RateLimitTier.AUTH]: env.RATE_LIMIT_AUTH,
  [RateLimitTier.UPLOAD]: env.RATE_LIMIT_UPLOAD,
  [RateLimitTier.AI_PIPELINE]: env.RATE_LIMIT_AI,
  [RateLimitTier.TENANT]: env.RATE_LIMIT_TENANT,
  [RateLimitTier.GENERAL]: env.RATE_LIMIT_GENERAL,
};

/** Window size in seconds (1 minute) */
const WINDOW_SIZE_SECONDS = 60;

/**
 * Check rate limit using a sliding window algorithm with Redis sorted sets.
 * 
 * Algorithm:
 * 1. Remove all entries older than the window
 * 2. Count remaining entries
 * 3. If under limit, add the new request
 * 4. Return the result with remaining count
 * 
 * @param identifier - Unique identifier (IP address or user wallet)
 * @param tier - Rate limit tier to apply
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier,
): Promise<RateLimitResult> {
  const limit = TIER_LIMITS[tier];
  const key = `bondflow:ratelimit:${tier}:${identifier}`;
  const now = Date.now();
  const windowStart = now - WINDOW_SIZE_SECONDS * 1000;
  const resetAt = Math.ceil(now / 1000) + WINDOW_SIZE_SECONDS;

  try {
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    const lua = `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
      local count = redis.call('ZCARD', KEYS[1])
      if count >= tonumber(ARGV[3]) then
        redis.call('EXPIRE', KEYS[1], ARGV[4])
        local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        local retryAfter = 60
        if oldest[2] then
          retryAfter = math.max(1, math.ceil((tonumber(oldest[2]) + 60000 - tonumber(ARGV[1])) / 1000))
        end
        return {0, 0, retryAfter}
      end
      redis.call('ZADD', KEYS[1], ARGV[1], ARGV[5])
      redis.call('EXPIRE', KEYS[1], ARGV[4])
      return {1, tonumber(ARGV[3]) - count - 1, 0}
    `;

    const response = await redis.eval(
      lua,
      1,
      key,
      String(now),
      String(windowStart),
      String(limit),
      String(WINDOW_SIZE_SECONDS + 1),
      member,
    );
    const [allowedRaw, remainingRaw, retryRaw] = response as [number, number, number];

    if (allowedRaw !== 1) {
      const retryAfter = retryRaw || WINDOW_SIZE_SECONDS;
      rlLogger.warn(
        { identifier, tier, limit },
        'Rate limit exceeded',
      );
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, remainingRaw),
      resetAt,
      retryAfter: null,
    };
  } catch (error) {
    rlLogger.error({ error: (error as Error).message, key }, 'Rate limit check failed');
    // Fail open on Redis errors — don't block requests due to cache failures
    return { allowed: true, limit, remaining: limit - 1, resetAt, retryAfter: null };
  }
}
