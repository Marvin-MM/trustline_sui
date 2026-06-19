import { prisma } from '../db/client';
import { redis } from '../lib/redis-client';
import { suiClient } from '../lib/sui-client';
import { walrusService } from './walrus';
import { env } from '../config/env';

export class HealthChecksService {
  basic() {
    return {
      status: 'ok',
      service: 'bondflow-agent',
      version: env.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  async detailed() {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks['postgresql'] = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (e) {
      checks['postgresql'] = { status: 'error', error: (e as Error).message, latencyMs: Date.now() - dbStart };
    }

    const redisStart = Date.now();
    try {
      await redis.ping();
      checks['redis'] = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (e) {
      checks['redis'] = { status: 'error', error: (e as Error).message, latencyMs: Date.now() - redisStart };
    }

    if (env.EXTERNAL_SERVICES_MODE === 'live') {
      const suiStart = Date.now();
      try {
        await suiClient.getLatestCheckpointSequenceNumber();
        checks['sui_rpc'] = { status: 'ok', latencyMs: Date.now() - suiStart };
      } catch (e) {
        checks['sui_rpc'] = { status: 'error', error: (e as Error).message, latencyMs: Date.now() - suiStart };
      }
    } else {
      checks['sui_rpc'] = { status: 'mocked' };
    }

    checks['walrus'] = { status: walrusService.getCircuitState() === 'CLOSED' ? 'ok' : 'degraded' };

    const allOk = Object.values(checks).every((check) => check.status === 'ok' || check.status === 'mocked');
    return {
      status: allOk ? 'healthy' : 'degraded',
      service: 'bondflow-agent',
      version: env.SERVICE_VERSION,
      environment: env.NODE_ENV,
      externalServicesMode: env.EXTERNAL_SERVICES_MODE,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

export const healthChecksService = new HealthChecksService();
