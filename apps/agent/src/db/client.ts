/**
 * Prisma database client singleton.
 * 
 * Provides a single shared PrismaClient instance across the application.
 * Handles graceful shutdown to close database connections.
 * 
 * IMPORTANT: Never instantiate PrismaClient directly — always import from this module.
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client.
 * In development, stores the client on globalThis to survive HMR reloads.
 * In production, creates a single instance.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnects the Prisma client.
 * Called during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
