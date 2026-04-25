// ════════════════════════════════════════════════════════════════════════════
// User Admin Service — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Admin-only operations on User rows: list/search, change role, change status
// (suspend / reactivate / deactivate). All mutations write an audit entry and
// append to UserRoleHistory when role changes.

import { db } from '@/lib/db';
import { Role, UserStatus, Prisma } from '@prisma/client';
import { audit, AUDIT_EVENTS } from './audit';
import { sendEmail } from '@/lib/email';

export interface ListUsersArgs {
  role?: Role;
  status?: UserStatus;
  search?: string;
  limit: number;
  cursor?: string;
}

export async function listUsers(args: ListUsersArgs) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  };
  if (args.role) where.role = args.role;
  if (args.status) where.status = args.status;
  if (args.search) {
    where.OR = [
      { email: { contains: args.search, mode: 'insensitive' } },
      { name: { contains: args.search, mode: 'insensitive' } },
    ];
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: args.limit,
    ...(args.cursor ? { skip: 1, cursor: { id: args.cursor } } : {}),
  });

  return {
    users,
    nextCursor: users.length === args.limit ? users[users.length - 1].id : null,
  };
}

export async function getUser(userId: string) {
  return db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
      lastLoginAt: true,
      lockedUntil: true,
      failedLoginCount: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      roleHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          previousRole: true,
          newRole: true,
          changedBy: true,
          createdAt: true,
          reason: true,
        },
      },
    },
  });
}

// ----------------------------------------------------------------------------
// Role change
// ----------------------------------------------------------------------------
export async function changeUserRole(args: {
  targetUserId: string;
  newRole: Role;
  actorId: string;
  reason?: string | null;
}) {
  if (args.targetUserId === args.actorId) {
    throw new Error('CANNOT_MODIFY_SELF');
  }

  const target = await db.user.findFirst({
    where: { id: args.targetUserId, deletedAt: null },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!target) throw new Error('USER_NOT_FOUND');
  if (target.role === args.newRole) {
    return { id: target.id, role: target.role, unchanged: true };
  }

  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: { role: args.newRole },
    }),
    db.userRoleHistory.create({
      data: {
        userId: target.id,
        previousRole: target.role,
        newRole: args.newRole,
        changedBy: args.actorId,
        reason: args.reason ?? null,
      },
    }),
  ]);

  await audit({
    actorId: args.actorId,
    eventType: AUDIT_EVENTS.USER_ROLE_CHANGED,
    entityType: 'user',
    entityId: target.id,
    summary: `Role changed ${target.role} → ${args.newRole}`,
    details: { previousRole: target.role, newRole: args.newRole, reason: args.reason ?? null },
  });

  return { id: target.id, role: args.newRole, unchanged: false };
}

// ----------------------------------------------------------------------------
// Status change — SUSPEND / REACTIVATE / DEACTIVATE
// ----------------------------------------------------------------------------
export async function changeUserStatus(args: {
  targetUserId: string;
  newStatus: Extract<UserStatus, 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'>;
  actorId: string;
  reason?: string | null;
}) {
  if (args.targetUserId === args.actorId) {
    throw new Error('CANNOT_MODIFY_SELF');
  }

  const target = await db.user.findFirst({
    where: { id: args.targetUserId, deletedAt: null },
    select: { id: true, status: true, name: true, email: true },
  });
  if (!target) throw new Error('USER_NOT_FOUND');
  if (target.status === 'PENDING_INVITE') {
    throw new Error('USER_NOT_ONBOARDED');
  }
  if (target.status === args.newStatus) {
    return { id: target.id, status: target.status, unchanged: true };
  }

  // Status transition invalidates all active sessions immediately by bumping
  // passwordVersion (NextAuth jwt callback rejects stale versions).
  await db.user.update({
    where: { id: target.id },
    data: {
      status: args.newStatus,
      passwordVersion:
        args.newStatus === 'SUSPENDED' || args.newStatus === 'DEACTIVATED'
          ? { increment: 1 }
          : undefined,
      lockedUntil: args.newStatus === 'ACTIVE' ? null : undefined,
      failedLoginCount: args.newStatus === 'ACTIVE' ? 0 : undefined,
    },
  });

  await audit({
    actorId: args.actorId,
    eventType: AUDIT_EVENTS.USER_STATUS_CHANGED,
    entityType: 'user',
    entityId: target.id,
    summary: `Status changed ${target.status} → ${args.newStatus}`,
    details: { previousStatus: target.status, newStatus: args.newStatus, reason: args.reason ?? null },
  });

  // Courtesy email. Failures do not block the status change.
  if (args.newStatus === 'SUSPENDED') {
    sendEmail({
      to: target.email,
      subject: 'Your Vaidix account has been suspended',
      html: `<p>Hi ${target.name.split(' ')[0]},</p>
        <p>Your Vaidix account has been suspended by an administrator.
        Please contact your Program Director if you believe this is a mistake.</p>
        ${args.reason ? `<p><strong>Reason:</strong> ${args.reason}</p>` : ''}`,
    }).catch((err) => {
      console.error('[user-admin] suspension email failed', err);
    });
  }

  return { id: target.id, status: args.newStatus, unchanged: false };
}
