/**
 * Auth routes — wallet-based authentication with signature challenge-response.
 */

import { Elysia, t } from 'elysia';
import { jwtService } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth.middleware';
import { checkRateLimit, setRateLimitHeaders, RateLimitTier } from '../lib/rate-limiter';
import { logger } from '../lib/logger';
import { WalletAddressSchema } from '@bondflow/types';
import { authManagementService } from '../services/auth-management';

const authLogger = logger.child({ module: 'routes.auth' });
const REFRESH_COOKIE = 'bondflow_refresh_token';

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';').map((part) => part.trim());
  for (const pair of pairs) {
    const [key, ...value] = pair.split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function refreshCookie(token: string): string {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  return `${REFRESH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

function clearRefreshCookie(): string {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  return `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .use(authMiddleware)

  .get('/nonce/:walletAddress', async ({ params, set, request }) => {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await checkRateLimit(ip, RateLimitTier.AUTH);
    setRateLimitHeaders((set.headers ?? {}) as Record<string, string>, rl);
    if (!rl.allowed) { set.status = 429; return { error: 'Rate limit exceeded', retryAfter: rl.retryAfter }; }

    const parsed = WalletAddressSchema.safeParse(params.walletAddress);
    if (!parsed.success) { set.status = 400; return { error: 'Invalid wallet address' }; }

    return authManagementService.issueNonce(parsed.data);
  })

  .post('/verify', async ({ body, set, request }) => {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await checkRateLimit(ip, RateLimitTier.AUTH);
    if (!rl.allowed) { set.status = 429; return { error: 'Rate limit exceeded' }; }

    const parsed = WalletAddressSchema.safeParse(body.walletAddress);
    if (!parsed.success) { set.status = 400; return { error: 'Invalid wallet address' }; }

    const result = await authManagementService.verifyWallet({ walletAddress: parsed.data, signature: body.signature, message: body.message });
    if ('notFound' in result) { set.status = 404; return { error: 'User not found. Request a nonce first.' }; }
    if ('invalidNonce' in result) { set.status = 401; return { error: 'Invalid nonce in message' }; }
    if ('expiredNonce' in result) { set.status = 401; return { error: 'Nonce expired — please request a new one and sign again.' }; }
    if ('invalidSignature' in result) { set.status = 401; return { error: 'Invalid wallet signature' }; }
    set.headers['Set-Cookie'] = refreshCookie(result.refreshToken);
    authLogger.info({ wallet: parsed.data }, 'User authenticated');
    return { accessToken: result.accessToken, user: result.user };
  }, {
    body: t.Object({ walletAddress: t.String(), signature: t.String(), message: t.String() }),
  })

  .post('/refresh', async ({ body, request, set }) => {
    try {
      const token = body?.refreshToken ?? cookieValue(request.headers.get('cookie'), REFRESH_COOKIE);
      if (!token) {
        set.status = 401;
        return { error: 'Missing refresh token' };
      }
      const result = await jwtService.rotateRefreshToken(token);
      set.headers['Set-Cookie'] = refreshCookie(result.refreshToken);
      return {
        accessToken: result.accessToken,
        user: {
          id: result.userId,
          walletAddress: result.walletAddress,
          isPlatformAdmin: result.isPlatformAdmin,
        },
      };
    } catch (error) {
      set.status = 401;
      set.headers['Set-Cookie'] = clearRefreshCookie();
      return { error: (error as Error).message };
    }
  }, {
    body: t.Optional(t.Object({ refreshToken: t.Optional(t.String()) })),
  })

  .post('/logout', async ({ auth, body, request, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const token = body?.refreshToken ?? cookieValue(request.headers.get('cookie'), REFRESH_COOKIE);
    if (token) await jwtService.revokeRefreshToken(token);
    set.headers['Set-Cookie'] = clearRefreshCookie();
    return { message: 'Logged out' };
  }, {
    body: t.Optional(t.Object({ refreshToken: t.Optional(t.String()) })),
  });
