// ════════════════════════════════════════════════════════════════════════════
// POST /api/classroom/sessions/[id]/captions/deepgram-token
// ════════════════════════════════════════════════════════════════════════════
// Mints a 30-second Deepgram access token for the host's browser to open a
// direct WebSocket to api.deepgram.com. Host-only — only the speaker
// publishes captions in Phase 1 (single-feed mic). The master DEEPGRAM_API_KEY
// never leaves the server.

import {
  handleUnexpected,
  jsonError,
  jsonOk,
  requireAuth,
  requireCsrf,
} from '@/server/services/api-helpers';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';
import { checkRateLimit, LIMITS } from '@/server/services/rate-limit';
import { getEffectiveSessionRole } from '@/server/services/session-service';
import { mintDeepgramAccessToken, deepgramListenWsUrl, DeepgramUnavailableError } from '@/lib/deepgram';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = await requireCsrf(req);
  if (!csrf.ok) return csrf.response;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await ctx.params;

  // Only the session HOST or CO_HOST can produce captions in Phase 1. Anything
  // else risks crossed audio streams + uncontrolled Deepgram billing.
  const role = await getEffectiveSessionRole(sessionId, auth.user.id, auth.user.role);
  if (role !== 'HOST' && role !== 'CO_HOST') {
    return jsonError('FORBIDDEN', 'Only the session host can produce captions', 403);
  }

  // Rate-limit per host: a healthy producer mints ~1 token per session, but
  // network blips can burst. Fail-closed protects against a runaway client
  // that forgets to back off.
  const rl = await checkRateLimit({
    bucket: `captions-token:${auth.user.id}`,
    ...LIMITS.CAPTIONS_TOKEN_MINT,
  });
  if (!rl.allowed) {
    return jsonError(
      'RATE_LIMITED',
      'Caption-token requests throttled — try again shortly',
      429,
      { resetAt: rl.resetAt.toISOString() },
    );
  }

  try {
    const tok = await mintDeepgramAccessToken();
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.CAPTIONS_TOKEN_MINTED,
      entityType: 'TeachingSession',
      entityId: sessionId,
      summary: 'Deepgram caption token minted',
      ...extractRequestMetadata(req),
    });
    return jsonOk({
      accessToken: tok.accessToken,
      expiresInSec: tok.expiresInSec,
      wsUrl: deepgramListenWsUrl(),
    });
  } catch (err) {
    if (err instanceof DeepgramUnavailableError) {
      return jsonError('DEEPGRAM_UNAVAILABLE', err.message, 503);
    }
    return handleUnexpected(err);
  }
}
