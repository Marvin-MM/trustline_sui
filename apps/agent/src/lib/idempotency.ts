/**
 * Idempotency key service.
 * Prevents duplicate processing via SHA-256 hashed request params.
 * TTL: 5 minutes.
 */

import { prisma } from '../db/client';
import { logger } from './logger';

const idempLogger = logger.child({ module: 'idempotency' });

export async function generateIdempotencyKey(params: Record<string, unknown>): Promise<string> {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  const data = new TextEncoder().encode(sorted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getIdempotentResponse(key: string): Promise<unknown | null> {
  try {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (!existing || existing.expiresAt < new Date()) return null;
    idempLogger.info({ key }, 'Returning cached idempotent response');
    return existing.response;
  } catch (error) {
    idempLogger.error({ error: (error as Error).message }, 'Idempotency check failed');
    return null;
  }
}

export async function setIdempotentResponse(key: string, response: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await prisma.idempotencyKey.upsert({
      where: { key },
      update: { response: response as object, expiresAt },
      create: { key, response: response as object, expiresAt },
    });
  } catch (error) {
    idempLogger.error({ error: (error as Error).message }, 'Failed to store idempotency key');
  }
}

export async function checkIdempotency(params: Record<string, unknown>): Promise<{ key: string; cachedResponse: unknown | null }> {
  const key = await generateIdempotencyKey(params);
  const cachedResponse = await getIdempotentResponse(key);
  return { key, cachedResponse };
}
