/**
 * JWT service with dual-key verification and refresh token rotation.
 * Supports seamless key rotation: JWT_SECRET_CURRENT and JWT_SECRET_PREVIOUS.
 */

import * as jose from 'jose';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { logger } from './logger';
import { randomUUID } from 'crypto';
import { isConfiguredPlatformAdmin } from './platform-admin';

const jwtLogger = logger.child({ module: 'jwt' });

interface JwtPayload {
  sub: string; // userId
  wallet: string; // walletAddress
  iat: number;
  exp: number;
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

export class JwtService {
  private readonly currentKey: Uint8Array;
  private readonly previousKey: Uint8Array;
  private readonly accessExpirySeconds: number;
  private readonly refreshExpirySeconds: number;

  constructor() {
    this.currentKey = new TextEncoder().encode(env.JWT_SECRET_CURRENT);
    this.previousKey = new TextEncoder().encode(env.JWT_SECRET_PREVIOUS);
    this.accessExpirySeconds = parseExpiry(env.JWT_ACCESS_EXPIRY);
    this.refreshExpirySeconds = parseExpiry(env.JWT_REFRESH_EXPIRY);
  }

  /** Sign a new access token using the CURRENT key. */
  async sign(userId: string, walletAddress: string): Promise<string> {
    return new jose.SignJWT({ sub: userId, wallet: walletAddress })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${this.accessExpirySeconds}s`)
      .setIssuer('bondflow-agent')
      .sign(this.currentKey);
  }

  /** Verify a token — tries current key first, falls back to previous. */
  async verify(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jose.jwtVerify(token, this.currentKey, { issuer: 'bondflow-agent' });
      return payload as unknown as JwtPayload;
    } catch {
      try {
        const { payload } = await jose.jwtVerify(token, this.previousKey, { issuer: 'bondflow-agent' });
        jwtLogger.debug('Token verified with previous key (rotation in progress)');
        return payload as unknown as JwtPayload;
      } catch {
        throw new Error('Invalid or expired token');
      }
    }
  }

  /** Create a refresh token record in the database. */
  async createRefreshToken(userId: string, familyId?: string): Promise<string> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshExpirySeconds * 1000);
    const family = familyId
      ? { id: familyId }
      : await prisma.refreshTokenFamily.create({ data: { userId } });
    await prisma.refreshToken.create({ data: { userId, familyId: family.id, token, expiresAt } });
    return token;
  }

  /**
   * Rotate a refresh token: revoke old, issue new in the same token family.
   * Reuse detection marks the account as suspicious and revokes the affected family.
   */
  async rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; userId: string; walletAddress: string; isPlatformAdmin: boolean }> {
    const existing = await prisma.refreshToken.findUnique({
      where: { token: oldToken },
      include: { user: true, family: true },
    });

    if (!existing) throw new Error('Invalid refresh token');
    if (existing.family.compromisedAt) {
      throw new Error('Refresh token family is compromised — re-authentication required');
    }

    if (existing.revokedAt) {
      jwtLogger.error({ userId: existing.userId, familyId: existing.familyId }, 'Refresh token reuse detected');
      await prisma.$transaction([
        prisma.refreshTokenFamily.update({
          where: { id: existing.familyId },
          data: { compromisedAt: new Date() },
        }),
        prisma.refreshToken.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: existing.userId },
          data: { compromisedAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            actorUserId: existing.userId,
            actorWallet: existing.user.walletAddress,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
            targetType: 'RefreshTokenFamily',
            targetId: existing.familyId,
            metadata: { reusedTokenId: existing.id },
          },
        }),
      ]);
      throw new Error('Refresh token reuse detected — session family revoked');
    }

    if (existing.expiresAt < new Date()) {
      throw new Error('Refresh token expired');
    }

    // Atomically revoke old and create new. updateMany makes concurrent reuse visible.
    const newRefreshToken = await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        await tx.refreshTokenFamily.update({
          where: { id: existing.familyId },
          data: { compromisedAt: new Date() },
        });
        await tx.refreshToken.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.user.update({
          where: { id: existing.userId },
          data: { compromisedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: existing.userId,
            actorWallet: existing.user.walletAddress,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
            targetType: 'RefreshTokenFamily',
            targetId: existing.familyId,
            metadata: { reusedTokenId: existing.id, reason: 'concurrent_or_replayed_refresh' },
          },
        });
        throw new Error('Refresh token reuse detected — session family revoked');
      }
      return tx.refreshToken.create({
        data: {
          userId: existing.userId,
          familyId: existing.familyId,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + this.refreshExpirySeconds * 1000),
        },
      });
    });

    const accessToken = await this.sign(existing.userId, existing.user.walletAddress);

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
      userId: existing.userId,
      walletAddress: existing.user.walletAddress,
      isPlatformAdmin: isConfiguredPlatformAdmin(existing.user.walletAddress),
    };
  }

  /** Revoke a single refresh token (logout). */
  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const jwtService = new JwtService();
