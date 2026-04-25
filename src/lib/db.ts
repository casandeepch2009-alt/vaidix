// ════════════════════════════════════════════════════════════════════════════
// Prisma Client Singleton
// ════════════════════════════════════════════════════════════════════════════
// Pattern: one PrismaClient per process (not per request).
// In dev, Next.js hot-reload would spawn multiple clients without the global cache.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export type { PrismaClient } from '@prisma/client';
