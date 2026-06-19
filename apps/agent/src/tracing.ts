/**
 * OpenTelemetry bootstrap module.
 * 
 * CRITICAL: This file MUST be imported FIRST in src/index.ts — before Prisma,
 * before Elysia, before any SDK. OTel instrumentation hooks must be in place
 * before the instrumented libraries are loaded.
 * 
 * Initializes:
 * - Trace SDK with OTLP HTTP exporter and auto-instrumentations
 * - Metrics SDK with OTLP HTTP exporter
 * - Resource attributes for service identification
 * - Configurable sampling ratio (100% in dev, configurable in prod)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';
import {
  trace,
  metrics,
  type Tracer,
  type Meter,
  type Counter,
  type Histogram,
  type ObservableGauge,
  SpanStatusCode,
} from '@opentelemetry/api';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { env } from './config/env';

const OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT;
const METRICS_ENDPOINT = env.OTEL_METRICS_ENDPOINT;
const SAMPLE_RATE = env.NODE_ENV === 'development' ? 1 : env.OTEL_SAMPLE_RATE;
const SERVICE_VERSION = env.SERVICE_VERSION;
const NODE_ENV = env.NODE_ENV;
const OTEL_ENABLED = env.OTEL_ENABLED;

let sdk: NodeSDK | null = null;

if (OTEL_ENABLED) {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'bondflow-agent',
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: NODE_ENV,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${METRICS_ENDPOINT}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30000,
  });

  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(SAMPLE_RATE),
  });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    metricReader,
    sampler,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  // Start the SDK — must happen before any instrumented library is imported
  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}

// ============================================================
// Exported Tracer and Meter instances
// ============================================================

export const tracer: Tracer = trace.getTracer('bondflow-agent', SERVICE_VERSION);
export const meter: Meter = metrics.getMeter('bondflow-agent', SERVICE_VERSION);

// ============================================================
// Pre-defined Metrics (from spec)
// ============================================================

/** Total API requests counter */
export const apiRequestsCounter: Counter = meter.createCounter('bondflow.api.requests.total', {
  description: 'Total number of API requests',
});

/** Total AI agent invocations counter */
export const agentInvocationsCounter: Counter = meter.createCounter('bondflow.agent.invocations.total', {
  description: 'Total number of AI agent invocations',
});

/** AI agent duration histogram */
export const agentDurationHistogram: Histogram = meter.createHistogram('bondflow.agent.duration.ms', {
  description: 'AI agent invocation duration in milliseconds',
  unit: 'ms',
});

/** Total AI tokens counter */
export const agentTokensCounter: Counter = meter.createCounter('bondflow.agent.tokens.total', {
  description: 'Total AI tokens consumed',
});

/** BullMQ queue failed jobs counter */
export const queueFailedCounter: Counter = meter.createCounter('bondflow.queue.failed.total', {
  description: 'Total number of failed queue jobs',
});

/** Walrus operations counter */
export const walrusOperationsCounter: Counter = meter.createCounter('bondflow.walrus.operations.total', {
  description: 'Total Walrus storage operations',
});

/** Sui transactions counter */
export const suiTransactionsCounter: Counter = meter.createCounter('bondflow.sui.transactions.total', {
  description: 'Total Sui blockchain transactions',
});

/** Sui gas counter */
export const suiGasCounter: Counter = meter.createCounter('bondflow.sui.gas.total', {
  description: 'Total Sui gas consumed',
});

/**
 * BullMQ queue depth observable gauge.
 * The callback is registered during worker initialization to read live queue depths.
 */
export const queueDepthGauge: ObservableGauge = meter.createObservableGauge('bondflow.queue.depth', {
  description: 'Current depth of BullMQ queues',
});

// Re-export for convenience
export { SpanStatusCode };
export { trace, metrics, context } from '@opentelemetry/api';
