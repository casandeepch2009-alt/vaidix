import Link from 'next/link'
import { Plus, Video } from 'lucide-react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/calendar/calendar-view'
import { Role } from '@prisma/client'

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const canCreate =
    session.user.role === Role.PROGRAM_DIRECTOR ||
    session.user.role === Role.ADMIN ||
    session.user.role === Role.FACULTY ||
    session.user.role === Role.RESIDENT

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10">
            <Video className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Live Classes</h1>
            <p className="text-sm text-muted-foreground">
              {canCreate
                ? 'Schedule and manage teaching sessions for your programme'
                : 'Browse and join upcoming live sessions'}
            </p>
          </div>
        </div>

        {canCreate && (
          <Link
            href="/calendar/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="size-4" />
            Schedule Session
          </Link>
        )}
      </div>

      <CalendarView canCreate={canCreate} userRole={session.user.role as string} />
    </div>
  )
}
