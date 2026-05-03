'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RRule, Frequency, Weekday } from 'rrule'
import {
  Link2, Copy, Check, Loader2, Calendar as CalendarIcon,
  Globe, UsersRound, UserCheck, Lock, Repeat, Sparkles, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ObjectivesEditor, type ObjectiveDraft } from '@/components/classroom/objectives-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { UserPicker, type PickableUser } from '@/components/user-picker'
import { CohortQuickAdd } from '@/components/cohort-quick-add'

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

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  LECTURE:          'Lecture',
  GRAND_ROUNDS:     'Grand Rounds',
  CASE_CONFERENCE:  'Case Conference',
  JOURNAL_CLUB:     'Journal Club',
  SKILLS_WORKSHOP:  'Skills Workshop',
  ASSESSMENT:       'Assessment',
}

const VISIBILITY_OPTIONS: Array<{
  value: Visibility; label: string; description: string; icon: typeof Globe
}> = [
  { value: 'OPEN_TO_ALL', label: 'Open to all',  description: 'Every resident + faculty in the institution',     icon: Globe },
  { value: 'COHORT',      label: 'Cohort',       description: 'Members of a single cohort (live membership)',    icon: UsersRound },
  { value: 'INVITE_ONLY', label: 'Invite only',  description: 'Specific people you pick (snapshot at create)',   icon: UserCheck },
  { value: 'PRIVATE',     label: 'Private',      description: 'Only the host and you',                            icon: Lock },
]

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

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function humanRole(r: string): string {
  return r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function NewSessionForm({ faculty, cohorts, defaultStart, defaultEnd, currentUserId }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>([])
  const [sessionType, setSessionType] = useState<SessionType>('LECTURE')
  const [hostId, setHostId] = useState(faculty[0]?.id ?? '')
  const [start, setStart] = useState(toLocalInput(defaultStart) || '')
  const [end, setEnd] = useState(toLocalInput(defaultEnd) || '')
  const [visibility, setVisibility] = useState<Visibility>('OPEN_TO_ALL')
  const [cohortId, setCohortId] = useState('')
  const [invitees, setInvitees] = useState<PickableUser[]>([])

  // Share link
  const [generateShareLink, setGenerateShareLink] = useState(false)
  const [shareTtlHours, setShareTtlHours] = useState(48)
  const [createdShareLink, setCreatedShareLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Recurrence
  const [repeats, setRepeats] = useState(false)
  const [freq, setFreq] = useState<'WEEKLY' | 'DAILY' | 'MONTHLY'>('WEEKLY')
  const [byDays, setByDays] = useState<Set<string>>(new Set(['MO']))
  const [count, setCount] = useState(8)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hostIsSelf          = hostId === currentUserId
  const visibleCohortPicker = visibility === 'COHORT'
  const visibleInvitePicker = visibility === 'INVITE_ONLY'
  const selectedHost        = faculty.find((f) => f.id === hostId)

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
        inviteeIds: visibleInvitePicker ? invitees.map((u) => u.id) : undefined,
        recurrenceRule: buildRRule(),
        maxParticipants: 100,
        recordingEnabled: true,
        consentRequired: true,
        tags: [],
        objectives:
          objectives.length > 0
            ? objectives.filter((o) => o.text.trim().length >= 3)
            : undefined,
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

      const created = json.data?.session ?? json.data
      const newId   = created?.id
      if (generateShareLink && newId) {
        const linkRes = await fetch(`/api/classroom/sessions/${newId}/share-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttlHours: shareTtlHours }),
        })
        const linkBody = await linkRes.json()
        if (linkBody.ok) {
          setCreatedShareLink({ url: linkBody.data.url, expiresAt: linkBody.data.expiresAt })
          setSubmitting(false)
          return
        }
        setError(`Session created, but share-link failed: ${linkBody.error?.message ?? 'unknown'}`)
      }

      router.push('/calendar')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function copyShareLink() {
    if (!createdShareLink) return
    await navigator.clipboard.writeText(createdShareLink.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Section 1: Basics ── */}
      <Section title="Basics" subtitle="What is the class about?" icon={Sparkles}>
        <div className="space-y-2">
          <Label required>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Grand Rounds — Macular Holes"
            className="rounded-xl border-2 px-3.5 py-2.5"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Session type</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType((v ?? 'LECTURE') as SessionType)}>
              <SelectTrigger className="w-full rounded-xl border-2 py-2.5">
                <SelectValue>
                  {(v) => SESSION_TYPE_LABEL[v as SessionType] ?? 'Select type'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((k) => (
                  <SelectItem key={k} value={k}>{SESSION_TYPE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label required>Faculty host</Label>
            <Select value={hostId} onValueChange={(v) => setHostId(v ?? '')}>
              <SelectTrigger className="w-full rounded-xl border-2 py-2.5">
                <SelectValue placeholder="Select a host">
                  {(v) => {
                    const f = faculty.find((x) => x.id === v)
                    if (!f) return 'Select a host'
                    return (
                      <span className="flex items-center gap-2 text-left">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {initials(f.name)}
                        </span>
                        <span className="truncate font-medium">{f.name}</span>
                        {f.id === currentUserId && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">YOU</span>
                        )}
                      </span>
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {faculty.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {initials(f.name)}
                      </span>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">· {humanRole(f.role)}</span>
                      {f.id === currentUserId && (
                        <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">YOU</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHost && (
              <p className={`text-xs ${hostIsSelf ? 'text-primary' : 'text-muted-foreground'}`}>
                {hostIsSelf
                  ? '✓ You\'re hosting — auto-approved, no faculty review needed.'
                  : `${selectedHost.name} will receive an approval request before this session is published.`}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Optional — quick summary, prep notes, anything residents should know…"
            className="rounded-xl border-2 px-3.5 py-2.5"
          />
        </div>

        <div className="space-y-2">
          <Label>Learning objectives</Label>
          <ObjectivesEditor value={objectives} onChange={setObjectives} disabled={submitting} />
        </div>
      </Section>

      {/* ── Section 2: When ── */}
      <Section title="When" subtitle="Date, time, and recurrence" icon={CalendarIcon}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateTimePicker label="Start" required value={start} onChange={setStart} />
          <DateTimePicker label="End"   required value={end}   onChange={setEnd} />
        </div>

        <div className="rounded-xl border-2 border-input p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={repeats}
              onChange={(e) => setRepeats(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <Repeat className="size-4 text-primary" />
            Repeats
            {repeats && (
              <span className="text-xs font-normal text-muted-foreground">
                ({count} {freq.toLowerCase()} occurrence{count === 1 ? '' : 's'})
              </span>
            )}
          </label>

          {repeats && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={freq}
                    onValueChange={(v) => setFreq((v ?? 'WEEKLY') as 'WEEKLY' | 'DAILY' | 'MONTHLY')}
                  >
                    <SelectTrigger className="w-full rounded-xl border-2 py-2.5">
                      <SelectValue>
                        {(v) => ({ DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' } as Record<string, string>)[v as string] ?? 'Select'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Occurrences</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="rounded-xl border-2 px-3.5 py-2.5"
                  />
                </div>
              </div>
              {freq === 'WEEKLY' && (
                <div className="space-y-2">
                  <Label>On days</Label>
                  <div className="flex gap-1.5">
                    {WEEKDAYS.map((w) => {
                      const key = w.label.toUpperCase().slice(0, 2)
                      const active = byDays.has(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const next = new Set(byDays)
                            if (active) next.delete(key); else next.add(key)
                            setByDays(next)
                          }}
                          className={`size-10 rounded-xl border-2 text-xs font-bold transition ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground shadow'
                              : 'border-input bg-card text-muted-foreground hover:border-primary/40'
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
      </Section>

      {/* ── Section 3: Audience ── */}
      <Section title="Who can join" subtitle="Visibility and invite list" icon={UsersRound}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const selected = visibility === opt.value
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-input hover:border-primary/40 hover:bg-accent/40'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setVisibility(opt.value)}
                  className="sr-only"
                />
                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`size-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{opt.label}</span>
                    {selected && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            )
          })}
        </div>

        {visibleCohortPicker && (
          <div className="space-y-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
            <Label required>Pick a cohort</Label>
            <Select value={cohortId} onValueChange={(v) => setCohortId(v ?? '')}>
              <SelectTrigger className="w-full rounded-xl border-2 bg-card py-2.5">
                <SelectValue placeholder="Select cohort">
                  {(v) => {
                    const c = cohorts.find((x) => x.id === v)
                    if (!c) return 'Select cohort'
                    return (
                      <span className="flex items-center gap-2">
                        <UsersRound className="size-4 text-primary" />
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">· {c.memberCount} member{c.memberCount === 1 ? '' : 's'}</span>
                      </span>
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cohorts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No cohorts yet — create one in Admin → Cohorts</div>
                ) : (
                  cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <UsersRound className="size-3.5 text-primary" />
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.memberCount})</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Live membership — anyone added to this cohort later will also see this session.
            </p>
          </div>
        )}

        {visibleInvitePicker && (
          <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
            <div>
              <Label required>Invite users</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quick-add a whole cohort, or pick individuals. Snapshot at create time — adding to a cohort later won&apos;t auto-invite.
              </p>
            </div>
            <CohortQuickAdd selected={invitees} onChange={setInvitees} />
            <UserPicker
              selected={invitees}
              onChange={setInvitees}
              placeholder="Search by name or email…"
            />
            {invitees.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="size-3.5" /> At least one invitee is required.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ── Section 4: Options ── */}
      <Section title="Options" subtitle="Share link and other settings" icon={Link2}>
        <div className="rounded-xl border-2 border-input p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={generateShareLink}
              onChange={(e) => setGenerateShareLink(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <Link2 className="size-4 text-primary" />
            Generate a share link
            <span className="text-xs font-normal text-muted-foreground">
              (anyone with the link can join, regardless of visibility)
            </span>
          </label>

          {generateShareLink && (
            <div className="mt-3 border-t border-border pt-3">
              <Label>Link expires in</Label>
              <Select
                value={String(shareTtlHours)}
                onValueChange={(v) => setShareTtlHours(parseInt(v ?? '48'))}
              >
                <SelectTrigger className="mt-1.5 w-56 rounded-xl border-2 py-2.5">
                  <SelectValue>
                    {(v) => ({
                      '24':  '24 hours',
                      '48':  '48 hours (recommended)',
                      '72':  '72 hours',
                      '168': '7 days',
                    } as Record<string, string>)[String(v)] ?? '48 hours'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours (recommended)</SelectItem>
                  <SelectItem value="72">72 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Section>

      {/* ── Share-link success banner ── */}
      {createdShareLink && (
        <div className="space-y-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
            <Check className="size-4" /> Session created — share link ready
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Expires {new Date(createdShareLink.expiresAt).toLocaleString()}.
          </p>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 overflow-hidden rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 dark:bg-emerald-950/60 dark:text-emerald-100">
              <div className="truncate">{createdShareLink.url}</div>
            </div>
            <button
              type="button"
              onClick={copyShareLink}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <Button type="button" variant="outline" onClick={() => router.push('/calendar')}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      <div className="sticky bottom-0 z-10 -mx-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {hostIsSelf
            ? 'You\'re the host — session schedules immediately.'
            : 'Faculty host will be asked to approve before the session is published.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {submitting ? 'Saving…' : hostIsSelf ? 'Schedule session' : 'Send for approval'}
          </Button>
        </div>
      </div>
    </form>
  )
}

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({
  title, subtitle, icon: Icon, children,
}: {
  title: string
  subtitle?: string
  icon: typeof Sparkles
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

// ─── Label helper ───────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-sm font-semibold text-foreground">
      {children}
      {required && <span className="text-destructive">*</span>}
    </label>
  )
}


