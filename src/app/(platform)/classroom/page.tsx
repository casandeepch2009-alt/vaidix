import Link from 'next/link'
import { Video, Calendar, Clock, Play, Users } from 'lucide-react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { SessionApprovalStatus, SessionStatus } from '@prisma/client'

interface ListedSession {
  id: string
  title: string
  sessionType: string
  status: SessionStatus
  scheduledStart: string
  scheduledEnd: string
  host: { id: string; name: string }
  participantCount: number
}

const typeBadgeColor: Record<string, string> = {
  LECTURE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  GRAND_ROUNDS: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  CASE_CONFERENCE: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  JOURNAL_CLUB: 'bg-green-500/10 text-green-700 dark:text-green-400',
  SKILLS_WORKSHOP: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  ASSESSMENT: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
}

export default async function ClassroomListPage() {
  const s = await auth()
  if (!s?.user) redirect('/login')

  const now = new Date()
  const horizon = new Date(Date.now() + 30 * 24 * 3600 * 1000)

  const sessions = await db.teachingSession.findMany({
    where: {
      deletedAt: null,
      approvalStatus: SessionApprovalStatus.APPROVED,
      scheduledEnd: { gt: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
      scheduledStart: { lt: horizon },
    },
    include: {
      host: { select: { id: true, name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { scheduledStart: 'asc' },
    take: 200,
  })

  const rows: ListedSession[] = sessions.map((x) => ({
    id: x.id,
    title: x.title,
    sessionType: x.sessionType,
    status: x.status,
    scheduledStart: x.scheduledStart.toISOString(),
    scheduledEnd: x.scheduledEnd.toISOString(),
    host: x.host,
    participantCount: x._count.participants,
  }))

  const live = rows.filter((r) => r.status === 'LIVE')
  const upcoming = rows.filter(
    (r) => r.status === 'SCHEDULED' && new Date(r.scheduledStart) > now
  )
  const past = rows.filter((r) => r.status === 'ENDED').slice(-30).reverse()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Video className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Classroom</h1>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="live">
            Live {live.length > 0 && <Badge className="ml-2">{live.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          {live.length === 0 ? (
            <Empty message="No sessions live right now" />
          ) : (
            <SessionList items={live} now={now} />
          )}
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length === 0 ? (
            <Empty message="No upcoming sessions in the next 30 days" />
          ) : (
            <SessionList items={upcoming} now={now} />
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          {past.length === 0 ? (
            <Empty message="No past sessions" />
          ) : (
            <SessionList items={past} now={now} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SessionList({ items, now }: { items: ListedSession[]; now: Date }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((s) => {
        const start = new Date(s.scheduledStart)
        const inWindow = s.status === 'LIVE' || start.getTime() - now.getTime() <= 15 * 60 * 1000
        return (
          <div key={s.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <span
                  className={cn(
                    'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    typeBadgeColor[s.sessionType] ?? 'bg-muted text-muted-foreground'
                  )}
                >
                  {s.sessionType.replace(/_/g, ' ')}
                </span>
              </div>
              {s.status === 'LIVE' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-600" /> LIVE
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3" /> {start.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3" /> {Math.round((new Date(s.scheduledEnd).getTime() - start.getTime()) / 60000)} min
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="size-3" /> Hosted by {s.host.name} · {s.participantCount} joined
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href={`/classroom/${s.id}`}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium',
                  inWindow
                    ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Play className="size-3" />
                {s.status === 'ENDED' ? 'View' : inWindow ? 'Join' : 'Details'}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
