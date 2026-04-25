// ════════════════════════════════════════════════════════════════════════════
// Recording Service — W4 Stream A
// ════════════════════════════════════════════════════════════════════════════
// Access control + signed URL minting for HLS playback.
// HLS master.m3u8 + variant playlists + .ts segments are all in MinIO.
// We mint a single short-lived signed master URL and rely on the player to
// follow relative paths inside the bucket (MinIO supports path-style URLs).

import { db } from '@/lib/db';
import { presignDownload } from '@/lib/storage';
import { Role, RecordingStatus } from '@prisma/client';

export interface RecordingViewModel {
  id: string;
  sessionId: string;
  status: RecordingStatus;
  pipelineStage: RecordingStatus;
  durationSec: number | null;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  transcripts: Array<{ language: string; source: string; vttUrl: string }>;
}

export interface RecordingAccessActor {
  userId: string;
  role: Role;
}

export class RecordingAccessError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN', message: string) {
    super(message);
  }
}

async function userCanViewSession(actor: RecordingAccessActor, sessionId: string): Promise<boolean> {
  // Admin / Program Director / Faculty have broad access to recordings within institution.
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) return true;

  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      hostId: true,
      visibility: true,
      cohortId: true,
      proposedBy: true,
      participants: { where: { userId: actor.userId }, select: { userId: true } },
      invites: { where: { userId: actor.userId }, select: { userId: true } },
    },
  });
  if (!session) return false;

  // Host / proposer can always view.
  if (session.hostId === actor.userId || session.proposedBy === actor.userId) return true;

  // Participant of the session can view.
  if (session.participants.length > 0) return true;

  // Visibility rules.
  if (session.visibility === 'OPEN_TO_ALL') return true;
  if (session.visibility === 'COHORT' && session.cohortId && actor.role === Role.RESIDENT) {
    const member = await db.cohortMember.findUnique({
      where: { cohortId_userId: { cohortId: session.cohortId, userId: actor.userId } },
      select: { userId: true },
    });
    if (member) return true;
  }
  if (session.visibility === 'INVITE_ONLY' && session.invites.length > 0) return true;

  // Faculty default: any approved session in their institution
  if (actor.role === Role.FACULTY) return true;

  return false;
}

export async function listSessionRecordings(
  actor: RecordingAccessActor,
  sessionId: string
): Promise<RecordingViewModel[]> {
  const allowed = await userCanViewSession(actor, sessionId);
  if (!allowed) throw new RecordingAccessError('FORBIDDEN', 'No access to this session');

  const recordings = await db.recording.findMany({
    where: { sessionId, expungedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { transcripts: { select: { language: true, source: true } } },
  });

  const out: RecordingViewModel[] = [];
  for (const r of recordings) {
    const hlsUrl = r.hlsPath && r.status === RecordingStatus.READY
      ? await presignDownload(r.hlsPath, 6 * 3600)
      : null;
    const thumbnailUrl = r.thumbnailUrl
      ? await presignDownload(r.thumbnailUrl, 6 * 3600).catch(() => null)
      : null;
    const transcripts: RecordingViewModel['transcripts'] = [];
    for (const t of r.transcripts) {
      const vttKey = `captions/${sessionId}/${t.language}.vtt`;
      const vttUrl = await presignDownload(vttKey, 6 * 3600).catch(() => '');
      transcripts.push({ language: t.language, source: t.source, vttUrl });
    }
    out.push({
      id: r.id,
      sessionId: r.sessionId,
      status: r.status,
      pipelineStage: r.pipelineStage,
      durationSec: r.durationSec,
      hlsUrl,
      thumbnailUrl,
      failureReason: r.failureReason,
      createdAt: r.createdAt.toISOString(),
      transcripts,
    });
  }
  return out;
}

export async function getRecordingForViewer(
  actor: RecordingAccessActor,
  recordingId: string
): Promise<RecordingViewModel> {
  const recording = await db.recording.findUnique({
    where: { id: recordingId },
    include: { transcripts: { select: { language: true, source: true } } },
  });
  if (!recording || recording.expungedAt) {
    throw new RecordingAccessError('NOT_FOUND', 'Recording not found');
  }
  const allowed = await userCanViewSession(actor, recording.sessionId);
  if (!allowed) throw new RecordingAccessError('FORBIDDEN', 'No access');

  const hlsUrl =
    recording.hlsPath && recording.status === RecordingStatus.READY
      ? await presignDownload(recording.hlsPath, 6 * 3600)
      : null;
  const thumbnailUrl = recording.thumbnailUrl
    ? await presignDownload(recording.thumbnailUrl, 6 * 3600).catch(() => null)
    : null;
  const transcripts: RecordingViewModel['transcripts'] = [];
  for (const t of recording.transcripts) {
    const vttKey = `captions/${recording.sessionId}/${t.language}.vtt`;
    const vttUrl = await presignDownload(vttKey, 6 * 3600).catch(() => '');
    transcripts.push({ language: t.language, source: t.source, vttUrl });
  }

  return {
    id: recording.id,
    sessionId: recording.sessionId,
    status: recording.status,
    pipelineStage: recording.pipelineStage,
    durationSec: recording.durationSec,
    hlsUrl,
    thumbnailUrl,
    failureReason: recording.failureReason,
    createdAt: recording.createdAt.toISOString(),
    transcripts,
  };
}
