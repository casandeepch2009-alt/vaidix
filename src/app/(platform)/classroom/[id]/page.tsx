import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { LiveSession } from '@/components/classroom/live-session'
import { PendingSessionManager } from '@/components/classroom/pending-session-manager'
import { PreConferencePrepBlock } from '@/components/classroom/pre-conference-prep-block'
import { PreConferenceResidentBlock } from '@/components/classroom/pre-conference-resident-block'
import type { ObjectiveRow } from '@/components/classroom/objectives-chip-list'

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
    },
  })
  if (!s) notFound()

  const [host, proposer] = await Promise.all([
    db.user.findUnique({
      where: { id: s.hostId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    db.user.findUnique({
      where: { id: s.proposedBy },
      select: { id: true, name: true },
    }),
  ])

  // Pending / draft / rejected sessions get the management UI instead of the live room.
  if (s.approvalStatus !== 'APPROVED') {
    return (
      <PendingSessionManager
        session={{
          id: s.id,
          title: s.title,
          description: s.description,
          sessionType: s.sessionType,
          approvalStatus: s.approvalStatus,
          scheduledStart: s.scheduledStart.toISOString(),
          scheduledEnd: s.scheduledEnd.toISOString(),
          host: host ?? { id: s.hostId, name: 'Unknown host', email: '' },
        }}
        proposer={proposer}
        currentUser={{
          id: session.user.id,
          name: session.user.name ?? '',
          role: session.user.role,
        }}
      />
    )
  }

  // W6.8 — for APPROVED-but-not-yet-LIVE sessions, show Pre-Conference Prep
  // panels above the pre-join screen for host / faculty / PD / admin.
  const isCurator =
    session.user.id === s.hostId ||
    session.user.role === 'FACULTY' ||
    session.user.role === 'PROGRAM_DIRECTOR' ||
    session.user.role === 'ADMIN'

  const showCuratorBlock = s.status === 'SCHEDULED' && isCurator
  const showResidentBlock = s.status === 'SCHEDULED' && !isCurator

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
      {showCuratorBlock && (
        <PreConferencePrepBlock
          sessionId={s.id}
          canCurate={
            session.user.id === s.hostId ||
            session.user.role === 'PROGRAM_DIRECTOR' ||
            session.user.role === 'ADMIN'
          }
          objectives={objectiveRows}
        />
      )}
      {showResidentBlock && (
        <PreConferenceResidentBlock
          sessionId={s.id}
          studyPackCount={studyPackCount}
          preQuestionCount={preQuestionCount}
          myPreQuestionCount={myPreQuestionCount}
          objectives={objectiveRows}
        />
      )}
      <LiveSession
        session={{
          id: s.id,
          title: s.title,
          description: s.description,
          sessionType: s.sessionType,
          status: s.status,
          approvalStatus: s.approvalStatus,
          scheduledStart: s.scheduledStart.toISOString(),
          scheduledEnd: s.scheduledEnd.toISOString(),
          recordingEnabled: s.recordingEnabled,
          consentRequired: s.consentRequired,
          host: host ?? { id: s.hostId, name: 'Unknown host', email: '', avatarUrl: null },
        }}
        currentUser={{ id: session.user.id, name: session.user.name }}
        shareToken={shareToken}
      />
    </>
  )
}
