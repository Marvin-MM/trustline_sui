/**
 * Correlation ID middleware.
 * Generates or extracts X-Correlation-ID, attaches to context and response.
 */

import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { trace, context } from '@opentelemetry/api';

export const correlationMiddleware = new Elysia({ name: 'correlation-middleware' })
  .derive(({ request }) => {
    const correlationId = request.headers.get('x-correlation-id') ?? randomUUID();
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.setAttribute('bondflow.correlation_id', correlationId);
    }
    return { correlationId };
  })
  .onAfterHandle(({ correlationId, set }) => {
    if (set.headers) {
      (set.headers as Record<string, string>)['X-Correlation-ID'] = correlationId;
    }
  });
