import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { Role, CohortStatus, SessionVisibility } from '@prisma/client'
import { CalendarDays } from 'lucide-react'
import { EditSessionForm } from './edit-session-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditSessionPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, auth()])
  if (!session?.user) redirect(`/login?next=/classroom/${id}/edit`)

  const s = await db.teachingSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      sessionType: true,
      hostId: true,
      proposedBy: true,
      scheduledStart: true,
      scheduledEnd: true,
      visibility: true,
      cohortId: true,
      topicId: true,
      maxParticipants: true,
      recordingEnabled: true,
      consentRequired: true,
      objectives: true,
      metadata: true,
      tags: true,
      approvalStatus: true,
      cohort: { select: { id: true, name: true } },
      invites: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true },
          },
        },
      },
    },
  })
  if (!s) notFound()

  const canEdit =
    session.user.id === s.hostId ||
    session.user.id === s.proposedBy ||
    session.user.role === Role.ADMIN ||
    session.user.role === Role.PROGRAM_DIRECTOR
  if (!canEdit) redirect(`/classroom/${id}`)

  const [faculty, cohorts, topics] = await Promise.all([
    db.user.findMany({
      where: { role: { in: [Role.FACULTY, Role.PROGRAM_DIRECTOR] }, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    db.cohort.findMany({
      where: { status: CohortStatus.ACTIVE, deletedAt: null },
      select: { id: true, name: true, _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.topic.findMany({
      select: { id: true, name: true, subspecialty: true },
      orderBy: [{ subspecialty: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const initialInvitees =
    s.visibility === SessionVisibility.INVITE_ONLY
      ? s.invites.map((i) => ({
          id: i.user.id,
          name: i.user.name,
          email: i.user.email,
          role: i.user.role,
          avatarUrl: i.user.avatarUrl,
        }))
      : []

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/20 px-6 py-5">
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
            <CalendarDays className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Session</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visibility tier is locked once created. Time changes may require re-approval if you’re not the host.
            </p>
          </div>
        </div>
      </div>

      <EditSessionForm
        sessionId={s.id}
        initial={{
          title: s.title,
          description: s.description,
          sessionType: s.sessionType,
          hostId: s.hostId,
          topicId: s.topicId,
          scheduledStart: s.scheduledStart.toISOString(),
          scheduledEnd: s.scheduledEnd.toISOString(),
          visibility: s.visibility,
          cohort: s.cohort,
          invitees: initialInvitees,
          recordingEnabled: s.recordingEnabled,
          consentRequired: s.consentRequired,
          maxParticipants: s.maxParticipants,
          objectives: (s.objectives as Array<{ id: string; text: string; blooms: number }> | null) ?? [],
          metadata: s.metadata,
        }}
        faculty={faculty}
        cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, memberCount: c._count.members }))}
        topics={topics}
        currentUserId={session.user.id}
      />
    </div>
  )
}
