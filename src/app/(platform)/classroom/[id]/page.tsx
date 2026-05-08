import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { LiveSession } from '@/components/classroom/live-session'
import { PendingSessionManager } from '@/components/classroom/pending-session-manager'
import { PreConferencePrepBlock } from '@/components/classroom/pre-conference-prep-block'
import { PreConferenceResidentBlock } from '@/components/classroom/pre-conference-resident-block'
import type { ObjectiveRow } from '@/components/classroom/objectives-chip-list'
import { nextOccurrenceStart } from '@/server/services/sessions/recurrence'
import { computePrereqStatus, readPrereqConfig } from '@/server/services/sessions/prereq'

interface StoredObjective { id: string; text: string; blooms: number }

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

  const [host, proposer, topic] = await Promise.all([
    db.user.findUnique({
      where: { id: s.hostId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    db.user.findUnique({
      where: { id: s.proposedBy },
      select: { id: true, name: true },
    }),
    s.topicId
      ? db.topic.findUnique({
          where: { id: s.topicId },
          select: { name: true, subspecialty: true },
        })
      : Promise.resolve(null),
  ])

  const canEdit =
    session.user.id === s.hostId ||
    session.user.id === s.proposedBy ||
    session.user.role === 'ADMIN' ||
    session.user.role === 'PROGRAM_DIRECTOR'

  // Pending / draft / rejected sessions get the management UI instead of the live room.
  if (s.approvalStatus !== 'APPROVED') {
    return (
      <>
        {canEdit && <EditSessionLink sessionId={s.id} />}
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
            name: session.user.name ?? '',
            role: session.user.role,
          }}
        />
      </>
    )
  }

  // W6.8 — for APPROVED-but-not-yet-LIVE sessions, show Pre-Conference Prep
  // panels above the pre-join screen for host / faculty / PD / admin.
  const isCurator =
    session.user.id === s.hostId ||
    session.user.role === 'FACULTY' ||
    session.user.role === 'PROGRAM_DIRECTOR' ||
    session.user.role === 'ADMIN'

  const showCuratorBlock = effectiveStatus === 'SCHEDULED' && isCurator
  const showResidentBlock = effectiveStatus === 'SCHEDULED' && !isCurator

  // Compute the prereq gate state for non-curators only — host/faculty/PD/admin
  // bypass the gate so they can always start/manage the room.
  const prereqStatus = !isCurator
    ? await computePrereqStatus(s.id, session.user.id)
    : null
  const prereqConfig = readPrereqConfig(s.metadata)

  // Always read this user's marks — used by both curator + resident blocks
  // (curator sees their own marks too if attending another session as a learner).
  const myMarks = await db.sessionObjectiveAchievement.findMany({
    where: { sessionId: s.id, userId: session.user.id },
    select: { objectiveId: true, status: true },
  })

  // Resident-facing prep counts — surfaced on the prep block so the CTAs are
  // not blind links. Cheap COUNT-only queries; no list materialisation.
  const [studyPackCount, preQuestionCount, myPreQuestionCount] = showResidentBlock
    ? await Promise.all([
        Promise.all([
          db.documentSessionLink.count({
            where: { sessionId: s.id, isPreSession: true },
          }),
          db.sessionPreCase.count({ where: { sessionId: s.id } }),
        ]).then(([docs, cases]) => docs + cases),
        db.preSessionQuestion.count({ where: { sessionId: s.id } }),
        db.preSessionQuestion.count({
          where: { sessionId: s.id, userId: session.user.id },
        }),
      ])
    : [0, 0, 0]

  const storedObjectives = (s.objectives as unknown as StoredObjective[] | null) ?? []
  const markByObjId = new Map(myMarks.map((m) => [m.objectiveId, m.status]))
  const objectiveRows: ObjectiveRow[] = storedObjectives.map((o) => ({
    id: o.id,
    text: o.text,
    blooms: o.blooms,
    myStatus: markByObjId.get(o.id) ?? null,
  }))

  return (
    <>
      {canEdit && <EditSessionLink sessionId={s.id} />}
      {showCuratorBlock && (
        <PreConferencePrepBlock
          sessionId={s.id}
          canCurate={
            session.user.id === s.hostId ||
            session.user.role === 'PROGRAM_DIRECTOR' ||
            session.user.role === 'ADMIN'
          }
          objectives={objectiveRows}
          topic={topic}
          prereqConfig={prereqConfig}
        />
      )}
      {showResidentBlock && (
        <PreConferenceResidentBlock
          sessionId={s.id}
          studyPackCount={studyPackCount}
          preQuestionCount={preQuestionCount}
          myPreQuestionCount={myPreQuestionCount}
          objectives={objectiveRows}
          topic={topic}
          prereqStatus={prereqStatus}
        />
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
        }}
        currentUser={{ id: session.user.id, name: session.user.name }}
        shareToken={shareToken}
        prereqStatus={prereqStatus}
      />
    </>
  )
}

function EditSessionLink({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex justify-end">
      <Link
        href={`/classroom/${sessionId}/edit`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-accent"
      >
        <Pencil className="size-3.5" />
        Edit session
      </Link>
    </div>
  )
}
