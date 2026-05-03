import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { Role, SessionApprovalStatus, SessionStatus } from '@prisma/client'
import { ClassroomFeed, type ListedSession } from './session-grid'
import { buildSessionVisibilityWhere } from '@/server/services/sessions/visibility'
import { isStaleLive, sweepStaleLiveSessions } from '@/server/services/sessions/auto-end'
import pearlsData from '@/mock-data/pearls.json'

interface MockPearl { tags: string[] }

export default async function ClassroomListPage() {
  const s = await auth()
  if (!s?.user) redirect('/login')

  const canSchedule =
    s.user.role === Role.PROGRAM_DIRECTOR || s.user.role === Role.ADMIN

  // Best-effort recovery of LIVE sessions whose `room_finished` webhook never
  // fired (LiveKit unreachable, host closed browser without ending, etc.).
  // Fire-and-forget: throttled internally, must never block the render path.
  void sweepStaleLiveSessions()

  const now = new Date()
  const nowMs = now.getTime()
  const horizon = new Date(nowMs + 30 * 24 * 3600 * 1000)
  const pastFloor = new Date(nowMs - 90 * 24 * 3600 * 1000)

  // Only sessions this user is allowed to see (matches calendar visibility).
  // Without this, every user sees every APPROVED session in the system —
  // regardless of cohort, invite list, or PRIVATE flag.
  const visibility = await buildSessionVisibilityWhere({
    userId: s.user.id,
    role: s.user.role,
  })

  const sessions = await db.teachingSession.findMany({
    where: {
      deletedAt: null,
      approvalStatus: SessionApprovalStatus.APPROVED,
      scheduledEnd: { gt: pastFloor },
      scheduledStart: { lt: horizon },
      ...visibility,
    },
    include: {
      host: { select: { id: true, name: true } },
      _count: { select: { participants: true } },
      recording: { select: { thumbnailUrl: true, durationSec: true } },
    },
    orderBy: { scheduledStart: 'desc' },
    take: 200,
  })

  const allPearls = pearlsData as MockPearl[]

  const rows: ListedSession[] = sessions.map((x) => {
    const sessionTags = x.tags.map((t) => t.toLowerCase())
    const pearlCount = sessionTags.length > 0
      ? allPearls.filter((p) => p.tags.some((t) => sessionTags.includes(t.toLowerCase()))).length
      : 0

    return {
      id: x.id,
      title: x.title,
      sessionType: x.sessionType,
      status: x.status,
      scheduledStart: x.scheduledStart.toISOString(),
      scheduledEnd: x.scheduledEnd.toISOString(),
      host: x.host,
      participantCount: x._count.participants,
      thumbnailUrl: x.recording?.thumbnailUrl ?? null,
      durationSec: x.recording?.durationSec ?? null,
      tags: x.tags,
      pearlCount,
    }
  })

  // Belt-and-suspenders: if a session is marked LIVE but its scheduled end was
  // long enough ago to be a stuck-LIVE candidate, treat it as past — the
  // background sweep above will eventually correct the DB. This prevents the
  // jarring "LIVE" badge from appearing on the very first render after the
  // bug triggers, when the sweep hasn't yet had a chance to run. The status
  // is coerced to 'ENDED' on the projected row so VideoCard renders the
  // recording UI (not the join-live CTA).
  const projected: ListedSession[] = rows.map((r) =>
    isStaleLive(
      { status: r.status as SessionStatus, scheduledEnd: new Date(r.scheduledEnd), actualStart: null },
      now,
    )
      ? { ...r, status: SessionStatus.ENDED }
      : r,
  )

  const live     = projected.filter((r) => r.status === 'LIVE')
  const upcoming = projected.filter((r) => r.status === 'SCHEDULED' && new Date(r.scheduledStart) > now)
  const past     = projected.filter((r) => r.status === 'ENDED').slice(0, 40)

  return (
    <ClassroomFeed
      live={live}
      upcoming={upcoming}
      past={past}
      nowMs={nowMs}
      canSchedule={canSchedule}
    />
  )
}
