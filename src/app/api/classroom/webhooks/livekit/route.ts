// ════════════════════════════════════════════════════════════════════════════
// POST /api/classroom/webhooks/livekit
// ════════════════════════════════════════════════════════════════════════════
// Receives signed LiveKit webhook events:
//   - Room lifecycle (W2): room_started / room_finished / participant_joined/left
//   - Egress lifecycle (W4 Stream A): egress_started / egress_updated /
//     egress_ended — drives the recording state machine and enqueues transcode.
// Updates session + recording records without trusting any client state.

import { webhookReceiver } from '@/lib/livekit';
import { db } from '@/lib/db';
import { getQueue, QUEUES } from '@/lib/queue';
import { SessionStatus, RecordingStatus } from '@prisma/client';
import { audit, AUDIT_EVENTS } from '@/server/services/audit';

const ROOM_SESSION_PREFIX = 'session-';

function roomToSessionId(roomName: string | undefined): string | null {
  if (!roomName) return null;
  if (!roomName.startsWith(ROOM_SESSION_PREFIX)) return null;
  return roomName.slice(ROOM_SESSION_PREFIX.length);
}

// LiveKit Egress event payload shape (subset used here).
interface EgressEventPayload {
  egressInfo?: {
    egressId?: string;
    roomName?: string;
    status?: string; // EGRESS_STARTING | EGRESS_ACTIVE | EGRESS_ENDING | EGRESS_COMPLETE | EGRESS_FAILED | EGRESS_ABORTED
    file?: { filename?: string; location?: string };
    fileResults?: Array<{ filename?: string; location?: string; size?: string | number; duration?: string | number }>;
    error?: string;
  };
}

function pickEgressFile(info: NonNullable<EgressEventPayload['egressInfo']>): { key: string | null; sizeBytes: bigint | null; durationSec: number | null } {
  const fr = info.fileResults?.[0];
  const fname = fr?.filename ?? info.file?.filename ?? null;
  // LiveKit Egress writes path-style filenames; we store as MinIO key.
  // Strip the bucket prefix if Egress was configured with a leading slash.
  const key = fname ? fname.replace(/^\//, '') : null;
  const sizeRaw = fr?.size;
  const sizeBytes = sizeRaw == null ? null : BigInt(typeof sizeRaw === 'string' ? sizeRaw : Math.round(sizeRaw));
  const durationRaw = fr?.duration;
  // duration is reported in nanoseconds as a string in some LiveKit versions
  const durationSec = durationRaw == null
    ? null
    : Math.round(Number(durationRaw) / (typeof durationRaw === 'string' && durationRaw.length > 7 ? 1_000_000_000 : 1));
  return { key, sizeBytes, durationSec };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const authHeader = req.headers.get('authorization') ?? '';

  let event;
  try {
    event = await webhookReceiver.receive(raw, authHeader);
  } catch (err) {
    console.error('[livekit-webhook] signature verification failed:', err);
    return new Response('Invalid signature', { status: 401 });
  }

  // ─── Egress events: derive sessionId from the egress payload room ───────
  const egressInfo = (event as unknown as EgressEventPayload).egressInfo;
  if (egressInfo) {
    const sessionId = roomToSessionId(egressInfo.roomName);
    if (!sessionId) return new Response('OK (egress no-op)', { status: 200 });

    const status = egressInfo.status ?? '';
    try {
      // Egress started — ensure a Recording row exists.
      if (event.event === 'egress_started' || status === 'EGRESS_ACTIVE') {
        await db.recording.upsert({
          where: { sessionId },
          create: {
            sessionId,
            status: RecordingStatus.RECORDING,
            pipelineStage: RecordingStatus.RECORDING,
            egressJobId: egressInfo.egressId ?? null,
          },
          update: {
            status: RecordingStatus.RECORDING,
            pipelineStage: RecordingStatus.RECORDING,
            egressJobId: egressInfo.egressId ?? null,
          },
        });
        const recId = (await db.recording.findUnique({ where: { sessionId }, select: { id: true } }))!.id;
        await db.recordingStageEvent.create({
          data: {
            recordingId: recId,
            stage: RecordingStatus.RECORDING,
            metadata: { egressId: egressInfo.egressId ?? null },
          },
        });
        await audit({
          eventType: AUDIT_EVENTS.RECORDING_EGRESS_STARTED,
          entityType: 'Recording',
          entityId: recId,
          summary: 'Egress recording started',
          details: { sessionId, egressId: egressInfo.egressId ?? null },
        });
      }

      // Egress complete — write rawS3Key, advance to TRANSCODING, enqueue worker.
      if (event.event === 'egress_ended' && status === 'EGRESS_COMPLETE') {
        const { key, sizeBytes, durationSec } = pickEgressFile(egressInfo);
        const recording = await db.recording.update({
          where: { sessionId },
          data: {
            rawS3Key: key,
            sizeBytes,
            durationSec,
            status: RecordingStatus.TRANSCODING,
            pipelineStage: RecordingStatus.TRANSCODING,
            transcodeStartedAt: new Date(),
          },
        });
        await db.recordingStageEvent.create({
          data: {
            recordingId: recording.id,
            stage: RecordingStatus.TRANSCODING,
            metadata: { rawKey: key ?? null, egressId: egressInfo.egressId ?? null },
          },
        });
        await getQueue(QUEUES.RECORDING).add(
          'transcode',
          { recordingId: recording.id },
          { jobId: `transcode-${recording.id}` }
        );
        await audit({
          eventType: AUDIT_EVENTS.RECORDING_EGRESS_COMPLETED,
          entityType: 'Recording',
          entityId: recording.id,
          summary: 'Egress recording uploaded; transcode enqueued',
          details: { sessionId, key, sizeBytes: sizeBytes?.toString() ?? null, durationSec },
        });
      }

      // Egress failed/aborted — record failure.
      if (event.event === 'egress_ended' && (status === 'EGRESS_FAILED' || status === 'EGRESS_ABORTED')) {
        await db.recording.updateMany({
          where: { sessionId },
          data: {
            status: RecordingStatus.RECORDING_FAILED,
            pipelineStage: RecordingStatus.RECORDING_FAILED,
            failureReason: egressInfo.error ?? `Egress ${status}`,
          },
        });
        await audit({
          eventType: AUDIT_EVENTS.RECORDING_EGRESS_FAILED,
          entityType: 'TeachingSession',
          entityId: sessionId,
          summary: `Egress ${status}`,
          details: { sessionId, error: egressInfo.error ?? null, status },
          success: false,
        });
      }
    } catch (err) {
      console.error('[livekit-webhook] egress handler error:', err, 'event:', event.event);
      return new Response('Handler error', { status: 500 });
    }

    return new Response('OK', { status: 200 });
  }

  // ─── Room lifecycle events (existing W2 logic) ─────────────────────────
  const sessionId = roomToSessionId(event.room?.name);
  if (!sessionId) {
    return new Response('OK (no-op)', { status: 200 });
  }

  try {
    switch (event.event) {
      case 'room_started': {
        await db.teachingSession.updateMany({
          where: {
            id: sessionId,
            status: { in: [SessionStatus.SCHEDULED] },
          },
          data: {
            status: SessionStatus.LIVE,
            actualStart: new Date(),
            liveKitRoomSid: event.room?.sid ?? null,
          },
        });
        break;
      }
      case 'room_finished': {
        await db.teachingSession.updateMany({
          where: { id: sessionId, status: SessionStatus.LIVE },
          data: {
            status: SessionStatus.ENDED,
            actualEnd: new Date(),
          },
        });
        // Stamp any still-open participant rows
        await db.sessionParticipant.updateMany({
          where: { sessionId, leftAt: null },
          data: { leftAt: new Date() },
        });
        break;
      }
      case 'participant_joined': {
        const userId = event.participant?.identity;
        if (!userId) break;
        await db.sessionParticipant.updateMany({
          where: { sessionId, userId, leftAt: null },
          data: {
            joinedAt: new Date(),
            livekitIdentity: userId,
          },
        });
        break;
      }
      case 'participant_left': {
        const userId = event.participant?.identity;
        if (!userId) break;
        await db.sessionParticipant.updateMany({
          where: { sessionId, userId, leftAt: null },
          data: { leftAt: new Date() },
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[livekit-webhook] handler error:', err, 'event:', event.event);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}
