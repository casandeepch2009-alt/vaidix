import { jsonOk, jsonError, requireAuth, handleUnexpected } from '@/server/services/api-helpers';
import { approveSession } from '@/server/services/session-service';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    const session = await approveSession(id, gate.user.id, gate.user.role);
    return jsonOk({ session });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'SESSION_NOT_FOUND') return jsonError('NOT_FOUND', 'Session not found', 404);
    if (msg === 'NOT_PENDING') return jsonError('NOT_PENDING', 'Session is not awaiting approval', 409);
    if (msg === 'NOT_DESIGNATED_HOST') return jsonError('FORBIDDEN', 'Only the designated host may approve', 403);
    if (msg === 'HOST_CONFLICT') {
      return jsonError(
        'HOST_CONFLICT',
        'You have another approved session overlapping this time',
        409,
        (err as Error & { conflicts?: unknown }).conflicts
      );
    }
    return handleUnexpected(err);
  }
}
