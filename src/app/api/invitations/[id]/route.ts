import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { revokeInvitationSchema } from '@/lib/validation/auth';
import {
  jsonOk,
  jsonError,
  requireRole,
  handleUnexpected,
} from '@/server/services/api-helpers';
import { revokeInvitation } from '@/server/services/invitation-service';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireRole(Role.ADMIN, Role.PROGRAM_DIRECTOR);
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    const inv = await db.invitation.findUnique({
      where: { id },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!inv) return jsonError('NOT_FOUND', 'Invitation not found', 404);

    const timeline = await db.auditEvent.findMany({
      where: { entityType: 'invitation', entityId: id },
      orderBy: { createdAt: 'asc' },
      select: { eventType: true, summary: true, createdAt: true, success: true },
    });

    return jsonOk({ invitation: inv, timeline });
  } catch (err) {
    return handleUnexpected(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireRole(Role.ADMIN);
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = revokeInvitationSchema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    try {
      await revokeInvitation(id, gate.user.id, reason);
      return jsonOk({ message: 'Invitation revoked' });
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'NOT_FOUND') return jsonError('NOT_FOUND', 'Invitation not found', 404);
      if (code === 'ALREADY_ACCEPTED') return jsonError('ALREADY_ACCEPTED', 'Cannot revoke — user already accepted', 409);
      throw err;
    }
  } catch (err) {
    return handleUnexpected(err);
  }
}
