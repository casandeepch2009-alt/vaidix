'use client'

import Link from 'next/link'
import {
  ArrowLeft, CalendarDays, Clock, Video, Shield,
  ShieldCheck, MessageCircleQuestion, BookOpen, Target, CheckCircle2, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PrereqStatus, PrereqCheck } from '@/server/services/sessions/prereq'

export function PreJoin({
  session,
  consented,
  onConsent,
  onJoin,
  loading,
  error,
  prereqStatus,
}: {
  session: {
    id: string
    title: string
    description: string | null
    sessionType: string
    status: string
    scheduledStart: string
    scheduledEnd: string
    recordingEnabled: boolean
    consentRequired: boolean
    host: { name: string }
  }
  consented: boolean
  onConsent: (v: boolean) => void
  onJoin: () => void
  loading: boolean
  error: string | null
  prereqStatus?: PrereqStatus | null
}) {
  const start = new Date(session.scheduledStart)
  const end = new Date(session.scheduledEnd)
  const now = new Date()
  const startsInMs = start.getTime() - now.getTime()
  const liveStartingSoon = startsInMs <= 15 * 60 * 1000 || session.status === 'LIVE'
  const prereqBlocked = !!prereqStatus && prereqStatus.hasGate && !prereqStatus.allMet

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Link
        href="/classroom"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to Classroom
      </Link>
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Video className="size-3.5" /> {session.sessionType.replace(/_/g, ' ')}
          {session.status === 'LIVE' && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">
              <span className="size-1.5 animate-pulse rounded-full bg-red-600" /> LIVE
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{session.title}</h1>
        {session.description && (
          <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <InfoRow icon={<CalendarDays className="size-4" />}>
            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}·{' '}
            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
            {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </InfoRow>
          <InfoRow icon={<Clock className="size-4" />}>
            {session.status === 'LIVE'
              ? 'In progress'
              : startsInMs > 0
                ? `Starts in ${formatDuration(startsInMs)}`
                : 'Starting soon'}
          </InfoRow>
          <InfoRow icon={<Video className="size-4" />}>Hosted by {session.host.name}</InfoRow>
          {session.recordingEnabled && (
            <InfoRow icon={<Shield className="size-4" />}>This session will be recorded</InfoRow>
          )}
        </div>

        {prereqStatus && (prereqStatus.hasGate || prereqStatus.mode === 'OPTIONAL') && (
          <PrereqPanel sessionId={session.id} status={prereqStatus} />
        )}

        {session.consentRequired && (
          <label className="mt-6 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => onConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I acknowledge that this session may be recorded and processed by Vaidix AI for
              transcription, pearl extraction, and training of educational models. De-identified
              content may be retained per LVPEI's data retention policy.
            </span>
          </label>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => history.back()}>Cancel</Button>
          <Button
            onClick={onJoin}
            disabled={!consented || loading || !liveStartingSoon || prereqBlocked}
            data-testid="prejoin-join"
          >
            {loading
              ? 'Connecting…'
              : prereqBlocked
                ? 'Complete prerequisites to join'
                : liveStartingSoon
                  ? 'Join now'
                  : 'Too early to join'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PrereqPanel({ sessionId, status }: { sessionId: string; status: PrereqStatus }) {
  const mandatory = status.mode === 'MANDATORY'
  const allMet = status.allMet
  return (
    <div
      className={`mt-6 rounded-md border p-4 ${
        mandatory && !allMet
          ? 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
          : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
      }`}
      data-testid="prereq-panel"
    >
      <div className="flex items-start gap-2">
        {mandatory && !allMet ? (
          <Lock className="mt-0.5 size-4 text-amber-700 dark:text-amber-400" />
        ) : (
          <ShieldCheck className="mt-0.5 size-4 text-emerald-700 dark:text-emerald-400" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {mandatory
              ? allMet
                ? 'Prerequisites met'
                : 'Prerequisites required'
              : 'Recommended prep'}
          </p>
          <p className="text-xs text-muted-foreground">
            {mandatory
              ? allMet
                ? 'You’ve completed every required step. Join when the room opens.'
                : 'Finish the items below to unlock the join button.'
              : 'These are optional, but the host suggests them before joining.'}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {status.checks.preQuestions.required && (
          <PrereqRow
            icon={<MessageCircleQuestion className="size-3.5" />}
            label="Pre-questions submitted"
            href={`/classroom/${sessionId}/pre-questions`}
            check={status.checks.preQuestions}
            unit="question"
          />
        )}
        {status.checks.studyPack.required && (
          <PrereqRow
            icon={<BookOpen className="size-3.5" />}
            label="Study pack opened"
            href={`/classroom/${sessionId}/study`}
            check={status.checks.studyPack}
            unit="item"
          />
        )}
        {status.checks.readinessAck.required && (
          <PrereqRow
            icon={<Target className="size-3.5" />}
            label="Readiness self-marked"
            href={`/classroom/${sessionId}`}
            check={status.checks.readinessAck}
            unit="objective"
          />
        )}
      </ul>
    </div>
  )
}

function PrereqRow({
  icon, label, href, check, unit,
}: {
  icon: React.ReactNode
  label: string
  href: string
  check: PrereqCheck
  unit: string
}) {
  const pct = check.total === 0 ? 100 : Math.round((Math.min(check.current, check.total) / check.total) * 100)
  return (
    <li
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
      data-testid={`prereq-row-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {check.current}/{check.total} {unit}{check.total === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-500 ${
              check.met ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {check.met ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      ) : (
        <Link
          href={href}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground transition hover:opacity-90"
        >
          Open
        </Link>
      )}
    </li>
  )
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  )
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}
