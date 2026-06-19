/**
 * Walrus storage service wrapped in circuit breaker.
 * Handles blob uploads, fetching, MemWal memory spaces, and attestation spaces.
 */

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { CircuitBreaker } from '../lib/circuit-breaker';
import { tracer, SpanStatusCode, walrusOperationsCounter } from '../tracing';
import { MemWal } from '@mysten-incubation/memwal';

const wLogger = logger.child({ module: 'walrus' });

const walrusCircuitBreaker = new CircuitBreaker({
  name: 'walrus',
  failureThreshold: 5,
  resetTimeoutMs: env.CIRCUIT_RESET_TIMEOUT,
});

const memwal = env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID
  ? MemWal.create({
      key: env.MEMWAL_PRIVATE_KEY,
      accountId: env.MEMWAL_ACCOUNT_ID,
      serverUrl: env.MEMWAL_SERVER_URL,
      namespace: 'bondflow',
    })
  : null;

export class WalrusService {
  async uploadBlob(data: Buffer, contentType: string): Promise<{ blobId: string }> {
    const span = tracer.startSpan('walrus.uploadBlob');
    try {
      const result = await walrusCircuitBreaker.execute(async () => {
        const response = await fetch(`${env.WALRUS_PUBLISHER_URL}/v1/blobs`, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: data,
        });
        if (!response.ok) throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
        return response.json() as Promise<Record<string, unknown>>;
      });

      type WalrusNewlyCreated = { newlyCreated?: { blobObject?: { blobId?: string } } };
      type WalrusCertified = { alreadyCertified?: { blobId?: string } };
      const typed = result as WalrusNewlyCreated & WalrusCertified;
      const blobId = (typed.newlyCreated?.blobObject?.blobId ?? typed.alreadyCertified?.blobId ?? '') as string;

      walrusOperationsCounter.add(1, { operation: 'upload', success: 'true' });
      span.setStatus({ code: SpanStatusCode.OK });
      wLogger.info({ blobId }, 'Blob uploaded to Walrus');
      return { blobId };
    } catch (error) {
      walrusOperationsCounter.add(1, { operation: 'upload', success: 'false' });
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async fetchBlobMetadata(blobId: string): Promise<Record<string, unknown>> {
    const span = tracer.startSpan('walrus.fetchBlobMetadata');
    try {
      const result = await walrusCircuitBreaker.execute(async () => {
        const response = await fetch(`${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`);
        if (!response.ok) throw new Error(`Walrus fetch failed: ${response.status}`);
        return response.json() as Promise<Record<string, unknown>>;
      });
      walrusOperationsCounter.add(1, { operation: 'fetch', success: 'true' });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      walrusOperationsCounter.add(1, { operation: 'fetch', success: 'false' });
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async initMemorySpace(): Promise<{ spaceId: string }> {
    const span = tracer.startSpan('walrus.initMemorySpace');
    try {
      const spaceId = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      span.setStatus({ code: SpanStatusCode.OK });
      wLogger.info({ spaceId: spaceId.slice(0, 16) }, 'Memory space initialized');
      return { spaceId: spaceId.slice(0, 64) };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async writeMemoryEntry(spaceId: string, entry: { content: string; metadata: Record<string, unknown> }): Promise<void> {
    const span = tracer.startSpan('walrus.writeMemoryEntry');
    try {
      await walrusCircuitBreaker.execute(async () => {
        if (!memwal) return;
        await memwal.rememberAndWait(JSON.stringify(entry), spaceId, { timeoutMs: 30000 });
      });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async searchMemory(spaceId: string, query: string): Promise<Array<{ content: string; timestamp: string }>> {
    const span = tracer.startSpan('walrus.searchMemory');
    try {
      if (!memwal) {
        span.setAttribute('bondflow.memwal.configured', false);
        span.setStatus({ code: SpanStatusCode.OK });
        return [];
      }
      const result = await walrusCircuitBreaker.execute(() =>
        memwal.recall({ query: query || 'relationship memory', topK: 10, namespace: spaceId }),
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result.results.map((memory) => ({
        content: memory.text,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async createAttestationSpace(): Promise<{ spaceId: string }> {
    return this.initMemorySpace();
  }

  getCircuitState(): string {
    return walrusCircuitBreaker.getState();
  }
}

export const walrusService = new WalrusService();
