/**
 * Authentication middleware.
 * Verifies JWT from Authorization: Bearer header using dual-key JwtService.
 * Attaches resolved auth context to Elysia store via derive().
 * 
 * Pattern: use as .use(authMiddleware) then access ctx.auth in handlers.
 */

import { Elysia } from 'elysia';
import { jwtService } from '../lib/jwt';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { isConfiguredPlatformAdmin } from '../lib/platform-admin';

const authLogger = logger.child({ module: 'auth-middleware' });

export interface AuthUser {
  userId: string;
  walletAddress: string;
  isPlatformAdmin: boolean;
}

/**
 * Derives `auth` from the Authorization header.
 * Routes that call .use(authMiddleware) get `auth` (AuthUser | null) in context.
 */
export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive({ as: 'global' }, async ({ request }): Promise<{ auth: AuthUser | null }> => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { auth: null };
    }

    const token = authHeader.slice(7);
    try {
      const payload = await jwtService.verify(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return { auth: null };

      return {
        auth: {
          userId: user.id,
          walletAddress: user.walletAddress,
          isPlatformAdmin: isConfiguredPlatformAdmin(user.walletAddress),
        },
      };
    } catch {
      authLogger.debug('Token verification failed');
      return { auth: null };
    }
  });

/**
 * Guard hook that requires auth to be present.
 * Use as .use(requireAuth) after .use(authMiddleware).
 */
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(authMiddleware)
  .macro({
    auth: (enabled: boolean) => ({
      beforeHandle(ctx: unknown) {
        const { auth, set } = ctx as { auth: AuthUser | null; set: { status: number | string } };
        if (enabled && !auth) {
          set.status = 401;
          return { error: 'Unauthorized', message: 'Authentication required', statusCode: 401 };
        }
        return undefined;
      },
    }),
  });
