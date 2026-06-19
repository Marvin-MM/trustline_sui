import { parseSerializedSignature } from '@mysten/sui/cryptography';
import { prisma } from '../db/client';
import { jwtService } from '../lib/jwt';
import { isConfiguredPlatformAdmin } from '../lib/platform-admin';
import { logger } from '../lib/logger';
import { suiClient } from '../lib/sui-client';
import {
  canonicalAuthMessage,
  canonicalWalletAddress,
  verifyWalletPersonalMessage,
} from '../lib/wallet-signature';

const authLogger = logger.child({ module: 'services.auth-management' });

function signatureScheme(signature: string): string {
  try {
    return parseSerializedSignature(signature).signatureScheme;
  } catch {
    return 'unparseable';
  }
}

export class AuthManagementService {
  async issueNonce(walletAddress: string) {
    const normalizedWalletAddress = canonicalWalletAddress(walletAddress);
    const nonce = crypto.randomUUID();
    const isPlatformAdmin = isConfiguredPlatformAdmin(normalizedWalletAddress);

    await prisma.user.upsert({
      where: { walletAddress: normalizedWalletAddress },
      update: { nonce, isPlatformAdmin },
      create: { walletAddress: normalizedWalletAddress, nonce, isPlatformAdmin },
    });
    return {
      nonce,
      message: canonicalAuthMessage(nonce),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async verifyWallet(body: { walletAddress: string; signature: string; message: string }) {
    const walletAddress = canonicalWalletAddress(body.walletAddress);
    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) return { notFound: true as const };
    if (body.message !== canonicalAuthMessage(user.nonce)) return { invalidNonce: true as const };
    // Nonce expires 10 minutes after issue (updatedAt is set by issueNonce's upsert)
    const nonceAgeMs = Date.now() - user.updatedAt.getTime();
    if (nonceAgeMs > 10 * 60 * 1000) return { expiredNonce: true as const };

    try {
      await verifyWalletPersonalMessage({
        walletAddress,
        signature: body.signature,
        message: body.message,
        client: suiClient,
      });
    } catch (error) {
      authLogger.warn({
        wallet: walletAddress,
        signatureScheme: signatureScheme(body.signature),
        err: error,
      }, 'Wallet signature verification failed');
      return { invalidSignature: true as const };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        nonce: crypto.randomUUID(),
        lastLoginAt: new Date(),
        isPlatformAdmin: isConfiguredPlatformAdmin(user.walletAddress),
      },
    });

    const accessToken = await jwtService.sign(user.id, walletAddress);
    const refreshToken = await jwtService.createRefreshToken(user.id);
    const isPlatformAdmin = isConfiguredPlatformAdmin(walletAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        walletAddress,
        displayName: user.displayName,
        isPlatformAdmin,
      },
    };
  }
}

export const authManagementService = new AuthManagementService();
