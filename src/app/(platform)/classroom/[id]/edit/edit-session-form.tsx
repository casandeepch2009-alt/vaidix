'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Calendar as CalendarIcon, Globe, UsersRound, UserCheck, Lock,
  Sparkles, AlertCircle, ShieldCheck, MessageCircleQuestion, BookOpen, Target, Check,
} from 'lucide-react'
import type { PrereqConfig } from '@/lib/validation/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ObjectivesEditor, type ObjectiveDraft } from '@/components/classroom/objectives-editor'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { UserPicker, type PickableUser } from '@/components/user-picker'
import { CohortQuickAdd } from '@/components/cohort-quick-add'
import type { SessionVisibility } from '@prisma/client'

interface Faculty { id: string; name: string; email: string; role: string }
interface Cohort { id: string; name: string; memberCount: number }
interface Topic { id: string; name: string; subspecialty: string | null }

type SessionType =
  | 'LECTURE' | 'GRAND_ROUNDS' | 'CASE_CONFERENCE'
  | 'JOURNAL_CLUB' | 'SKILLS_WORKSHOP' | 'ASSESSMENT'

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  LECTURE:          'Lecture',
  GRAND_ROUNDS:     'Grand Rounds',
  CASE_CONFERENCE:  'Case Conference',
  JOURNAL_CLUB:     'Journal Club',
  SKILLS_WORKSHOP:  'Skills Workshop',
  ASSESSMENT:       'Assessment',
}

const VISIBILITY_DISPLAY: Record<SessionVisibility, { label: string; description: string; icon: typeof Globe }> = {
  OPEN_TO_ALL: { label: 'Anyone with link', description: 'Anyone with the link can join. Not on others’ calendars.',  icon: Globe },
  COHORT:      { label: 'Cohort',            description: 'Members of the selected cohort (live membership)',         icon: UsersRound },
  INVITE_ONLY: { label: 'Invite only',       description: 'Only the people you invite below',                         icon: UserCheck },
  PRIVATE:     { label: 'Private',           description: 'Only the host',                                             icon: Lock },
}

interface InitialState {
  title: string
  description: string | null
  sessionType: string
  hostId: string
  topicId: string | null
  scheduledStart: string
  scheduledEnd: string
  visibility: SessionVisibility
  cohort: { id: string; name: string } | null
  invitees: PickableUser[]
  recordingEnabled: boolean
  consentRequired: boolean
  maxParticipants: number
  objectives: Array<{ id: string; text: string; blooms: number }>
  metadata: unknown
  /// RRULE string when this session is part of a recurring series. The
  /// edit form shows the Teams/Outlook scope picker only when this is set.
  recurrenceRule?: string | null
}

/// Edit-scope for recurring sessions — mirrors the Outlook/Teams choices
/// the user sees when editing one occurrence of a series.
type EditScope = 'occurrence' | 'this_and_following' | 'series'

interface Props {
  sessionId: string
  initial: InitialState
  faculty: Faculty[]
  cohorts: Cohort[]
  topics: Topic[]
  currentUserId: string
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

function toIsoFromLocal(local: string): string {
  return new Date(local).toISOString()
}

function addMinutesToLocal(local: string, minutes: number): string {
  const [datePart, timePart] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const next = new Date(y, mo - 1, d, h, mi + minutes)
  const tzOffset = next.getTimezoneOffset() * 60000
  return new Date(next.getTime() - tzOffset).toISOString().slice(0, 16)
}

function diffMinutes(start: string, end: string): number | null {
  if (!start || !end) return null
  const [sd, st] = start.split('T'); const [ed, et] = end.split('T')
  const [sy, smo, sda] = sd.split('-').map(Number); const [sh, smi] = st.split(':').map(Number)
  const [ey, emo, eda] = ed.split('-').map(Number); const [eh, emi] = et.split(':').map(Number)
  const a = new Date(sy, smo - 1, sda, sh, smi).getTime()
  const b = new Date(ey, emo - 1, eda, eh, emi).getTime()
  return Math.round((b - a) / 60000)
}

const DURATION_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hour', minutes: 90 },
  { label: '2 hours', minutes: 120 },
]

function readPrereq(metadata: unknown): PrereqConfig | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as Record<string, unknown>
  const p = m.prereq
  if (!p || typeof p !== 'object') return null
  return p as PrereqConfig
}

export function EditSessionForm({ sessionId, initial, faculty, topics, currentUserId }: Props) {
  const router = useRouter()
  const initialPrereq = readPrereq(initial.metadata)

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [sessionType, setSessionType] = useState<SessionType>(initial.sessionType as SessionType)
  // Host change is intentionally not editable here (would re-route approval
  // and orphan notifications). Stored as a constant so the form can still
  // display the host's name.
  const hostId = initial.hostId
  const [topicId, setTopicId] = useState(initial.topicId ?? '')
  const [start, setStart] = useState(toLocalInput(initial.scheduledStart))
  const [end, setEnd] = useState(toLocalInput(initial.scheduledEnd))
  const [invitees, setInvitees] = useState<PickableUser[]>(initial.invitees)
  const [recordingEnabled, setRecordingEnabled] = useState(initial.recordingEnabled)
  const [consentRequired, setConsentRequired] = useState(initial.consentRequired)
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>(
    initial.objectives.map((o) => ({ id: o.id, text: o.text, blooms: o.blooms }))
  )

  const [prereqMode, setPrereqMode] = useState<PrereqConfig['mode']>(initialPrereq?.mode ?? 'NONE')
  const [requirePreQuestions, setRequirePreQuestions] = useState(initialPrereq?.requirePreQuestions ?? false)
  const [minPreQuestions, setMinPreQuestions] = useState(initialPrereq?.minPreQuestions ?? 1)
  const [requireStudyPack, setRequireStudyPack] = useState(initialPrereq?.requireStudyPack ?? false)
  const [requireReadinessAck, setRequireReadinessAck] = useState(initialPrereq?.requireReadinessAck ?? false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recurring-edit scope (Teams/Outlook style). Only relevant when
  // initial.recurrenceRule is set. Default to 'series' so the host can
  // hit Save without explicitly choosing if they meant the whole series.
  const isRecurring = !!initial.recurrenceRule
  const [editScope, setEditScope] = useState<EditScope>('series')

  const hostIsSelf = hostId === currentUserId
  const visibilityInfo = VISIBILITY_DISPLAY[initial.visibility]
  const VisibilityIcon = visibilityInfo.icon
  const isInviteOnly = initial.visibility === 'INVITE_ONLY'

  const initialStartIso = initial.scheduledStart
  const initialEndIso = initial.scheduledEnd
  const startChanged = toIsoFromLocal(start) !== initialStartIso
  const endChanged = toIsoFromLocal(end) !== initialEndIso

  async function applyInviteeDiff(): Promise<void> {
    const initialIds = new Set(initial.invitees.map((u) => u.id))
    const currentIds = new Set(invitees.map((u) => u.id))
    const toAdd = invitees.filter((u) => !initialIds.has(u.id)).map((u) => u.id)
    const toRemove = initial.invitees.filter((u) => !currentIds.has(u.id)).map((u) => u.id)

    if (toAdd.length > 0) {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: toAdd }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to add invitees')
    }
    for (const userId of toRemove) {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/invites/${userId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to remove invitee')
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const patch = {
        title,
        description: description.trim().length === 0 ? null : description,
        recordingEnabled,
        consentRequired,
        topicId: topicId || null,
        objectives:
          objectives.length > 0
            ? objectives.filter((o) => o.text.trim().length >= 3)
            : null,
        prereq:
          prereqMode === 'NONE'
            ? undefined
            : {
                mode: prereqMode,
                requirePreQuestions,
                minPreQuestions,
                requireStudyPack,
                requireReadinessAck,
              },
      }

      const patchRes = await fetch(`/api/classroom/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const patchJson = await patchRes.json()
      if (!patchJson.ok) throw new Error(patchJson.error?.message ?? 'Failed to save')

      if (startChanged || endChanged) {
        const rRes = await fetch(`/api/classroom/sessions/${sessionId}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledStart: toIsoFromLocal(start),
            scheduledEnd: toIsoFromLocal(end),
            // TODO(recurring-scope): wire this to backend when occurrence /
            // this-and-following modes are implemented. Today the API
            // rewrites the master record only, which corresponds to 'series'.
            scope: editScope,
          }),
        })
        const rJson = await rRes.json()
        if (!rJson.ok) {
          throw new Error(rJson.error?.message ?? 'Failed to reschedule')
        }
        // Teams-style: warn but don't block on overlapping host calendar.
        const conflicts = (rJson.data?.warnings?.hostConflicts ?? []) as Array<{
          title: string; scheduledStart: string
        }>
        if (conflicts.length > 0) {
          const c = conflicts[0]
          if (typeof window !== 'undefined') {
            window.alert(`Heads up: host already has "${c.title}" at ${new Date(c.scheduledStart).toLocaleString()}. Rescheduled anyway.`)
          }
        }
      }

      if (isInviteOnly) {
        await applyInviteeDiff()
      }

      router.push(`/classroom/${sessionId}`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // Host change is intentionally not editable here — it would re-route the
  // approval flow and risks orphaning notifications. For now show as read-only.
  const selectedHost = faculty.find((f) => f.id === hostId)

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Locked visibility banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-foreground">
            Visibility is locked: <span className="font-bold">{visibilityInfo.label}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visibilityInfo.description}
            {initial.visibility === 'COHORT' && initial.cohort
              ? ` — ${initial.cohort.name}`
              : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            To change the audience type, cancel this session and create a new one.
          </p>
        </div>
      </div>

      {/* Section 1: Basics */}
      <Section title="Basics" subtitle="What is the class about?" icon={Sparkles}>
        <div className="space-y-2">
          <Label required>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="rounded-xl border-2 px-3.5 py-2.5"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Session type</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType((v ?? 'LECTURE') as SessionType)}>
              <SelectTrigger className="w-full rounded-xl border-2 py-2.5" disabled>
                <SelectValue>{(v) => SESSION_TYPE_LABEL[v as SessionType] ?? 'Select type'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((k) => (
                  <SelectItem key={k} value={k}>{SESSION_TYPE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Session type is set at creation time.</p>
          </div>
          <div className="space-y-2">
            <Label>Faculty host</Label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-input bg-muted/30 px-3.5 py-2.5">
              <VisibilityIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium text-foreground">{selectedHost?.name ?? 'Unknown host'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Host can’t be changed here. Cancel and re-schedule to assign someone else.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Topic</Label>
          <Select value={topicId || 'none'} onValueChange={(v) => setTopicId(v === 'none' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-full rounded-xl border-2 py-2.5">
              <SelectValue placeholder="No topic">
                {(v) => {
                  if (!v || v === 'none') return <span className="text-muted-foreground">No topic</span>
                  const t = topics.find((x) => x.id === v)
                  if (!t) return <span className="text-muted-foreground">No topic</span>
                  return (
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      {t.subspecialty && (
                        <span className="text-xs text-muted-foreground">· {t.subspecialty}</span>
                      )}
                    </span>
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">No topic</span>
              </SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.subspecialty && (
                      <span className="text-xs text-muted-foreground">· {t.subspecialty}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-xl border-2 px-3.5 py-2.5"
          />
        </div>

        <div className="space-y-2">
          <Label>Learning objectives</Label>
          <ObjectivesEditor value={objectives} onChange={setObjectives} disabled={submitting} />
        </div>
      </Section>

      {/* Section 2: When */}
      <Section title="When" subtitle="Date and time" icon={CalendarIcon}>
        {isRecurring && (
          <RecurringScopePicker value={editScope} onChange={setEditScope} />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateTimePicker
            label="Start"
            required
            value={start}
            onChange={(v) => {
              const oldDur = diffMinutes(start, end)
              setStart(v)
              if (!end) {
                setEnd(addMinutesToLocal(v, 60))
              } else if (oldDur !== null && oldDur > 0) {
                setEnd(addMinutesToLocal(v, oldDur))
              } else {
                setEnd(addMinutesToLocal(v, 60))
              }
            }}
          />
          <DateTimePicker
            label="End"
            required
            value={end}
            onChange={setEnd}
            min={start || undefined}
          />
        </div>
        {start && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Duration:</span>
            {DURATION_PRESETS.map((p) => {
              const active = diffMinutes(start, end) === p.minutes
              return (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() => setEnd(addMinutesToLocal(start, p.minutes))}
                  className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
            {(() => {
              const d = diffMinutes(start, end)
              if (d === null) return null
              const known = DURATION_PRESETS.some((p) => p.minutes === d)
              if (known || d <= 0) return null
              const hours = Math.floor(d / 60)
              const mins = d % 60
              const label = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`
              return (
                <span className="rounded-full border border-dashed border-input px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Custom · {label}
                </span>
              )
            })()}
          </div>
        )}
        {(startChanged || endChanged) && !hostIsSelf && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="size-3.5" />
            Time changed — host will need to re-approve.
          </p>
        )}
      </Section>

      {/* Section 3: Invitees (only when INVITE_ONLY) */}
      {isInviteOnly && (
        <Section title="Invitees" subtitle="Add or remove people invited to this session" icon={UserCheck}>
          <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
            <CohortQuickAdd selected={invitees} onChange={setInvitees} />
            <UserPicker
              selected={invitees}
              onChange={setInvitees}
              placeholder="Search by name or email…"
            />
            {invitees.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="size-3.5" /> Invite-only sessions need at least one invitee.
              </p>
            )}
          </div>
        </Section>
      )}

      {/* Section 4: Prerequisites */}
      <Section title="Prerequisites" subtitle="Optional gate — make residents finish prep before they can join" icon={ShieldCheck}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            { v: 'NONE',      label: 'No gate',    desc: 'Anyone can join when the room opens' },
            { v: 'OPTIONAL',  label: 'Show only',  desc: 'Display progress but don’t block joining' },
            { v: 'MANDATORY', label: 'Required',   desc: 'Block Join until checks pass' },
          ] as Array<{ v: PrereqConfig['mode']; label: string; desc: string }>).map((m) => {
            const selected = prereqMode === m.v
            return (
              <label
                key={m.v}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition ${
                  selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-input hover:border-primary/40 hover:bg-accent/40'
                }`}
              >
                <input
                  type="radio"
                  name="prereqMode"
                  value={m.v}
                  checked={selected}
                  onChange={() => setPrereqMode(m.v)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{m.label}</span>
                  {selected && <Check className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </label>
            )
          })}
        </div>

        {prereqMode !== 'NONE' && (
          <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
            <label className="flex items-start gap-2.5 rounded-lg border-2 border-input bg-card p-3 transition hover:border-primary/40">
              <input
                type="checkbox"
                checked={requirePreQuestions}
                onChange={(e) => setRequirePreQuestions(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <MessageCircleQuestion className="mt-0.5 size-4 text-primary" />
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground">Pre-questions submitted</span>
                {requirePreQuestions && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Minimum:</span>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={minPreQuestions}
                      onChange={(e) => setMinPreQuestions(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 rounded-lg border-2 px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </div>
            </label>
            <label className="flex items-start gap-2.5 rounded-lg border-2 border-input bg-card p-3 transition hover:border-primary/40">
              <input
                type="checkbox"
                checked={requireStudyPack}
                onChange={(e) => setRequireStudyPack(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <BookOpen className="mt-0.5 size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Study pack opened</span>
            </label>
            <label className="flex items-start gap-2.5 rounded-lg border-2 border-input bg-card p-3 transition hover:border-primary/40">
              <input
                type="checkbox"
                checked={requireReadinessAck}
                onChange={(e) => setRequireReadinessAck(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <Target className="mt-0.5 size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Readiness self-marked</span>
            </label>
          </div>
        )}
      </Section>

      {/* Section 5: Recording */}
      <Section title="Recording" subtitle="Recording and consent" icon={Sparkles}>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={recordingEnabled}
            onChange={(e) => setRecordingEnabled(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Enable recording
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={consentRequired}
            onChange={(e) => setConsentRequired(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Require consent before joining
        </label>
      </Section>

      {/* Footer actions */}
      <div className="sticky bottom-0 z-10 -mx-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {(startChanged || endChanged) && !hostIsSelf
            ? 'Time changed — saving will move the session back to pending approval.'
            : 'Saving applies changes immediately.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:opacity-90">
            {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}

function Section({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string; icon: typeof Sparkles; children: React.ReactNode
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

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex items-center gap-1 text-sm font-semibold text-foreground">
      {children}
      {required && <span className="text-destructive">*</span>}
    </label>
  )
}

// ─── Recurring scope picker ──────────────────────────────────────────────────
// Mirrors the prompt Outlook / Teams shows when you edit one occurrence of
// a recurring meeting. Three radio options:
//
//   1. Just this occurrence       — apply only to this date
//   2. This and following          — split the series at this date
//   3. Entire series               — apply to every occurrence (default)
//
// Backend support for occurrence/this-and-following is not yet built (the
// API currently rewrites the master record only). Those options are
// marked "coming soon" and disabled to prevent confusing user expectations.

const SCOPE_OPTIONS: Array<{
  value: EditScope
  label: string
  desc: string
  enabled: boolean
}> = [
  {
    value: 'occurrence',
    label: 'Just this occurrence',
    desc: 'Only this single date is changed; the rest of the series is unaffected.',
    enabled: false,
  },
  {
    value: 'this_and_following',
    label: 'This and following',
    desc: 'Split the series — this date and every later occurrence pick up the change.',
    enabled: false,
  },
  {
    value: 'series',
    label: 'Entire series',
    desc: 'Apply the change to every occurrence in the series.',
    enabled: true,
  },
]

function RecurringScopePicker({
  value,
  onChange,
}: {
  value: EditScope
  onChange: (v: EditScope) => void
}) {
  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <CalendarIcon className="size-3.5" />
        Recurring session — what should change?
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        This session is part of a series. Pick which occurrences inherit your edits.
      </p>
      <div className="mt-3 space-y-1.5">
        {SCOPE_OPTIONS.map((opt) => {
          const active = value === opt.value
          const disabled = !opt.enabled
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`flex w-full items-start gap-3 rounded-lg border-2 px-3 py-2 text-left transition ${
                active
                  ? 'border-amber-500 bg-amber-100/70 dark:bg-amber-500/15'
                  : 'border-transparent hover:border-amber-300/60 hover:bg-amber-100/40 dark:hover:bg-amber-500/10'
              } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
            >
              <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  active
                    ? 'border-amber-600 bg-amber-600'
                    : 'border-muted-foreground/40 bg-card'
                }`}
              >
                {active && <span className="size-1.5 rounded-full bg-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  {opt.label}
                  {disabled && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {opt.desc}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
