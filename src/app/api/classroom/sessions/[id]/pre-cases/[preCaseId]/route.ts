// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/classroom/sessions/[id]/pre-cases/[preCaseId] — W6.8
// ════════════════════════════════════════════════════════════════════════════
// Detach a CaseTemplate from a session's pre-case prep list. The underlying
// CaseTemplate is untouched; resident attempts (Case rows) are also untouched.
// Only the SessionPreCase join row is deleted.

import {
  handleUnexpected,
  jsonError,
  jsonOk,
  requireAuth,
} from '@/server/services/api-helpers';
import {
  detachPreCase,
  PreCaseAccessError,
} from '@/server/services/study-pack/pre-case-service';
import {
  audit,
  AUDIT_EVENTS,
  extractRequestMetadata,
} from '@/server/services/audit';

function statusFor(code: string): number {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'FORBIDDEN') return 403;
  if (code === 'CONFLICT') return 409;
  return 400;
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; preCaseId: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id: sessionId, preCaseId } = await ctx.params;
  try {
    await detachPreCase({
      sessionId,
      preCaseId,
      actor: { userId: auth.user.id, role: auth.user.role },
    });
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.PRE_CASE_DETACHED,
      entityType: 'SessionPreCase',
      entityId: preCaseId,
      summary: `Pre-case detached from session`,
      details: { sessionId, preCaseId },
      ...extractRequestMetadata(req),
    });
    return jsonOk({ removed: true });
  } catch (err) {
    if (err instanceof PreCaseAccessError) {
      return jsonError(err.code, err.message, statusFor(err.code));
    }
    return handleUnexpected(err);
  }
}
