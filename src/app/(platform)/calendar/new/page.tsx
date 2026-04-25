import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { Role, CohortStatus } from '@prisma/client'
import { NewSessionForm } from './new-session-form'

interface PageProps {
  searchParams: Promise<{ start?: string; end?: string }>
}

export default async function NewSessionPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== Role.PROGRAM_DIRECTOR && session.user.role !== Role.ADMIN) {
    redirect('/calendar')
  }

  const params = await searchParams

  const [faculty, cohorts] = await Promise.all([
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
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule Session</h1>
        <p className="text-sm text-muted-foreground">
          Pick a faculty host; they will receive an approval request. The session appears on
          attendee calendars once approved.
        </p>
      </div>
      <NewSessionForm
        faculty={faculty}
        cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, memberCount: c._count.members }))}
        defaultStart={params.start}
        defaultEnd={params.end}
        currentUserId={session.user.id}
      />
    </div>
  )
}
