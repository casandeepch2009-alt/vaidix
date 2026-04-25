// ════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/[id]
// ════════════════════════════════════════════════════════════════════════════
// Single user detail including recent role-history entries. Admin-only.

import {
  jsonOk,
  jsonError,
  requireRole,
  handleUnexpected,
} from '@/server/services/api-helpers';
import { Role } from '@prisma/client';
import { getUser } from '@/server/services/user-admin-service';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireRole(Role.ADMIN);
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    const user = await getUser(id);
    if (!user) return jsonError('NOT_FOUND', 'User not found', 404);
    return jsonOk({ user });
  } catch (err) {
    return handleUnexpected(err);
  }
}
