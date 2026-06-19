/**
 * Structured logging with Pino + OpenTelemetry trace ID injection.
 * 
 * Every log entry automatically includes the current OTel trace ID and span ID,
 * correlating logs to distributed traces in the observability backend.
 * 
 * IMPORTANT: Use this logger everywhere — never use console.log.
 */

import pino from 'pino';
import { context, trace } from '@opentelemetry/api';
import { env } from '../config/env';

/**
 * Pino mixin that injects OTel trace context into every log entry.
 * This enables log-to-trace correlation in Grafana/Jaeger/etc.
 */
function otelMixin(): Record<string, string | undefined> {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: `0${spanContext.traceFlags.toString(16)}`,
    };
  }
  return {};
}

/**
 * Root logger instance.
 * - Production: JSON output for machine parsing
 * - Development: Pretty-printed for human readability
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  mixin: otelMixin,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Creates a child logger with bound context fields.
 * Use this to add request-scoped context (e.g., correlationId, tenantId, wallet).
 * 
 * @example
 * const reqLogger = createChildLogger({ correlationId: 'abc-123', tenantId: 'tenant-1' });
 * reqLogger.info('Processing request');
 */
export function createChildLogger(bindings: Record<string, string | number | boolean | undefined>): pino.Logger {
  return logger.child(bindings);
}

export type Logger = pino.Logger;
