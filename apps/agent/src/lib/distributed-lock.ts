/**
 * Distributed lock service using Redlock algorithm.
 */

import Redlock, { type Lock } from 'redlock';
import { redis } from './redis-client';
import { logger } from './logger';
import { tracer, SpanStatusCode } from '../tracing';

const lockLogger = logger.child({ module: 'distributed-lock' });

const redlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 200,
  automaticExtensionThreshold: 500,
});

redlock.on('error', (error: Error) => {
  if (String(error?.message).includes('exceeded')) {
    lockLogger.debug({ error: String(error.message) }, 'Lock acquisition timeout');
  } else {
    lockLogger.error({ error: String(error.message) }, 'Redlock error');
  }
});

export class RedlockService {
  async acquire(resource: string, ttl = 30000): Promise<Lock> {
    const span = tracer.startSpan('redlock.acquire', {
      attributes: { 'bondflow.lock.resource': resource, 'bondflow.lock.ttl': ttl },
    });
    try {
      const lock = await redlock.acquire([resource], ttl);
      span.setStatus({ code: SpanStatusCode.OK });
      lockLogger.debug({ resource }, 'Lock acquired');
      return lock;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async withLock<T>(resource: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const span = tracer.startSpan('redlock.withLock', {
      attributes: { 'bondflow.lock.resource': resource },
    });
    let lock: Lock | null = null;
    try {
      lock = await redlock.acquire([resource], ttl);
      lockLogger.debug({ resource }, 'Lock acquired for withLock');
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      if (lock) {
        try { await lock.release(); } catch { /* already expired */ }
      }
      span.end();
    }
  }

  async withLockOrSkip<T>(resource: string, ttl: number, fn: () => Promise<T>): Promise<T | null> {
    const span = tracer.startSpan('redlock.withLockOrSkip', {
      attributes: { 'bondflow.lock.resource': resource },
    });
    let lock: Lock | null = null;
    try {
      const singleRetry = new Redlock([redis], { retryCount: 0, retryDelay: 0, retryJitter: 0 });
      lock = await singleRetry.acquire([resource], ttl);
      lockLogger.debug({ resource }, 'Lock acquired for withLockOrSkip');
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const msg = String((error as Error)?.message ?? '');
      if (msg.includes('exceeded') || (error as Error)?.name === 'ExecutionError') {
        lockLogger.debug({ resource }, 'Lock already held, skipping');
        span.setAttribute('bondflow.lock.skipped', true);
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      }
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      if (lock) {
        try { await lock.release(); } catch { /* already expired */ }
      }
      span.end();
    }
  }
}

export const distributedLock = new RedlockService();
