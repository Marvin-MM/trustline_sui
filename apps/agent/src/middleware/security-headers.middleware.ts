/**
 * Security headers middleware.
 * Sets defense-in-depth HTTP security headers on all responses.
 */

import { Elysia } from 'elysia';

export const securityHeadersMiddleware = new Elysia({ name: 'security-headers' })
  .onAfterHandle(({ set }) => {
    const h = (set.headers ?? {}) as Record<string, string>;
    h['X-Content-Type-Options'] = 'nosniff';
    h['X-Frame-Options'] = 'DENY';
    h['X-XSS-Protection'] = '1; mode=block';
    h['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    h['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()';
    set.headers = h;
  });
