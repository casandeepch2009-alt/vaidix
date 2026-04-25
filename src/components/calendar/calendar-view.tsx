'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer, Views, type View, type SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { cn } from '@/lib/utils'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

interface ApiEvent {
  id: string
  sessionId: string
  title: string
  start: string
  end: string
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
  approvalStatus: 'DRAFT' | 'PENDING_FACULTY' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  visibility: 'OPEN_TO_ALL' | 'COHORT' | 'INVITE_ONLY' | 'PRIVATE'
  host: { id: string; name: string } | null
  isRecurring: boolean
  isOccurrence: boolean
}

interface CalEvent {
  id: string
  sessionId: string
  title: string
  start: Date
  end: Date
  resource: ApiEvent
}

interface CalendarViewProps {
  canCreate: boolean
}

export function CalendarView({ canCreate }: CalendarViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState<Date>(new Date())

  const fetchEvents = useCallback(async (anchor: Date) => {
    setLoading(true)
    setError(null)
    try {
      // Fetch a generous window — prev month to +2 months from anchor
      const from = startOfMonth(addMonths(anchor, -1))
      const to = endOfMonth(addMonths(anchor, 2))
      const url = `/api/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load calendar')
      const apiEvents = json.data.events as ApiEvent[]
      setEvents(
        apiEvents.map((e) => ({
          id: e.id,
          sessionId: e.sessionId,
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
          resource: e,
        }))
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents(date)
  }, [date, fetchEvents])

  const eventPropGetter = useMemo(
    () => (event: CalEvent) => {
      const r = event.resource
      const base = 'border-0 rounded-md text-xs font-medium px-2 py-1'
      if (r.approvalStatus === 'APPROVED' && r.status === 'LIVE')
        return { className: cn(base, 'bg-green-500/90 text-white') }
      if (r.approvalStatus === 'APPROVED')
        return { className: cn(base, 'bg-blue-500/90 text-white') }
      if (r.approvalStatus === 'PENDING_FACULTY')
        return { className: cn(base, 'bg-amber-500/90 text-white') }
      if (r.approvalStatus === 'CANCELLED' || r.status === 'CANCELLED')
        return { className: cn(base, 'bg-slate-400/80 text-white line-through') }
      return { className: cn(base, 'bg-slate-500/80 text-white') }
    },
    []
  )

  const onSelectEvent = useCallback(
    (event: CalEvent) => {
      router.push(`/classroom/${event.sessionId}`)
    },
    [router]
  )

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (!canCreate) return
      const params = new URLSearchParams({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })
      router.push(`/calendar/new?${params.toString()}`)
    },
    [canCreate, router]
  )

  return (
    <div className="rounded-lg border bg-card p-4">
      {error && (
        <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="h-[700px]">
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          popup
          selectable={canCreate}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          eventPropGetter={eventPropGetter}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
        />
      </div>
      {loading && <p className="mt-2 text-xs text-muted-foreground">Loading events…</p>}
    </div>
  )
}
