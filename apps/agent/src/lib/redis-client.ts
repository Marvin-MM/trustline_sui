/**
 * Redis client singleton using ioredis.
 * 
 * Provides a shared Redis connection for caching, BullMQ queues,
 * distributed locks, and rate limiting.
 * Handles graceful shutdown to close connections.
 */

import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

const redisLogger = logger.child({ module: 'redis' });
const lazyRedis = env.EXTERNAL_SERVICES_MODE === 'mock' && !env.START_WORKERS;

/**
 * Primary Redis client for general operations (caching, rate limiting, feature flags).
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  lazyConnect: lazyRedis,
  enableOfflineQueue: !lazyRedis,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      redisLogger.error({ times }, 'Redis connection retry limit exceeded');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    redisLogger.warn({ times, delay }, 'Retrying Redis connection');
    return delay;
  },
});

redis.on('connect', () => {
  redisLogger.info('Redis connected');
});

redis.on('error', (err: Error) => {
  redisLogger.error({ err: err.message }, 'Redis connection error');
});

redis.on('close', () => {
  redisLogger.info('Redis connection closed');
});

/**
 * Creates a new Redis connection for BullMQ workers.
 * BullMQ requires separate connections for the client, subscriber, and worker.
 */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: lazyRedis,
    enableOfflineQueue: !lazyRedis,
  });
}

/**
 * Gracefully disconnects the Redis client.
 * Called during application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'wait') {
    redis.disconnect();
    redisLogger.info('Redis lazy connection closed');
    return;
  }
  await redis.quit().catch((error: unknown) => {
    redisLogger.warn({ error: (error as Error).message }, 'Redis quit failed; disconnecting socket');
    redis.disconnect();
  });
  redisLogger.info('Redis disconnected gracefully');
}
