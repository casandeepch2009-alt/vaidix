import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CalendarView } from '@/components/calendar/calendar-view'
import { cn } from '@/lib/utils'
import { Role } from '@prisma/client'

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const canCreate =
    session.user.role === Role.PROGRAM_DIRECTOR || session.user.role === Role.ADMIN

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        </div>
        {canCreate && (
          <Link
            href="/calendar/new"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80'
            )}
          >
            <Plus className="size-4" /> Schedule Session
          </Link>
        )}
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <LegendDot color="bg-blue-500" label="Approved" />
        <LegendDot color="bg-green-500" label="Live" />
        <LegendDot color="bg-amber-500" label="Pending approval" />
        <LegendDot color="bg-slate-400" label="Cancelled" />
      </div>

      <CalendarView canCreate={canCreate} />
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
