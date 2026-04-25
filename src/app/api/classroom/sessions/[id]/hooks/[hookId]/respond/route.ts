// POST /api/classroom/sessions/[id]/hooks/[hookId]/respond
// Learner submits their answer to a fired hook. Records hook response +
// emits a HOOK_RESPONSE engagement signal.

import { z } from 'zod';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  parseBody,
  requireAuth,
} from '@/server/services/api-helpers';
import { recordHookResponse } from '@/server/services/hooks/hooks-service';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';
import { checkRateLimit, LIMITS } from '@/server/services/rate-limit';

const respondSchema = z.object({
  response: z.string().min(1).max(500),
  latencyMs: z.number().int().nonnegative().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; hookId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, respondSchema);
  if (!body.ok) return body.response;
  const { hookId } = await ctx.params;

  const rl = await checkRateLimit({ bucket: `hook-respond:${auth.user.id}`, ...LIMITS.HOOK_RESPOND });
  if (!rl.allowed) {
    return jsonError('RATE_LIMITED', 'Too many responses — try again later', 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  try {
    const result = await recordHookResponse({
      hookId,
      userId: auth.user.id,
      response: body.data.response,
      latencyMs: body.data.latencyMs,
    });
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.LIVE_HOOK_RESPONDED,
      entityType: 'LiveHookResponse',
      entityId: hookId,
      summary: `Response submitted; correct=${result.isCorrect ?? 'n/a'}`,
      details: { hookId, isCorrect: result.isCorrect },
      ...extractRequestMetadata(req),
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error && /not found|closed/.test(err.message)) {
      return jsonError('CONFLICT', err.message, 409);
    }
    return handleUnexpected(err);
  }
}
