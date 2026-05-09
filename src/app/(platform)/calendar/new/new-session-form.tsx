'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { RRule, Frequency } from 'rrule'
import {
  Link2, Copy, Check, Loader2,
  Globe, UsersRound, UserCheck, Lock, Repeat, AlertCircle,
  ShieldCheck, MessageCircleQuestion, BookOpen, Target,
  GraduationCap, Activity, FolderOpen, BookMarked, Wrench, ClipboardCheck,
  ChevronRight, ChevronLeft, CalendarDays, Clock, Sparkles, Zap,
  ChevronDown, Plus, X,
} from 'lucide-react'
import type { PrereqConfig } from '@/lib/validation/session'
import { cn } from '@/lib/utils'
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

interface Faculty { id: string; name: string; email: string; role: string }
interface Cohort { id: string; name: string; memberCount: number }
interface Topic { id: string; name: string; subspecialty: string | null }

interface Props {
  faculty: Faculty[]
  cohorts: Cohort[]
  topics: Topic[]
  defaultStart?: string
  defaultEnd?: string
  currentUserId: string
  currentUserRole: string
}

type Visibility = 'OPEN_TO_ALL' | 'COHORT' | 'INVITE_ONLY' | 'PRIVATE'
type SessionType = 'LECTURE' | 'GRAND_ROUNDS' | 'CASE_CONFERENCE' | 'JOURNAL_CLUB' | 'SKILLS_WORKSHOP' | 'ASSESSMENT'
type EndMode = 'count' | 'date' | 'never'

const SESSION_TYPES: Array<{
  value: SessionType; label: string; desc: string
  icon: typeof GraduationCap; gradient: string; iconColor: string
  selectedBorder: string; selectedBg: string; glow: string
}> = [
  { value: 'LECTURE',          label: 'Lecture',         desc: 'Structured didactic teaching',    icon: GraduationCap,  gradient: 'from-blue-500/30 to-blue-500/5',    iconColor: 'text-blue-600 dark:text-blue-400',    selectedBorder: 'border-blue-500',    selectedBg: 'bg-blue-500/8',    glow: 'shadow-blue-500/25' },
  { value: 'GRAND_ROUNDS',     label: 'Grand Rounds',    desc: 'Clinical case presentation',      icon: Activity,       gradient: 'from-violet-500/30 to-violet-500/5', iconColor: 'text-violet-600 dark:text-violet-400', selectedBorder: 'border-violet-500',  selectedBg: 'bg-violet-500/8',  glow: 'shadow-violet-500/25' },
  { value: 'CASE_CONFERENCE',  label: 'Case Conference', desc: 'Multi-team case review',          icon: FolderOpen,     gradient: 'from-orange-500/30 to-orange-500/5', iconColor: 'text-orange-600 dark:text-orange-400', selectedBorder: 'border-orange-500',  selectedBg: 'bg-orange-500/8',  glow: 'shadow-orange-500/25' },
  { value: 'JOURNAL_CLUB',     label: 'Journal Club',    desc: 'Literature review & critique',    icon: BookMarked,     gradient: 'from-amber-500/30 to-amber-500/5',   iconColor: 'text-amber-600 dark:text-amber-400',   selectedBorder: 'border-amber-500',   selectedBg: 'bg-amber-500/8',   glow: 'shadow-amber-500/25' },
  { value: 'SKILLS_WORKSHOP',  label: 'Skills Workshop', desc: 'Hands-on procedural practice',   icon: Wrench,         gradient: 'from-emerald-500/30 to-emerald-500/5',iconColor: 'text-emerald-600 dark:text-emerald-400',selectedBorder: 'border-emerald-500', selectedBg: 'bg-emerald-500/8', glow: 'shadow-emerald-500/25' },
  { value: 'ASSESSMENT',       label: 'Assessment',      desc: 'Evaluation & competency check',  icon: ClipboardCheck, gradient: 'from-rose-500/30 to-rose-500/5',     iconColor: 'text-rose-600 dark:text-rose-400',     selectedBorder: 'border-rose-500',    selectedBg: 'bg-rose-500/8',    glow: 'shadow-rose-500/25' },
]

const VISIBILITY_OPTIONS: Array<{
  value: Visibility; label: string; description: string
  icon: typeof Globe; accent: string; bg: string; border: string; glow: string
}> = [
  { value: 'OPEN_TO_ALL', label: 'Anyone with link', description: 'Share the URL — anyone can join',   icon: Globe,      accent: 'text-sky-600',     bg: 'bg-sky-500/10',     border: 'border-sky-500',     glow: 'shadow-sky-500/20' },
  { value: 'COHORT',      label: 'Cohort',           description: 'Batch or specialty group members',  icon: UsersRound, accent: 'text-violet-600',  bg: 'bg-violet-500/10',  border: 'border-violet-500',  glow: 'shadow-violet-500/20' },
  { value: 'INVITE_ONLY', label: 'Invite only',      description: 'Specific people you select now',    icon: UserCheck,  accent: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500', glow: 'shadow-emerald-500/20' },
  { value: 'PRIVATE',     label: 'Private',          description: 'Only you and the faculty host',     icon: Lock,       accent: 'text-slate-600',   bg: 'bg-slate-500/10',   border: 'border-slate-400',   glow: 'shadow-slate-500/20' },
]

const STEP_THEMES = [
  { gradient: 'from-blue-500/20 via-blue-400/8 to-transparent',     blob: 'bg-blue-400/20',    icon: Sparkles,    iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-500/30' },
  { gradient: 'from-violet-500/20 via-violet-400/8 to-transparent',  blob: 'bg-violet-400/20',  icon: CalendarDays, iconBg: 'bg-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/30' },
  { gradient: 'from-amber-500/20 via-amber-400/8 to-transparent',    blob: 'bg-amber-400/20',   icon: UsersRound,  iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-500/30' },
  { gradient: 'from-emerald-500/20 via-emerald-400/8 to-transparent',blob: 'bg-emerald-400/20', icon: Zap,         iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400',ring: 'ring-emerald-500/30' },
]

const STEPS = [
  { id: 'what',     label: 'Session',  subtitle: "What it's about", heading: "What's this session?",  sub: 'Name it and pick the format.' },
  { id: 'schedule', label: 'Schedule', subtitle: 'Host & timing',   heading: 'Host & timing',         sub: "Who's hosting and when does it happen?" },
  { id: 'audience', label: 'Audience', subtitle: 'Who can join',    heading: 'Who can join?',         sub: 'Set visibility and link to a topic.' },
  { id: 'details',  label: 'Finish',   subtitle: 'Review & submit', heading: 'Almost there!',         sub: 'Add optional details and review before scheduling.' },
]

const WEEKDAYS = [
  { label: 'Mo', rrule: RRule.MO }, { label: 'Tu', rrule: RRule.TU },
  { label: 'We', rrule: RRule.WE }, { label: 'Th', rrule: RRule.TH },
  { label: 'Fr', rrule: RRule.FR }, { label: 'Sa', rrule: RRule.SA },
  { label: 'Su', rrule: RRule.SU },
]

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 }, { label: '1 hour', minutes: 60 },
  { label: '1.5 h', minutes: 90 },  { label: '2 hours', minutes: 120 },
]

function toLocalInput(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function addMinutesToLocal(local: string, minutes: number) {
  const [datePart, timePart] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const next = new Date(y, mo - 1, d, h, mi + minutes)
  return new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function diffMinutes(start: string, end: string) {
  if (!start || !end) return null
  return Math.round((new Date(end.replace('T', ' ')).getTime() - new Date(start.replace('T', ' ')).getTime()) / 60000)
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}
function humanRole(r: string) {
  return r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
function fmtLocal(local: string) {
  if (!local) return '—'
  return new Date(local.replace('T', ' ')).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const slide = {
  enter: (d: number) => ({ x: d * 56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d * -56, opacity: 0 }),
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NewSessionForm({
  faculty, cohorts, topics, defaultStart, defaultEnd, currentUserId, currentUserRole,
}: Props) {
  const router = useRouter()

  // Core
  const [title, setTitle]           = useState('')
  const [description, setDesc]      = useState('')
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>([])
  const [sessionType, setSessionType] = useState<SessionType>('LECTURE')
  const [topicId, setTopicId]       = useState('')
  const [hostId, setHostId]         = useState(
    // FACULTY and RESIDENT default to self-host (auto-approves). Admin/PD
    // default to the first faculty entry — usually themselves if PD, else the
    // first available faculty member.
    currentUserRole === 'FACULTY' || currentUserRole === 'RESIDENT'
      ? currentUserId
      : (faculty[0]?.id ?? '')
  )
  const [start, setStart]           = useState(toLocalInput(defaultStart) || '')
  const [end, setEnd]               = useState(toLocalInput(defaultEnd) || '')
  const [visibility, setVis]        = useState<Visibility>('OPEN_TO_ALL')
  const [cohortId, setCohortId]     = useState('')
  const [invitees, setInvitees]     = useState<PickableUser[]>([])

  // Recurrence
  const [repeats, setRepeats]       = useState(false)
  const [freq, setFreq]             = useState<'WEEKLY' | 'DAILY' | 'MONTHLY'>('WEEKLY')
  const [repeatEvery, setRepeatEvery] = useState(1)
  const [byDays, setByDays]         = useState<Set<string>>(new Set(['MO']))
  const [endMode, setEndMode]       = useState<EndMode>('count')
  const [count, setCount]           = useState(8)
  const [endDate, setEndDate]       = useState('')
  const [excludedDates, setExcludedDates] = useState<string[]>([])

  // Options
  const [genLink, setGenLink]       = useState(false)
  const [linkTtl, setLinkTtl]       = useState(48)
  const [createdLink, setCreatedLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied]         = useState(false)

  // Prerequisites
  const [prereqMode, setPrereqMode] = useState<PrereqConfig['mode']>('NONE')
  const [reqQ, setReqQ]             = useState(false)
  const [minQ, setMinQ]             = useState(1)
  const [reqPack, setReqPack]       = useState(false)
  const [reqAck, setReqAck]         = useState(false)

  // Wizard
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [step, setStep]             = useState(0)
  const [dir, setDir]               = useState(1)
  const [stepErr, setStepErr]       = useState<string | null>(null)

  const hostIsSelf   = hostId === currentUserId
  const selectedHost = faculty.find((f) => f.id === hostId)
  const isCohort     = visibility === 'COHORT'
  const isInvite     = visibility === 'INVITE_ONLY'

  function validateStep(s: number): string | null {
    if (s === 0 && !title.trim()) return 'Give this session a title before continuing.'
    if (s === 1) {
      if (!start) return 'Pick a start date and time.'
      if (!end)   return 'Pick an end date and time.'
      const d = diffMinutes(start, end)
      if (d !== null && d <= 0) return 'End time must be after start.'
    }
    if (s === 2) {
      if (isCohort && !cohortId)          return 'Select a cohort.'
      if (isInvite && invitees.length === 0) return 'Add at least one invitee.'
    }
    return null
  }

  function goNext() {
    const err = validateStep(step)
    if (err) { setStepErr(err); return }
    setStepErr(null); setDir(1); setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function goBack() {
    setStepErr(null); setDir(-1); setStep((s) => Math.max(s - 1, 0))
  }

  function buildRRule() {
    if (!repeats) return undefined
    const freqMap = { WEEKLY: Frequency.WEEKLY, DAILY: Frequency.DAILY, MONTHLY: Frequency.MONTHLY }
    const byweekday = freq === 'WEEKLY'
      ? WEEKDAYS.filter((w) => byDays.has(w.label.toUpperCase().slice(0, 2))).map((w) => w.rrule)
      : undefined
    const opts: ConstructorParameters<typeof RRule>[0] = {
      freq: freqMap[freq],
      ...(byweekday ? { byweekday } : {}),
      ...(repeatEvery > 1 ? { interval: repeatEvery } : {}),
      dtstart: new Date(start),
    }
    if (endMode === 'count') opts.count = count
    else if (endMode === 'date' && endDate) opts.until = new Date(endDate + 'T23:59:59Z')
    const rule = new RRule(opts)
    return rule.toString().split('\n').find((l) => l.startsWith('RRULE:'))?.replace('RRULE:', '')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep(step)
    if (err) { setStepErr(err); return }
    setError(null); setSubmitting(true)
    try {
      const payload = {
        title, description: description || undefined, sessionType,
        topicId: topicId || undefined, hostId,
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd:   new Date(end).toISOString(),
        visibility,
        cohortId:   isCohort  ? cohortId              : undefined,
        inviteeIds: isInvite  ? invitees.map((u) => u.id) : undefined,
        recurrenceRule: buildRRule(),
        maxParticipants: 100, recordingEnabled: true, consentRequired: true, tags: [],
        objectives: objectives.length > 0 ? objectives.filter((o) => o.text.trim().length >= 3) : undefined,
        prereq: prereqMode === 'NONE' ? undefined : {
          mode: prereqMode, requirePreQuestions: reqQ, minPreQuestions: minQ,
          requireStudyPack: reqPack, requireReadinessAck: reqAck,
        },
        // Excluded recurrence dates — backend stores in metadata
        ...(excludedDates.length > 0 ? { excludedDates } : {}),
      }
      const res  = await fetch('/api/classroom/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) {
        throw new Error(json.error?.message ?? 'Failed to create session')
      }
      // Teams-style conflict warning: API returns warnings.hostConflicts when
      // the host has overlapping APPROVED sessions. Non-blocking — we still
      // navigate, but flash a confirmation so the user can react.
      const conflicts = (json.data?.warnings?.hostConflicts ?? []) as Array<{
        title: string; scheduledStart: string
      }>
      if (conflicts.length > 0) {
        const c = conflicts[0]
        const summary = `Heads up: host already has "${c.title}" at ${new Date(c.scheduledStart).toLocaleString()}. Scheduled anyway.`
        if (typeof window !== 'undefined') window.alert(summary)
      }
      const newId = (json.data?.session ?? json.data)?.id
      if (genLink && newId) {
        const lr  = await fetch(`/api/classroom/sessions/${newId}/share-link`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttlHours: linkTtl }),
        })
        const lb = await lr.json()
        if (lb.ok) { setCreatedLink({ url: lb.data.url, expiresAt: lb.data.expiresAt }); setSubmitting(false); return }
        setError(`Session created, but share link failed: ${lb.error?.message ?? 'unknown'}`)
      }
      router.push('/calendar')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink() {
    if (!createdLink) return
    await navigator.clipboard.writeText(createdLink.url)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  if (createdLink) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-linear-to-br from-emerald-50 to-white dark:border-emerald-700 dark:from-emerald-950/50 dark:to-transparent"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-500/40"
            >
              <Check className="size-7 text-white" />
            </motion.div>
            <div>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">Session scheduled!</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Share link expires {new Date(createdLink.expiresAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 overflow-hidden rounded-xl border border-emerald-300 bg-white px-3 py-2.5 font-mono text-xs dark:bg-emerald-950/60 dark:text-emerald-100">
              <div className="truncate">{createdLink.url}</div>
            </div>
            <button type="button" onClick={copyLink}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/30"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <Button type="button" variant="outline" onClick={() => router.push('/calendar')}>Done</Button>
          </div>
        </div>
      </motion.div>
    )
  }

  const theme = STEP_THEMES[step]

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <StepBar steps={STEPS} current={step} onJump={(i) => {
        if (i < step) { setDir(-1); setStep(i); setStepErr(null) }
      }} />

      {/* Main card — no overflow-hidden so FacultySearch dropdown can escape */}
      <div className="relative rounded-2xl border border-border bg-card shadow-md" style={{ minHeight: 440 }}>
        {/* Blobs confined inside inner overflow-hidden */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`blob-${step}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className={cn('absolute -right-10 -top-10 size-48 rounded-full blur-3xl opacity-60', theme.blob)} />
              <div className={cn('absolute -bottom-16 -left-10 size-36 rounded-full blur-3xl opacity-40', theme.blob)} />
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative"
          >
            {/* Step gradient header */}
            <div className={cn('relative overflow-hidden bg-linear-to-br px-6 pt-6 pb-5', theme.gradient)}>
              <div className="flex items-center gap-3.5">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm', theme.iconBg, `ring-2 ${theme.ring}`)}>
                  <theme.icon className={cn('size-5', theme.iconColor)} />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight tracking-tight">{STEPS[step].heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEPS[step].sub}</p>
                </div>
                <div className="ml-auto text-3xl font-black text-foreground/5 select-none tabular-nums">{step + 1}</div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-5">
              {step === 0 && (
                <StepWhat title={title} setTitle={setTitle} sessionType={sessionType} setSessionType={setSessionType} />
              )}
              {step === 1 && (
                <StepSchedule
                  faculty={faculty} hostId={hostId} setHostId={setHostId}
                  currentUserId={currentUserId} currentUserRole={currentUserRole}
                  start={start} setStart={setStart} end={end} setEnd={setEnd}
                  repeats={repeats} setRepeats={setRepeats}
                  freq={freq} setFreq={setFreq}
                  repeatEvery={repeatEvery} setRepeatEvery={setRepeatEvery}
                  byDays={byDays} setByDays={setByDays}
                  endMode={endMode} setEndMode={setEndMode}
                  count={count} setCount={setCount}
                  endDate={endDate} setEndDate={setEndDate}
                  excludedDates={excludedDates} setExcludedDates={setExcludedDates}
                />
              )}
              {step === 2 && (
                <StepAudience
                  topics={topics} cohorts={cohorts}
                  topicId={topicId} setTopicId={setTopicId}
                  visibility={visibility} setVisibility={setVis}
                  cohortId={cohortId} setCohortId={setCohortId}
                  invitees={invitees} setInvitees={setInvitees}
                />
              )}
              {step === 3 && (
                <StepDetails
                  title={title} sessionType={sessionType} selectedHost={selectedHost}
                  start={start} end={end} visibility={visibility}
                  repeats={repeats} count={count} freq={freq} repeatEvery={repeatEvery} endMode={endMode}
                  description={description} setDesc={setDesc}
                  objectives={objectives} setObjectives={setObjectives}
                  prereqMode={prereqMode} setPrereqMode={setPrereqMode}
                  reqQ={reqQ} setReqQ={setReqQ} minQ={minQ} setMinQ={setMinQ}
                  reqPack={reqPack} setReqPack={setReqPack}
                  reqAck={reqAck} setReqAck={setReqAck}
                  genLink={genLink} setGenLink={setGenLink}
                  linkTtl={linkTtl} setLinkTtl={setLinkTtl}
                  submitting={submitting}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(stepErr || error) && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {stepErr || error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4">
        <Button type="button" variant="ghost"
          onClick={step === 0 ? () => router.back() : goBack}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <div className="flex items-center gap-3">
          {hostIsSelf && step === STEPS.length - 1 && (
            <p className="hidden text-xs text-muted-foreground sm:block">You&apos;re hosting — schedules immediately</p>
          )}
          {step < STEPS.length - 1 ? (
            <motion.button type="button" onClick={goNext} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative flex items-center gap-1.5 overflow-hidden rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/30 transition-shadow hover:shadow-primary/50"
            >
              <span className="relative z-10 flex items-center gap-1.5">Continue <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
              <span className="absolute inset-0 bg-linear-to-r from-transparent to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.button>
          ) : (
            <motion.button type="submit" disabled={submitting} whileHover={{ scale: submitting ? 1 : 1.02 }} whileTap={{ scale: submitting ? 1 : 0.98 }}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-7 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/35 transition-shadow hover:shadow-primary/55 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                {submitting
                  ? <><Loader2 className="size-4 animate-spin" /> Scheduling…</>
                  : <>{hostIsSelf ? 'Schedule session' : 'Send for approval'} <Zap className="size-4 transition-transform group-hover:scale-110" /></>
                }
              </span>
              <span className="absolute inset-0 bg-linear-to-r from-transparent to-white/15 opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.button>
          )}
        </div>
      </div>
    </form>
  )
}

// ─── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ steps, current, onJump }: { steps: typeof STEPS; current: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center px-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center">
          <motion.button type="button" onClick={() => onJump(i)} whileHover={i < current ? { scale: 1.04 } : {}}
            className={cn('flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition', i < current ? 'cursor-pointer' : 'cursor-default')}
          >
            <div className={cn(
              'relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
              i < current  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/40' :
              i === current ? 'bg-primary text-primary-foreground ring-4 ring-primary/25' :
              'bg-muted text-muted-foreground',
            )}>
              {i < current ? <Check className="size-3.5" /> : i + 1}
            </div>
            <div className="hidden sm:block">
              <p className={cn('text-xs font-bold leading-none', i <= current ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{s.subtitle}</p>
            </div>
          </motion.button>
          {i < steps.length - 1 && (
            <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border">
              <motion.div className="absolute inset-y-0 left-0 bg-primary"
                animate={{ width: i < current ? '100%' : '0%' }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Session ─────────────────────────────────────────────────────────
function StepWhat({ title, setTitle, sessionType, setSessionType }: {
  title: string; setTitle: (v: string) => void
  sessionType: SessionType; setSessionType: (v: SessionType) => void
}) {
  return (
    <div className="space-y-5">
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        required maxLength={200}
        placeholder="e.g. Grand Rounds — Macular Holes"
        className="w-full rounded-2xl border-2 border-input bg-background px-4 py-3.5 text-[17px] font-semibold placeholder:font-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all"
      />
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Format</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SESSION_TYPES.map((t) => {
            const Icon = t.icon
            const active = sessionType === t.value
            return (
              <motion.button key={t.value} type="button" onClick={() => setSessionType(t.value)}
                whileHover={{ scale: 1.03, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200',
                  active ? `${t.selectedBorder} ${t.selectedBg} shadow-lg ${t.glow}` : 'border-input hover:border-primary/20 hover:bg-accent/30',
                )}
              >
                <div className={cn('flex size-11 items-center justify-center rounded-xl bg-linear-to-br', t.gradient)}>
                  <Icon className={cn('size-6', t.iconColor)} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{t.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                </div>
                <AnimatePresence>
                  {active && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/40"
                    >
                      <Check className="size-3 text-primary-foreground" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Schedule ─────────────────────────────────────────────────────────
function StepSchedule({
  faculty, hostId, setHostId, currentUserId, currentUserRole,
  start, setStart, end, setEnd,
  repeats, setRepeats, freq, setFreq,
  repeatEvery, setRepeatEvery,
  byDays, setByDays,
  endMode, setEndMode,
  count, setCount,
  endDate, setEndDate,
  excludedDates, setExcludedDates,
}: {
  faculty: Faculty[]; hostId: string; setHostId: (v: string) => void
  currentUserId: string; currentUserRole: string
  start: string; setStart: (v: string) => void; end: string; setEnd: (v: string) => void
  repeats: boolean; setRepeats: (v: boolean) => void
  freq: 'WEEKLY' | 'DAILY' | 'MONTHLY'; setFreq: (v: 'WEEKLY' | 'DAILY' | 'MONTHLY') => void
  repeatEvery: number; setRepeatEvery: (v: number) => void
  byDays: Set<string>; setByDays: (v: Set<string>) => void
  endMode: EndMode; setEndMode: (v: EndMode) => void
  count: number; setCount: (v: number) => void
  endDate: string; setEndDate: (v: string) => void
  excludedDates: string[]; setExcludedDates: (v: string[]) => void
}) {
  const selectedHost = faculty.find((f) => f.id === hostId)
  const hostIsSelf   = hostId === currentUserId
  const isFaculty    = currentUserRole === 'FACULTY'
  const isResident   = currentUserRole === 'RESIDENT'

  function onStartChange(v: string) {
    const dur = diffMinutes(start, end)
    setStart(v)
    setEnd(addMinutesToLocal(v, (dur && dur > 0) ? dur : 60))
  }

  function addExcluded(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value
    if (d && !excludedDates.includes(d)) setExcludedDates([...excludedDates, d].sort())
    e.target.value = ''
  }

  const freqLabel = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[freq]
  const recurrenceSummary = repeats
    ? `Every ${repeatEvery > 1 ? `${repeatEvery} ${freqLabel}s` : freqLabel}${endMode === 'count' ? ` · ${count}×` : endMode === 'date' && endDate ? ` · until ${fmtDate(endDate)}` : ' · no end'}`
    : null

  return (
    <div className="space-y-5">
      {/* Host */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {isResident ? 'Host' : 'Faculty host'}
        </p>
        {isFaculty ? (
          // Faculty users are always the host — no picker
          <div className="flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {selectedHost ? initials(selectedHost.name) : '?'}
            </div>
            <div>
              <p className="text-sm font-bold">{selectedHost?.name ?? 'You'}</p>
              <p className="text-xs text-primary font-medium">✓ You&apos;re hosting — schedules immediately</p>
            </div>
          </div>
        ) : (
          // Admin / PD / Resident — searchable dropdown. For residents, the
          // page injects them at the top of `faculty` so they can self-host
          // (peer-led, auto-approve) or pick a faculty member (PENDING_FACULTY).
          <>
            <FacultySearch faculty={faculty} value={hostId} onChange={setHostId} currentUserId={currentUserId} />
            <AnimatePresence mode="wait">
              {selectedHost && (
                <motion.p key={hostId}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={cn('text-xs', hostIsSelf ? 'font-medium text-primary' : 'text-muted-foreground')}
                >
                  {hostIsSelf
                    ? isResident
                      ? '✓ You\'re hosting a peer-led session — schedules immediately, no faculty approval needed.'
                      : '✓ You\'re hosting — schedules immediately, no approval needed.'
                    : `${selectedHost.name} will receive an approval request before publishing.`}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Date / time */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Date &amp; time</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <DateTimePicker label="Start" required value={start} onChange={onStartChange} compact />
          <DateTimePicker label="End" required value={end} onChange={setEnd} min={start || undefined} compact />
        </div>
        {start && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Duration:</span>
            {DURATION_PRESETS.map((p) => {
              const active = diffMinutes(start, end) === p.minutes
              return (
                <motion.button key={p.minutes} type="button" whileTap={{ scale: 0.95 }}
                  onClick={() => setEnd(addMinutesToLocal(start, p.minutes))}
                  className={cn('rounded-full border-2 px-2.5 py-0.5 text-xs font-bold transition-all',
                    active ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'border-input text-muted-foreground hover:border-primary/40',
                  )}
                >{p.label}</motion.button>
              )
            })}
            {(() => {
              const d = diffMinutes(start, end)
              if (!d || d <= 0 || DURATION_PRESETS.some((p) => p.minutes === d)) return null
              const h = Math.floor(d / 60), m = d % 60
              return <span className="rounded-full border border-dashed border-input px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Custom · {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''}</span>
            })()}
          </div>
        )}
      </div>

      {/* ── Recurrence — Teams-style ── */}
      <div className={cn('rounded-2xl border-2 transition-colors duration-200', repeats ? 'border-primary/30 bg-primary/5' : 'border-input')}>
        {/* Toggle row */}
        <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-semibold">
          <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} className="size-4 accent-primary rounded" />
          <Repeat className={cn('size-4 transition-colors', repeats ? 'text-primary' : 'text-muted-foreground')} />
          Repeat
          <AnimatePresence>
            {repeats && recurrenceSummary && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="ml-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary"
              >{recurrenceSummary}</motion.span>
            )}
          </AnimatePresence>
        </label>

        <AnimatePresence>
          {repeats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t border-border px-4 py-4">

                {/* Every N frequency */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">Every</span>
                  <input
                    type="number" min={1} max={52} value={repeatEvery}
                    onChange={(e) => setRepeatEvery(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded-xl border-2 border-input bg-card px-2.5 py-1.5 text-center text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <Select value={freq} onValueChange={(v) => setFreq((v ?? 'WEEKLY') as 'WEEKLY' | 'DAILY' | 'MONTHLY')}>
                    <SelectTrigger className="w-28 rounded-xl border-2 py-1.5 h-auto">
                      <SelectValue>{(v) => ({ DAILY: 'Day', WEEKLY: 'Week', MONTHLY: 'Month' } as Record<string, string>)[v as string] ?? 'Week'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Day</SelectItem>
                      <SelectItem value="WEEKLY">Week</SelectItem>
                      <SelectItem value="MONTHLY">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Day-of-week toggles */}
                {freq === 'WEEKLY' && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">On</p>
                    <div className="flex gap-1.5">
                      {WEEKDAYS.map((w) => {
                        const key = w.label.toUpperCase().slice(0, 2)
                        const active = byDays.has(key)
                        return (
                          <motion.button key={key} type="button" whileTap={{ scale: 0.88 }}
                            onClick={() => { const n = new Set(byDays); if (active) n.delete(key); else n.add(key); setByDays(n) }}
                            className={cn(
                              'size-9 rounded-xl border-2 text-xs font-bold transition-all',
                              active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-input text-muted-foreground hover:border-primary/40',
                            )}
                          >{w.label}</motion.button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* End condition */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Ends</p>
                  <div className="space-y-2 rounded-xl border-2 border-input bg-card p-3">
                    {/* After N occurrences */}
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input type="radio" name="endMode" checked={endMode === 'count'} onChange={() => setEndMode('count')} className="size-4 accent-primary" />
                      <span className="text-sm font-medium w-12">After</span>
                      <input type="number" min={1} max={365} value={count}
                        disabled={endMode !== 'count'}
                        onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 rounded-lg border-2 border-input bg-background px-2 py-1 text-center text-sm font-bold outline-none focus:border-primary disabled:opacity-40 transition"
                      />
                      <span className="text-sm text-muted-foreground">occurrence{count !== 1 ? 's' : ''}</span>
                    </label>
                    {/* By date */}
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input type="radio" name="endMode" checked={endMode === 'date'} onChange={() => setEndMode('date')} className="size-4 accent-primary" />
                      <span className="text-sm font-medium w-12">By</span>
                      <input type="date" value={endDate} disabled={endMode !== 'date'}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-lg border-2 border-input bg-background px-2 py-1 text-sm font-medium outline-none focus:border-primary disabled:opacity-40 transition"
                      />
                    </label>
                    {/* Never */}
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input type="radio" name="endMode" checked={endMode === 'never'} onChange={() => setEndMode('never')} className="size-4 accent-primary" />
                      <span className="text-sm font-medium">Never ends</span>
                    </label>
                  </div>
                </div>

                {/* Exclude specific dates */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Exceptions <span className="font-normal opacity-60">(skip specific dates)</span></p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {excludedDates.map((d) => (
                      <motion.span
                        key={d}
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-destructive"
                      >
                        {fmtDate(d)}
                        <button type="button" onClick={() => setExcludedDates(excludedDates.filter((x) => x !== d))}
                          className="flex size-3.5 items-center justify-center rounded-full hover:bg-destructive/20 transition"
                        >
                          <X className="size-2.5" />
                        </button>
                      </motion.span>
                    ))}
                    <label className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-input px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition">
                      <Plus className="size-3" /> Add exception
                      <input type="date" className="sr-only" onChange={addExcluded} />
                    </label>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Step 3: Audience ─────────────────────────────────────────────────────────
function StepAudience({
  topics, cohorts, topicId, setTopicId,
  visibility, setVisibility, cohortId, setCohortId, invitees, setInvitees,
}: {
  topics: Topic[]; cohorts: Cohort[]
  topicId: string; setTopicId: (v: string) => void
  visibility: Visibility; setVisibility: (v: Visibility) => void
  cohortId: string; setCohortId: (v: string) => void
  invitees: PickableUser[]; setInvitees: (v: PickableUser[]) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Visibility</p>
        <div className="grid grid-cols-2 gap-2.5">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon; const sel = visibility === opt.value
            return (
              <motion.label key={opt.value} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all duration-200',
                  sel ? `${opt.border} bg-card shadow-lg ${opt.glow}` : 'border-input hover:border-primary/20 hover:bg-accent/30',
                )}
              >
                <input type="radio" name="visibility" value={opt.value} checked={sel} onChange={() => setVisibility(opt.value)} className="sr-only" />
                <div className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors', sel ? opt.bg : 'bg-muted')}>
                  <Icon className={cn('size-4', sel ? opt.accent : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold">{opt.label}</span>
                    {sel && <Check className={cn('size-3.5 shrink-0', opt.accent)} />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </motion.label>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {visibility === 'COHORT' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-2 rounded-2xl border-2 border-violet-200 bg-violet-500/5 p-4 dark:border-violet-800">
              <p className="text-sm font-bold">Select cohort <span className="text-destructive">*</span></p>
              <Select value={cohortId} onValueChange={(v) => setCohortId(v ?? '')}>
                <SelectTrigger className="w-full rounded-xl border-2 bg-card py-2.5">
                  <SelectValue placeholder="Pick a cohort">
                    {(v) => {
                      const c = cohorts.find((x) => x.id === v)
                      if (!c) return 'Pick a cohort'
                      return <span className="flex items-center gap-2"><UsersRound className="size-4 text-violet-600" /><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground">· {c.memberCount} members</span></span>
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cohorts.length === 0
                    ? <div className="px-3 py-2 text-xs text-muted-foreground">No cohorts — create one in Admin → Cohorts</div>
                    : cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><UsersRound className="size-3.5 text-violet-600" /><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground">({c.memberCount})</span></span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Live membership — people added later will also see this session.</p>
            </div>
          </motion.div>
        )}
        {visibility === 'INVITE_ONLY' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-3 rounded-2xl border-2 border-emerald-200 bg-emerald-500/5 p-4 dark:border-emerald-800">
              <div>
                <p className="text-sm font-bold">Invite people <span className="text-destructive">*</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">Quick-add a cohort or pick individuals. Snapshot at creation.</p>
              </div>
              <CohortQuickAdd selected={invitees} onChange={setInvitees} />
              <UserPicker selected={invitees} onChange={setInvitees} placeholder="Search by name or email…" />
              {invitees.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600"><AlertCircle className="size-3.5" /> At least one invitee required.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Topic <span className="normal-case font-normal tracking-normal opacity-60">(optional)</span></p>
        <Select value={topicId || 'none'} onValueChange={(v) => setTopicId(v === 'none' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-full rounded-xl border-2 py-2.5">
            <SelectValue placeholder="No topic">
              {(v) => {
                if (!v || v === 'none') return <span className="text-muted-foreground">No topic</span>
                const t = topics.find((x) => x.id === v)
                if (!t) return <span className="text-muted-foreground">No topic</span>
                return <span className="flex items-center gap-2"><span className="font-medium">{t.name}</span>{t.subspecialty && <span className="text-xs text-muted-foreground">· {t.subspecialty}</span>}</span>
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none"><span className="text-muted-foreground">No topic</span></SelectItem>
            {topics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2"><span className="font-medium">{t.name}</span>{t.subspecialty && <span className="text-xs text-muted-foreground">· {t.subspecialty}</span>}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Links to the topic library — residents find this session alongside related cases and atlas images.</p>
      </div>
    </div>
  )
}

// ─── Step 4: Details + Review ─────────────────────────────────────────────────
function StepDetails({
  title, sessionType, selectedHost, start, end, visibility,
  repeats, count, freq, repeatEvery, endMode,
  description, setDesc,
  objectives, setObjectives,
  prereqMode, setPrereqMode,
  reqQ, setReqQ, minQ, setMinQ, reqPack, setReqPack, reqAck, setReqAck,
  genLink, setGenLink, linkTtl, setLinkTtl, submitting,
}: {
  title: string; sessionType: SessionType; selectedHost?: Faculty
  start: string; end: string; visibility: Visibility
  repeats: boolean; count: number; freq: string; repeatEvery: number; endMode: EndMode
  description: string; setDesc: (v: string) => void
  objectives: ObjectiveDraft[]; setObjectives: (v: ObjectiveDraft[]) => void
  prereqMode: PrereqConfig['mode']; setPrereqMode: (v: PrereqConfig['mode']) => void
  reqQ: boolean; setReqQ: (v: boolean) => void; minQ: number; setMinQ: (v: number) => void
  reqPack: boolean; setReqPack: (v: boolean) => void
  reqAck: boolean; setReqAck: (v: boolean) => void
  genLink: boolean; setGenLink: (v: boolean) => void
  linkTtl: number; setLinkTtl: (v: number) => void
  submitting: boolean
}) {
  const typeConfig = SESSION_TYPES.find((t) => t.value === sessionType)!
  const TypeIcon   = typeConfig.icon
  const visOpt     = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!
  const dur        = diffMinutes(start, end)
  const durLabel   = dur && dur > 0 ? `${Math.floor(dur / 60) > 0 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim() : null
  const freqLabel  = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[freq] ?? freq.toLowerCase()

  return (
    <div className="space-y-5">
      {/* Review card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-linear-to-br from-primary/8 via-primary/4 to-transparent"
      >
        <div className="p-4">
          <div className="flex items-start gap-3.5">
            <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br shadow-md', typeConfig.gradient, typeConfig.glow)}>
              <TypeIcon className={cn('size-6', typeConfig.iconColor)} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-base font-bold truncate">{title || <span className="text-muted-foreground">Untitled session</span>}</p>
              <p className={cn('text-xs font-semibold mt-0.5', typeConfig.iconColor)}>{typeConfig.label}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5 shrink-0 text-primary/60" /><span>{start ? fmtLocal(start) : '—'}</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-3.5 shrink-0 text-primary/60" /><span>{durLabel ?? '—'}{repeats ? ` · every ${repeatEvery > 1 ? `${repeatEvery} ${freqLabel}s` : freqLabel}${endMode === 'count' ? ` ×${count}` : ''}` : ''}</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{selectedHost ? initials(selectedHost.name) : '?'}</div>
              <span className="truncate">{selectedHost?.name ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><visOpt.icon className={cn('size-3.5 shrink-0', visOpt.accent)} /><span>{visOpt.label}</span></div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description</p>
        <Textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={2000}
          placeholder="Optional — prep notes, agenda, anything residents should know…"
          className="rounded-xl border-2 px-3.5 py-2.5" />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Learning objectives</p>
        <ObjectivesEditor value={objectives} onChange={setObjectives} disabled={submitting} />
      </div>

      {/* Prerequisites */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resident gate</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 'NONE', label: 'No gate', desc: 'Open room' },
            { v: 'OPTIONAL', label: 'Show only', desc: 'No block' },
            { v: 'MANDATORY', label: 'Required', desc: 'Block until done' },
          ] as Array<{ v: PrereqConfig['mode']; label: string; desc: string }>).map((m) => {
            const sel = prereqMode === m.v
            return (
              <label key={m.v} className={cn('flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-all', sel ? 'border-primary bg-primary/5 shadow-sm' : 'border-input hover:border-primary/30')}>
                <input type="radio" name="prereqMode" value={m.v} checked={sel} onChange={() => setPrereqMode(m.v)} className="sr-only" />
                <div className="flex items-center justify-between"><span className="text-sm font-bold">{m.label}</span>{sel && <Check className="size-3.5 text-primary" />}</div>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </label>
            )
          })}
        </div>
        <AnimatePresence>
          {prereqMode !== 'NONE' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
                {[
                  { checked: reqQ,   set: setReqQ,   icon: MessageCircleQuestion, label: 'Pre-questions submitted', desc: 'Must submit at least N questions before joining.',
                    extra: reqQ && <div className="mt-2 flex items-center gap-2"><span className="text-xs text-muted-foreground">Min:</span><Input type="number" min={1} max={20} value={minQ} onChange={(e) => setMinQ(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-lg border-2 px-2 py-1 text-sm" /></div> },
                  { checked: reqPack, set: setReqPack, icon: BookOpen,            label: 'Study pack opened',      desc: 'All prep docs opened at least once.' },
                  { checked: reqAck,  set: setReqAck,  icon: Target,             label: 'Readiness self-marked',  desc: 'Each objective must have a self-mark.' },
                ].map(({ checked, set, icon: Icon, label, desc, extra }) => (
                  <label key={label} className="flex cursor-pointer items-start gap-2.5 rounded-lg border-2 border-input bg-card p-3 hover:border-primary/30 transition-colors">
                    <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                    <Icon className="mt-0.5 size-4 text-primary shrink-0" />
                    <div className="flex-1"><span className="text-sm font-semibold">{label}</span><p className="text-xs text-muted-foreground">{desc}</p>{extra}</div>
                  </label>
                ))}
                {prereqMode === 'MANDATORY' && !reqQ && !reqPack && !reqAck && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600"><AlertCircle className="size-3.5" /> Pick at least one check or &ldquo;Required&rdquo; acts like &ldquo;No gate&rdquo;.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Share link */}
      <div className={cn('rounded-xl border-2 p-3.5 transition-colors duration-200', genLink ? 'border-primary/30 bg-primary/5' : 'border-input')}>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={genLink} onChange={(e) => setGenLink(e.target.checked)} className="size-4 accent-primary" />
          <Link2 className={cn('size-4 transition-colors', genLink ? 'text-primary' : 'text-muted-foreground')} />
          Generate a share link
          <span className="text-xs font-normal text-muted-foreground">(bypasses visibility)</span>
        </label>
        <AnimatePresence>
          {genLink && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Expires in</span>
                <Select value={String(linkTtl)} onValueChange={(v) => setLinkTtl(parseInt(v ?? '48'))}>
                  <SelectTrigger className="w-44 rounded-xl border-2 py-2">
                    <SelectValue>{(v) => ({ '24': '24 hours', '48': '48 hours', '72': '72 hours', '168': '7 days' } as Record<string, string>)[String(v)] ?? '48 hours'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours (recommended)</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Faculty searchable combobox (admin / PD only) ────────────────────────────
function FacultySearch({ faculty, value, onChange, currentUserId }: {
  faculty: Faculty[]; value: string; onChange: (id: string) => void; currentUserId: string
}) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  const selected = faculty.find((f) => f.id === value)
  const filtered = query
    ? faculty.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.email.toLowerCase().includes(query.toLowerCase())
      )
    : faculty

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border-2 bg-card px-3.5 py-2 text-sm text-left transition-all',
          open ? 'border-primary ring-4 ring-primary/10' : 'border-input hover:border-primary/40',
        )}
      >
        {selected ? (
          <>
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(selected.name)}
            </div>
            <span className="flex-1 font-medium">{selected.name}</span>
            <span className="text-xs text-muted-foreground">{humanRole(selected.role)}</span>
            {selected.id === currentUserId && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">YOU</span>
            )}
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Select a faculty host</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/10"
          >
            <div className="border-b border-border p-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-lg bg-muted px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted/80 transition"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id} type="button"
                    onClick={() => { onChange(f.id); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-accent',
                      f.id === value && 'bg-primary/5',
                    )}
                  >
                    <div className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      f.id === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>{initials(f.name)}</div>
                    <span className="flex-1 text-left font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{humanRole(f.role)}</span>
                    {f.id === currentUserId && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">YOU</span>
                    )}
                    {f.id === value && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
