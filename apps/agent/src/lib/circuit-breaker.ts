/**
 * Generic circuit breaker implementation.
 * 
 * States:
 * - CLOSED: Normal operation. Requests pass through. Failures are counted.
 * - OPEN: Circuit is tripped. All requests fail fast with CircuitOpenError.
 * - HALF_OPEN: After reset timeout, allows one probe request through.
 *   On success → CLOSED. On failure → OPEN.
 * 
 * Used to wrap Walrus service and MemWal SDK calls to prevent
 * cascading failures when external services are down.
 */

import { logger } from './logger';
import { tracer, SpanStatusCode } from '../tracing';

const cbLogger = logger.child({ module: 'circuit-breaker' });

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly state: CircuitState;

  constructor(circuitName: string) {
    super(`Circuit breaker "${circuitName}" is OPEN. Failing fast.`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.state = CircuitState.OPEN;
  }
}

export interface CircuitBreakerOptions {
  /** Name for logging and tracing */
  name: string;
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  /**
   * Execute a function through the circuit breaker.
   * 
   * - CLOSED: Runs fn normally. On failure, increments failure count.
   *   If failure count reaches threshold, transitions to OPEN.
   * - OPEN: Throws CircuitOpenError immediately. If reset timeout has
   *   elapsed, transitions to HALF_OPEN instead.
   * - HALF_OPEN: Allows one probe request. On success → CLOSED.
   *   On failure → OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const span = tracer.startSpan('circuit-breaker.execute', {
      attributes: {
        'bondflow.circuit.name': this.name,
        'bondflow.circuit.state': this.state,
        'bondflow.circuit.failure_count': this.failureCount,
      },
    });

    try {
      if (this.state === CircuitState.OPEN) {
        // Check if reset timeout has elapsed
        if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
          this.transitionTo(CircuitState.HALF_OPEN);
        } else {
          span.setAttribute('bondflow.circuit.action', 'fail_fast');
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Circuit is OPEN' });
          throw new CircuitOpenError(this.name);
        }
      }

      const result = await fn();

      // Success — reset circuit
      if (this.state === CircuitState.HALF_OPEN) {
        cbLogger.info({ name: this.name }, 'Circuit breaker probe succeeded, closing circuit');
      }
      this.reset();
      span.setAttribute('bondflow.circuit.action', 'success');
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        span.end();
        throw error;
      }

      this.recordFailure();
      span.recordException(error as Error);
      span.setAttribute('bondflow.circuit.action', 'failure');
      span.setAttribute('bondflow.circuit.failure_count', this.failureCount);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get the current circuit state (for monitoring/health checks).
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get the current failure count.
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Probe failed — reopen
      this.transitionTo(CircuitState.OPEN);
      cbLogger.warn({ name: this.name }, 'Circuit breaker probe failed, reopening circuit');
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
      cbLogger.error(
        { name: this.name, failureCount: this.failureCount, threshold: this.failureThreshold },
        'Circuit breaker opened after reaching failure threshold',
      );
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.transitionTo(CircuitState.CLOSED);
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      cbLogger.info(
        { name: this.name, from: this.state, to: newState },
        'Circuit breaker state transition',
      );
      this.state = newState;
    }
  }
}
