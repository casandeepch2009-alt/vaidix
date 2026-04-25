// ════════════════════════════════════════════════════════════════════════════
// Auth Service — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Password verification, account lockout, login rate-limit.
// NEVER import from client code. Business rules live here, not in frontend.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { UserStatus, type User } from '@prisma/client';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  status: UserStatus;
  passwordVersion: number;
}

export type AuthFailureReason =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DEACTIVATED'
  | 'ACCOUNT_PENDING';

export type AuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: AuthFailureReason; lockedUntil?: Date };

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    // Constant-time artificial work to prevent email enumeration via timing
    await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, reason: 'ACCOUNT_LOCKED', lockedUntil: user.lockedUntil };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);

  if (!passwordOk) {
    await registerFailedAttempt(user.id);
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  switch (user.status) {
    case UserStatus.PENDING_INVITE:
      return { ok: false, reason: 'ACCOUNT_PENDING' };
    case UserStatus.SUSPENDED:
      return { ok: false, reason: 'ACCOUNT_SUSPENDED' };
    case UserStatus.DEACTIVATED:
      return { ok: false, reason: 'ACCOUNT_DEACTIVATED' };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      passwordVersion: user.passwordVersion,
    },
  };
}

async function registerFailedAttempt(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true },
  });
  if (!user) return;

  const nextCount = user.failedLoginCount + 1;
  const shouldLock = nextCount >= MAX_FAILED_ATTEMPTS;

  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: nextCount,
      lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function isUserCurrent(userId: string, passwordVersion: number): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordVersion: true, status: true },
  });
  if (!user) return false;
  if (user.status !== UserStatus.ACTIVE) return false;
  return user.passwordVersion === passwordVersion;
}
