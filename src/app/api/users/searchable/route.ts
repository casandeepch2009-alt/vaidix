// ════════════════════════════════════════════════════════════════════════════
// GET /api/users/searchable
// ════════════════════════════════════════════════════════════════════════════
// Lightweight user list for "pick a user" UIs (cohort member picker,
// session invite picker). Returns only the fields a picker needs — no admin
// surface area like lockedUntil, lastLoginAt, etc. Allows ADMIN + PD since
// both manage cohorts and schedule sessions.
//
// Query params:
//   role         — optional, single Role enum value to filter by
//   search       — optional, case-insensitive name/email substring match
//   excludeIds   — optional, comma-separated user IDs to omit (already added)
//   limit        — default 30, max 100

import { db } from '@/lib/db';
import { Role, UserStatus, Prisma } from '@prisma/client';
import { jsonOk, requireRole, handleUnexpected } from '@/server/services/api-helpers';

export async function GET(req: Request) {
  try {
    const gate = await requireRole(Role.ADMIN, Role.PROGRAM_DIRECTOR);
    if (!gate.ok) return gate.response;

    const url    = new URL(req.url);
    const role   = url.searchParams.get('role') as Role | null;
    const search = url.searchParams.get('search')?.trim() ?? '';
    const exclude = url.searchParams.get('excludeIds')?.split(',').filter(Boolean) ?? [];
    const limit  = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10) || 30));

    const where: Prisma.UserWhereInput = {
      status: UserStatus.ACTIVE,
      deletedAt: null,
    };
    if (role && Object.values(Role).includes(role)) where.role = role;
    if (exclude.length > 0)                          where.id = { notIn: exclude };
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return jsonOk({ users });
  } catch (err) {
    return handleUnexpected(err);
  }
}
