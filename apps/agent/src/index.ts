/**
 * BondFlow Agent Backend — Application Entry Point
 *
 * CRITICAL: tracing.ts MUST be imported FIRST — before any other module.
 * This ensures OpenTelemetry instrumentation hooks are in place before
 * the instrumented libraries (Prisma, fetch, ioredis) are loaded.
 */

// === OTel bootstrap — MUST be first ===
import './tracing';

// === Configuration (validates env vars — crashes on missing) ===
import { env } from './config/env';

// === Framework ===
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { opentelemetry } from '@elysiajs/opentelemetry';

// === Middleware ===
import { securityHeadersMiddleware } from './middleware/security-headers.middleware';
import { correlationMiddleware } from './middleware/correlation.middleware';

// === Routes ===
import { authRoutes } from './routes/auth';
import { tenantRoutes } from './routes/tenants';
import { relationshipRoutes } from './routes/relationships';
import { deliverableRoutes } from './routes/deliverables';
import { memoryRoutes } from './routes/memory';
import { reputationRoutes } from './routes/reputation';
import { webhookRoutes } from './routes/webhooks';
import { transactionRoutes } from './routes/transactions';
import { featureFlagRoutes } from './routes/feature-flags';
import { notificationRoutes } from './routes/notifications';
import { healthRoutes } from './routes/health';
import { adminRoutes } from './routes/admin';

// === Infrastructure ===
import { disconnectPrisma } from './db/client';
import { disconnectRedis } from './lib/redis-client';
import { logger } from './lib/logger';
import { apiRequestsCounter, shutdownTracing } from './tracing';
import { suiClient } from './lib/sui-client';
import { assertPaymentAssetConfiguration } from './lib/payment-asset';
import { assertContractConfiguration } from './lib/contract-config';
import { bootstrapOperationalDefaults } from './services/default-bootstrap';

const appLogger = logger.child({ module: 'app' });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function isNotFoundError(code: unknown, error: unknown): boolean {
  const message = errorMessage(error);
  return code === 'NOT_FOUND'
    || message === 'NOT_FOUND'
    || message.includes('NOT_FOUND')
    || message.toLowerCase().includes('not found');
}

function isClientError(code: unknown): boolean {
  return code === 'VALIDATION'
    || code === 'PARSE'
    || code === 'INVALID_COOKIE_SIGNATURE';
}

// ============================================================
// Application Setup
// ============================================================

const app = new Elysia()
  // OpenAPI documentation at /docs
  .use(swagger({
    path: '/docs',
    specPath: '/docs/json',
    documentation: {
      info: {
        title: 'BondFlow Agent API',
        version: env.SERVICE_VERSION,
        description: 'Production-grade, multi-tenant, ACID-compliant financial platform backend for BondFlow.',
      },
      tags: [
        { name: 'Auth', description: 'Wallet-based authentication' },
        { name: 'Tenants', description: 'Multi-tenant management' },
        { name: 'Relationships', description: 'Payment relationship lifecycle' },
        { name: 'Deliverables', description: 'File upload and verification' },
        { name: 'Memory', description: 'Walrus MemWal memory entries' },
        { name: 'Reputation', description: 'On-chain reputation proofs' },
        { name: 'Webhooks', description: 'Transaction result webhooks' },
        { name: 'Health', description: 'Service health checks' },
        { name: 'Admin', description: 'Platform administration' },
      ],
    },
  }))

  // CORS — never *
  .use(cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Correlation-ID', 'X-BondFlow-Signature', 'X-BondFlow-Timestamp'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }))

  // OpenTelemetry HTTP tracing
  .use(opentelemetry())

  // Security headers on all responses
  .use(securityHeadersMiddleware)

  // Correlation ID propagation
  .use(correlationMiddleware)

  // Global error handler
  .onAfterHandle((ctx) => {
    const tenantId = 'tenantContext' in ctx
      ? (ctx.tenantContext as { tenantId?: string | null }).tenantId
      : null;
    apiRequestsCounter.add(1, {
      route: ctx.path,
      method: ctx.request.method,
      status_code: String(ctx.set.status ?? 200),
      tenant_id: tenantId ?? 'personal',
    });
  })

  // Global error handler
  .onError(({ code, error, path, request, set }) => {
    const message = errorMessage(error);

    if (isNotFoundError(code, error)) {
      set.status = 404;
      appLogger.info(
        { code, path, method: request.method },
        'Route not found',
      );
      return {
        error: 'Not Found',
        message: `No route registered for ${request.method} ${path}`,
        statusCode: 404,
      };
    }

    if (isClientError(code)) {
      set.status = code === 'INVALID_COOKIE_SIGNATURE' ? 401 : 400;
      appLogger.warn({ code, path, method: request.method, error: message }, 'Request rejected');
      return {
        error: set.status === 401 ? 'Unauthorized' : 'Bad Request',
        message,
        statusCode: set.status,
      };
    }

    appLogger.error({ code, path, method: request.method, error: message, stack: errorStack(error) }, 'Unhandled server error');

    set.status = 500;
    return {
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : message,
      statusCode: 500,
    };
  })

  // === Mount Routes ===
  .use(healthRoutes)
  .use(authRoutes)
  .use(webhookRoutes)
  .use(tenantRoutes)
  .use(relationshipRoutes)
  .use(featureFlagRoutes)
  .use(notificationRoutes)
  .use(deliverableRoutes)
  .use(memoryRoutes)
  .use(reputationRoutes)
  .use(transactionRoutes)
  .use(adminRoutes);

function canUseDevelopmentPortFallback(): boolean {
  return env.NODE_ENV !== 'production' && env.EXTERNAL_SERVICES_MODE === 'mock';
}

async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const probe = Bun.serve({
      port,
      hostname: env.HOST,
      fetch: () => new Response('ok'),
    });
    await probe.stop(true);
    return true;
  } catch {
    return false;
  }
}

async function selectPort(): Promise<number> {
  if (!canUseDevelopmentPortFallback()) {
    return env.PORT;
  }

  if (await isPortAvailable(env.PORT)) {
    return env.PORT;
  }

  for (let offset = 1; offset <= 20; offset += 1) {
    const fallbackPort = env.PORT + offset;
    if (await isPortAvailable(fallbackPort)) {
      appLogger.warn(
        { configuredPort: env.PORT, activePort: fallbackPort },
        'Configured port was already in use; selected the next available development port',
      );
      return fallbackPort;
    }
  }

  return env.PORT;
}

await Promise.all([
  assertPaymentAssetConfiguration((coinType) => suiClient.getCoinMetadata({ coinType })),
  assertContractConfiguration((id) => suiClient.getObject({
    id,
    options: { showType: true, showOwner: true },
  }), (packageId) => suiClient.getNormalizedMoveModulesByPackage({ package: packageId })),
]);
await bootstrapOperationalDefaults();
const activePort = await selectPort();
app.listen({ port: activePort, hostname: env.HOST });
appLogger.info(
  { port: activePort, configuredPort: env.PORT, host: env.HOST, env: env.NODE_ENV, version: env.SERVICE_VERSION },
  `🚀 BondFlow Agent is running at http://${env.HOST}:${activePort}`,
);
appLogger.info(`📚 API docs available at http://${env.HOST}:${activePort}/docs`);

// ============================================================
// Start Background Workers
// ============================================================

const workers: Array<{ stop?: () => void | Promise<void>; close?: () => Promise<void> }> = [];
let eventWatcherInstance: { start: () => Promise<void>; stop: () => void | Promise<void> } | null = null;
let outboxWorkerInstance: { start: () => void; stop: () => void } | null = null;
let schedulerInstance: { start: () => void; stop: () => void } | null = null;

try {
  if (env.START_WORKERS) {
    const [
      eventWatcherModule,
      blockchainWorkerModule,
      aiWorkerModule,
      notificationsWorkerModule,
      outboxWorkerModule,
      schedulerModule,
    ] = await Promise.all([
      import('./workers/event-watcher'),
      import('./workers/blockchain-events.worker'),
      import('./workers/ai-pipeline.worker'),
      import('./workers/notifications.worker'),
      import('./workers/outbox.worker'),
      import('./workers/scheduler'),
    ]);

    eventWatcherInstance = eventWatcherModule.eventWatcher;
    outboxWorkerInstance = outboxWorkerModule.outboxWorker;
    schedulerInstance = schedulerModule.scheduler;

    await eventWatcherInstance.start();

    const bcWorker = blockchainWorkerModule.startBlockchainEventsWorker();
    const aiWorker = aiWorkerModule.startAiPipelineWorker();
    const notifWorker = notificationsWorkerModule.startNotificationsWorker();
    workers.push(bcWorker, aiWorker, notifWorker);

    outboxWorkerInstance.start();
    schedulerInstance.start();

    appLogger.info('All background workers started');
  } else {
    appLogger.warn({ externalServicesMode: env.EXTERNAL_SERVICES_MODE }, 'Background workers disabled by START_WORKERS=false');
  }
} catch (error) {
  appLogger.error({ error: (error as Error).message }, 'Failed to start background workers');
}

// ============================================================
// Graceful Shutdown
// ============================================================

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  appLogger.info({ signal }, 'Shutdown signal received');

  try {
    await Promise.resolve(app.stop());
  } catch (error) {
    const message = (error as Error).message;
    if (!message.includes("Elysia isn't running")) {
      appLogger.warn({ error: message }, 'HTTP server shutdown warning');
    }
  }

  await eventWatcherInstance?.stop();
  outboxWorkerInstance?.stop();
  schedulerInstance?.stop();

  for (const worker of workers) {
    try {
      if (worker.close) await worker.close();
    } catch (e) {
      appLogger.error({ error: (e as Error).message }, 'Worker shutdown error');
    }
  }

  await disconnectPrisma();
  await disconnectRedis();
  await shutdownTracing();

  appLogger.info('Shutdown complete');
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

export { app };
