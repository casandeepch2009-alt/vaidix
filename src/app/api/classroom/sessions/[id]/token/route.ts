// ════════════════════════════════════════════════════════════════════════════
// POST /api/classroom/sessions/[id]/token
// ════════════════════════════════════════════════════════════════════════════
// Mints a LiveKit JWT for the authenticated user. Role is derived server-side
// from SessionParticipant + User — NEVER trusted from the client.
//
// Returns one of:
//   { state: 'JOINED', token, url, role }       — user may join immediately
//   { state: 'WAITING', admissionId }           — request admission, poll
//   { state: 'DENIED', reason }                 — admission previously denied
//
// Share-token query param bypasses visibility into the waiting-room path.

import { jsonOk, jsonError, requireAuth, handleUnexpected } from '@/server/services/api-helpers';
import { getEffectiveSessionRole, verifyShareToken } from '@/server/services/session-service';
import { requestAdmission, getAdmissionStatus } from '@/server/services/admission-service';
import { mintLiveKitToken, sessionRoomName } from '@/lib/livekit';
import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { AdmissionStatus } from '@prisma/client';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { id: sessionId } = await ctx.params;
    const url = new URL(req.url);
    const shareToken = url.searchParams.get('t');

    const session = await db.teachingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, approvalStatus: true, maxParticipants: true },
    });
    if (!session) return jsonError('NOT_FOUND', 'Session not found', 404);
    if (session.approvalStatus !== 'APPROVED') {
      return jsonError('NOT_APPROVED', 'Session is not approved', 409);
    }

    // If previously denied, surface that instead of looping
    const existingAdm = await getAdmissionStatus(sessionId, user.id);
    if (existingAdm?.status === AdmissionStatus.DENIED) {
      return jsonOk({ state: 'DENIED', reason: existingAdm.denyReason });
    }

    const effectiveRole = await getEffectiveSessionRole(sessionId, user.id, user.role);

    if (!effectiveRole || effectiveRole === 'VIEWER') {
      // Not visible to this user under W3 visibility rules.
      // Two ways in: (a) valid share token → queue in waiting room; (b) nothing → 403
      if (effectiveRole === 'VIEWER') {
        // Admin/Proposer auditing — skip admission, mint viewer token
        const token = await mintLiveKitToken({
          identity: user.id,
          name: user.name,
          roomName: sessionRoomName(sessionId),
          role: 'viewer',
        });
        return jsonOk({ state: 'JOINED', token, url: env.LIVEKIT_URL, role: 'VIEWER' });
      }

      if (!shareToken) {
        return jsonError('NO_ACCESS', 'You are not permitted to join this session', 403);
      }
      const valid = await verifyShareToken(sessionId, shareToken);
      if (!valid) {
        return jsonError('SHARE_TOKEN_INVALID', 'Share link is invalid or expired', 410);
      }
      const adm = await requestAdmission({
        sessionId,
        userId: user.id,
        displayName: user.name,
      });
      return jsonOk({ state: 'WAITING', admissionId: adm.id });
    }

    // Visible — mint full token
    const lkRole =
      effectiveRole === 'HOST' ? 'host'
      : effectiveRole === 'CO_HOST' ? 'co_host'
      : 'participant';

    const token = await mintLiveKitToken({
      identity: user.id,
      name: user.name,
      roomName: sessionRoomName(sessionId),
      role: lkRole,
      metadata: { effectiveRole, userRole: user.role },
    });

    return jsonOk({ state: 'JOINED', token, url: env.LIVEKIT_URL, role: effectiveRole });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'WAITING_ROOM_FULL') {
      return jsonError('WAITING_ROOM_FULL', 'Waiting room is full, try again later', 429);
    }
    return handleUnexpected(err);
  }
}
