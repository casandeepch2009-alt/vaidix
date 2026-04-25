'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RRule, Frequency, Weekday } from 'rrule'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Faculty {
  id: string
  name: string
  email: string
  role: string
}

interface Cohort {
  id: string
  name: string
  memberCount: number
}

interface Props {
  faculty: Faculty[]
  cohorts: Cohort[]
  defaultStart?: string
  defaultEnd?: string
  currentUserId: string
}

type Visibility = 'OPEN_TO_ALL' | 'COHORT' | 'INVITE_ONLY' | 'PRIVATE'
type SessionType =
  | 'LECTURE'
  | 'GRAND_ROUNDS'
  | 'CASE_CONFERENCE'
  | 'JOURNAL_CLUB'
  | 'SKILLS_WORKSHOP'
  | 'ASSESSMENT'

const WEEKDAYS: Array<{ label: string; rrule: Weekday }> = [
  { label: 'Mo', rrule: RRule.MO },
  { label: 'Tu', rrule: RRule.TU },
  { label: 'We', rrule: RRule.WE },
  { label: 'Th', rrule: RRule.TH },
  { label: 'Fr', rrule: RRule.FR },
  { label: 'Sa', rrule: RRule.SA },
  { label: 'Su', rrule: RRule.SU },
]

function toLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export function NewSessionForm({ faculty, cohorts, defaultStart, defaultEnd, currentUserId }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>('LECTURE')
  const [hostId, setHostId] = useState(faculty[0]?.id ?? '')
  const [start, setStart] = useState(toLocalInput(defaultStart) || '')
  const [end, setEnd] = useState(toLocalInput(defaultEnd) || '')
  const [visibility, setVisibility] = useState<Visibility>('OPEN_TO_ALL')
  const [cohortId, setCohortId] = useState('')
  const [inviteeIds, setInviteeIds] = useState<string[]>([])

  // Recurrence
  const [repeats, setRepeats] = useState(false)
  const [freq, setFreq] = useState<'WEEKLY' | 'DAILY' | 'MONTHLY'>('WEEKLY')
  const [byDays, setByDays] = useState<Set<string>>(new Set(['MO']))
  const [count, setCount] = useState(8)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hostIsSelf = hostId === currentUserId
  const visibleCohortPicker = visibility === 'COHORT'
  const visibleInvitePicker = visibility === 'INVITE_ONLY'

  function buildRRule(): string | undefined {
    if (!repeats) return undefined
    const freqMap = { WEEKLY: Frequency.WEEKLY, DAILY: Frequency.DAILY, MONTHLY: Frequency.MONTHLY }
    const byweekday =
      freq === 'WEEKLY'
        ? WEEKDAYS.filter((w) => byDays.has(w.label.toUpperCase().slice(0, 2))).map((w) => w.rrule)
        : undefined
    const rule = new RRule({
      freq: freqMap[freq],
      byweekday,
      count,
      dtstart: new Date(start),
    })
    // Strip DTSTART:... line — backend expects RRULE body only
    return rule.toString().split('\n').find((l) => l.startsWith('RRULE:'))?.replace('RRULE:', '')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        title,
        description: description || undefined,
        sessionType,
        hostId,
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd: new Date(end).toISOString(),
        visibility,
        cohortId: visibleCohortPicker ? cohortId : undefined,
        inviteeIds: visibleInvitePicker ? inviteeIds : undefined,
        recurrenceRule: buildRRule(),
        maxParticipants: 100,
        recordingEnabled: true,
        consentRequired: true,
        tags: [],
      }
      const res = await fetch('/api/classroom/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) {
        if (json.error?.code === 'HOST_CONFLICT') {
          const c = json.error.details?.[0]
          throw new Error(
            c ? `Host has a conflict with "${c.title}" (${new Date(c.scheduledStart).toLocaleString()})` : json.error.message
          )
        }
        throw new Error(json.error?.message ?? 'Failed to create session')
      }
      router.push('/calendar')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-6 rounded-lg border bg-card p-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Title *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Session type</label>
          <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LECTURE">Lecture</SelectItem>
              <SelectItem value="GRAND_ROUNDS">Grand Rounds</SelectItem>
              <SelectItem value="CASE_CONFERENCE">Case Conference</SelectItem>
              <SelectItem value="JOURNAL_CLUB">Journal Club</SelectItem>
              <SelectItem value="SKILLS_WORKSHOP">Skills Workshop</SelectItem>
              <SelectItem value="ASSESSMENT">Assessment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Faculty host *</label>
          <Select value={hostId} onValueChange={(v) => setHostId(v ?? '')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {faculty.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} {f.id === currentUserId && '(you)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hostIsSelf && (
            <p className="text-xs text-muted-foreground">
              You're the host — session will auto-approve (no faculty approval step).
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Start *</label>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">End *</label>
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Visibility</label>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN_TO_ALL">Open to all (every resident + faculty)</SelectItem>
            <SelectItem value="COHORT">Cohort (pick a group)</SelectItem>
            <SelectItem value="INVITE_ONLY">Invite only (pick specific users)</SelectItem>
            <SelectItem value="PRIVATE">Private (host + me only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visibleCohortPicker && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Cohort *</label>
          <Select value={cohortId} onValueChange={(v) => setCohortId(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.memberCount} members)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {visibleInvitePicker && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Invite users *</label>
          <p className="text-xs text-muted-foreground">
            (Multi-select picker TODO — use cohort for now, or type IDs separated by commas)
          </p>
          <Input
            placeholder="userid1, userid2, userid3"
            onChange={(e) =>
              setInviteeIds(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </div>
      )}

      <div className="space-y-3 rounded-md border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
          Repeats
        </label>
        {repeats && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency</label>
                <Select value={freq} onValueChange={(v) => setFreq(v as 'WEEKLY' | 'DAILY' | 'MONTHLY')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Occurrences</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
            </div>
            {freq === 'WEEKLY' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">On days</label>
                <div className="flex gap-2">
                  {WEEKDAYS.map((w) => {
                    const key = w.label.toUpperCase().slice(0, 2)
                    const active = byDays.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = new Set(byDays)
                          if (active) next.delete(key)
                          else next.add(key)
                          setByDays(next)
                        }}
                        className={`size-9 rounded-md border text-xs font-medium ${
                          active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
                        }`}
                      >
                        {w.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : hostIsSelf ? 'Schedule' : 'Send for approval'}
        </Button>
      </div>
    </form>
  )
}
