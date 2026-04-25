import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { LiveSession } from '@/components/classroom/live-session'

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
      host: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  })
  if (!s) notFound()

  return (
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
        host: s.host,
      }}
      currentUser={{ id: session.user.id, name: session.user.name }}
      shareToken={shareToken}
    />
  )
}
