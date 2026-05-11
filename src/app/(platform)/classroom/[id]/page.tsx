import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Pencil, BookOpen } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { LiveSession } from '@/components/classroom/live-session'
import { PendingSessionManager } from '@/components/classroom/pending-session-manager'
import { PostSessionInsightsPanel } from '@/components/classroom/post-session-insights-panel'
import { nextOccurrenceStart } from '@/server/services/sessions/recurrence'
import { computePrereqStatus } from '@/server/services/sessions/prereq'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function ClassroomSessionPage({ params, searchParams }: PageProps) {
  const [{ id }, { t: shareToken }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ])
  if (!session?.user) redirect(`/login?next=/classroom/${(await params).id}`)

  // Host is fetched separately to tolerate orphaned FK data — see
  // src/server/services/calendar-service.ts for the full rationale.
  const s = await db.teachingSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      sessionType: true,
      status: true,
      approvalStatus: true,
      scheduledStart: true,
      scheduledEnd: true,
      recordingEnabled: true,
      consentRequired: true,
      hostId: true,
      proposedBy: true,
      objectives: true,
      topicId: true,
      recurrenceRule: true,
      recurrenceUntil: true,
      metadata: true,
    },
  })
  if (!s) notFound()

  // For recurring sessions, the master row's status is often stale (e.g. ENDED
  // after a prior occurrence finished) even though the series still has future
  // occurrences. Project to SCHEDULED so the Pre-Conference Prep block renders
  // for the next occurrence. LIVE wins — an active occurrence right now still
  // routes to the live room.
  const now = new Date()
  const next = s.recurrenceRule
    ? nextOccurrenceStart(s.scheduledStart, s.recurrenceRule, s.recurrenceUntil, now)
    : null
  const effectiveStatus =
    s.recurrenceRule && next && s.status !== 'LIVE' ? 'SCHEDULED' : s.status
  const effectiveStart = next ?? s.scheduledStart
  const effectiveEnd = next
    ? new Date(next.getTime() + (s.scheduledEnd.getTime() - s.scheduledStart.getTime()))
    : s.scheduledEnd

  const [host, proposer, viewer] = await Promise.all([
    db.user.findUnique({
      where: { id: s.hostId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    db.user.findUnique({
      where: { id: s.proposedBy },
      select: { id: true, name: true },
    }),
    // Authoritative profile lookup for the local viewer. The Vaidix flow
    // requires every joiner to be a registered user (no anonymous guests),
    // so we always have name / email / avatar on file — pull all three so
    // the live-room UI shows their real photo + display name + handle,
    // not a placeholder. Auth.js's session.user.name can be null on
    // legacy JWTs minted before the name-claim fix; the DB row is the
    // source of truth.
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, avatarUrl: true },
    }),
  ])

  // Fallback chain: DB row → JWT claim → email-prefix → empty.
  // We deliberately never use placeholder labels like "Guest" because
  // Vaidix only admits registered users.
  const viewerEmail = viewer?.email ?? session.user.email ?? ''
  const viewerName =
    viewer?.name?.trim() ||
    (session.user.name ?? '').trim() ||
    (viewerEmail ? viewerEmail.split('@')[0] : '')
  const viewerAvatarUrl = viewer?.avatarUrl ?? null

  // Diagnostic — logs every render so we can verify the DB lookup is
  // returning what we expect. Remove once the name pipeline is confirmed
  // to be working end-to-end.
  console.log('[classroom/page] viewer profile resolved', {
    sessionUserId: session.user.id,
    dbName: viewer?.name,
    dbEmail: viewer?.email,
    dbAvatarUrl: viewer?.avatarUrl,
    sessionName: session.user.name,
    finalViewerName: viewerName,
  })

  const canEdit =
    session.user.id === s.hostId ||
    session.user.id === s.proposedBy ||
    session.user.role === 'ADMIN' ||
    session.user.role === 'PROGRAM_DIRECTOR'

  // Pending / draft / rejected sessions get the management UI instead of the live room.
  if (s.approvalStatus !== 'APPROVED') {
    return (
      <>
        {canEdit && (
          <div className="flex justify-end">
            <EditSessionLink sessionId={s.id} />
          </div>
        )}
        <PendingSessionManager
          session={{
            id: s.id,
            title: s.title,
            description: s.description,
            sessionType: s.sessionType,
            approvalStatus: s.approvalStatus,
            scheduledStart: effectiveStart.toISOString(),
            scheduledEnd: effectiveEnd.toISOString(),
            host: host ?? { id: s.hostId, name: 'Unknown host', email: '' },
          }}
          proposer={proposer}
          currentUser={{
            id: session.user.id,
            name: viewerName,
            role: session.user.role,
          }}
        />
      </>
    )
  }

  // Pre-conference prep (objectives, study pack, readiness, etc.) lives on
  // /classroom/[id]/study now — surfaced via a shortcut for SCHEDULED sessions.
  const isCurator =
    session.user.id === s.hostId ||
    session.user.role === 'FACULTY' ||
    session.user.role === 'PROGRAM_DIRECTOR' ||
    session.user.role === 'ADMIN'

  const showStudyHubLink = effectiveStatus === 'SCHEDULED'

  // Compute the prereq gate state for non-curators only — host/faculty/PD/admin
  // bypass the gate so they can always start/manage the room.
  const prereqStatus = !isCurator
    ? await computePrereqStatus(s.id, session.user.id)
    : null

  // W8.3 — render the post-session insights panel only when a finalized
  // English transcript exists for this session. Cheap select, runs on every
  // detail-page render but is a single indexed lookup.
  const finalizedTranscript = await db.sessionTranscript.findUnique({
    where: { sessionId_language: { sessionId: s.id, language: 'en' } },
    select: { finalized: true },
  })
  const showInsights = !!finalizedTranscript?.finalized
  const canTriggerInsights =
    session.user.id === s.hostId ||
    session.user.role === 'PROGRAM_DIRECTOR' ||
    session.user.role === 'ADMIN'

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showStudyHubLink && <StudyHubLink sessionId={s.id} isCurator={isCurator} />}
        {canEdit && <EditSessionLink sessionId={s.id} />}
      </div>
      {showInsights && (
        <PostSessionInsightsPanel sessionId={s.id} canTrigger={canTriggerInsights} />
      )}
      <LiveSession
        session={{
          id: s.id,
          title: s.title,
          description: s.description,
          sessionType: s.sessionType,
          status: effectiveStatus,
          approvalStatus: s.approvalStatus,
          scheduledStart: effectiveStart.toISOString(),
          scheduledEnd: effectiveEnd.toISOString(),
          recordingEnabled: s.recordingEnabled,
          consentRequired: s.consentRequired,
          host: host ?? { id: s.hostId, name: 'Unknown host', email: '', avatarUrl: null },
          // Live captions provider for this session, set at scheduling time.
          // Read off the metadata bag the v2.8 form already persists into.
          captionsProfile: ((s.metadata as { captionsProfile?: string } | null | undefined)
            ?.captionsProfile ?? 'off') as 'english-only' | 'indic-mix' | 'off',
        }}
        currentUser={{
          id: session.user.id,
          name: viewerName,
          email: viewerEmail,
          avatarUrl: viewerAvatarUrl,
          role: session.user.role,
          isOrganizer: session.user.id === s.hostId,
        }}
        shareToken={shareToken}
        prereqStatus={prereqStatus}
      />
    </>
  )
}

function EditSessionLink({ sessionId }: { sessionId: string }) {
  return (
    <Link
      href={`/classroom/${sessionId}/edit`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-accent"
    >
      <Pencil className="size-3.5" />
      Edit session
    </Link>
  )
}

function StudyHubLink({ sessionId, isCurator }: { sessionId: string; isCurator: boolean }) {
  return (
    <Link
      href={`/classroom/${sessionId}/study`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-500/20 dark:text-emerald-400"
    >
      <BookOpen className="size-3.5" />
      {isCurator ? 'Manage prep' : 'Open study hub'}
    </Link>
  )
}
