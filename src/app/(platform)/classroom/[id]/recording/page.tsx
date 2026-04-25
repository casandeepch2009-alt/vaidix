// ════════════════════════════════════════════════════════════════════════════
// /classroom/[id]/recording — Vidstack-style HLS playback page
// ════════════════════════════════════════════════════════════════════════════
// Server component: fetches recording metadata + signed playback URL via the
// RecordingService, then hands it off to the client RecordingPlayer.

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { RecordingPlayer } from '@/components/recording/recording-player';
import {
  listSessionRecordings,
  RecordingAccessError,
} from '@/server/services/recordings/recording-service';
import { db } from '@/lib/db';
import { RecordingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const PROCESSING_STATES = new Set<RecordingStatus>([
  RecordingStatus.RECORDING,
  RecordingStatus.RECORDING_PARTIAL,
  RecordingStatus.TRANSCODING,
  RecordingStatus.TRANSCRIBING,
  RecordingStatus.AI_PROCESSING,
]);

export default async function ClassroomRecordingPage({ params }: PageProps) {
  const [{ id: sessionId }, session] = await Promise.all([params, auth()]);
  if (!session?.user) redirect(`/login?next=/classroom/${sessionId}/recording`);

  // Find the latest recording for this session.
  const recordings = await listSessionRecordings(
    { userId: session.user.id, role: session.user.role },
    sessionId
  ).catch((err) => {
    if (err instanceof RecordingAccessError && err.code === 'FORBIDDEN') return null;
    throw err;
  });

  if (recordings === null) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view this session.</p>
      </div>
    );
  }
  if (recordings.length === 0) notFound();

  const rec = recordings[0];

  const sessionMeta = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { title: true, description: true, scheduledStart: true, scheduledEnd: true, host: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{sessionMeta?.title ?? 'Recording'}</h1>
        {sessionMeta?.host?.name && (
          <p className="text-sm text-muted-foreground">Hosted by {sessionMeta.host.name}</p>
        )}
        {sessionMeta?.description && (
          <p className="text-sm text-muted-foreground">{sessionMeta.description}</p>
        )}
      </header>

      {rec.hlsUrl ? (
        <RecordingPlayer
          hlsUrl={rec.hlsUrl}
          posterUrl={rec.thumbnailUrl}
          tracks={rec.transcripts.map((t) => ({
            language: t.language,
            source: t.source,
            vttUrl: t.vttUrl || null,
          }))}
        />
      ) : PROCESSING_STATES.has(rec.status) ? (
        <ProcessingBanner status={rec.status} />
      ) : (
        <FailedBanner reason={rec.failureReason} />
      )}

      <Tabs sessionId={sessionId} />
    </div>
  );
}

function ProcessingBanner({ status }: { status: RecordingStatus }) {
  const labelMap: Record<string, string> = {
    RECORDING: 'Recording in progress…',
    RECORDING_PARTIAL: 'Recording partially complete — finishing up…',
    TRANSCODING: 'Transcoding to HLS — usually under 10 minutes.',
    TRANSCRIBING: 'Generating captions — usually 60–90 minutes for a 1-hour lecture.',
    AI_PROCESSING: 'AI summary + pearls extraction in progress — about 2 hours total.',
  };
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-6">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <h2 className="text-lg font-medium">Processing</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{labelMap[status] ?? `Status: ${status}`}</p>
    </div>
  );
}

function FailedBanner({ reason }: { reason: string | null }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="text-lg font-medium text-destructive">Recording unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">{reason ?? 'Unknown failure. Engineering has been notified.'}</p>
    </div>
  );
}

function Tabs({ sessionId }: { sessionId: string }) {
  return (
    <div className="space-y-3 border-t pt-6">
      <nav className="flex gap-4 text-sm">
        <span className="font-medium">Transcript</span>
        <span className="text-muted-foreground">Resources (W4 Stream C)</span>
        <span className="text-muted-foreground">Q&amp;A (W5)</span>
      </nav>
      <p className="text-sm text-muted-foreground">
        Session: <code>{sessionId}</code>. Transcript and Resources tabs land in W4 Stream C; Q&amp;A in W5.
      </p>
    </div>
  );
}
