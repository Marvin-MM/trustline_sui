/**
 * Webhook routes with full replay attack prevention.
 * HMAC-SHA256 signature verification, timestamp validation, nonce dedup.
 */

import { Elysia } from 'elysia';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { timingSafeEqual } from 'crypto';
import { webhookManagementService } from '../services/webhook-management';

const whLogger = logger.child({ module: 'routes.webhooks' });

export const webhookRoutes = new Elysia({ prefix: '/api/v1/webhooks' })
  .post('/transaction-result', async ({ request, set }) => {
    const signature = request.headers.get('x-bondflow-signature');
    const timestamp = request.headers.get('x-bondflow-timestamp');

    if (!signature || !timestamp) {
      set.status = 400;
      return { error: 'Missing signature or timestamp headers' };
    }

    // Timestamp validation — reject if > 5 minutes old
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      set.status = 400;
      return { error: 'Request timestamp too old or too far in the future' };
    }

    const bodyText = await request.text();

    // HMAC-SHA256 verification
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${bodyText}`));
    const expectedSig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const expected = Buffer.from(expectedSig, 'hex');
    const actual = Buffer.from(signature, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      whLogger.warn('Webhook signature mismatch');
      set.status = 401;
      return { error: 'Invalid signature' };
    }

    const result = await webhookManagementService.processTransactionResult(signature, ts, bodyText);
    if ('duplicate' in result) {
      whLogger.debug({ signature: signature.slice(0, 16) }, 'Duplicate webhook — idempotent response');
      return { message: 'Already processed' };
    }
    if ('invalidJson' in result) { set.status = 400; return { error: 'Invalid JSON body' }; }
    if ('invalidBody' in result) { set.status = 400; return { error: 'Invalid webhook body', details: result.invalidBody }; }

    whLogger.info({ digest: result.transactionDigest }, 'Webhook processed');
    return { message: 'Processed', transactionDigest: result.transactionDigest };
  });
