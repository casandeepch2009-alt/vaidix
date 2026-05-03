'use client'

import { CalendarDays, Clock, Video, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PreJoin({
  session,
  consented,
  onConsent,
  onJoin,
  loading,
  error,
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
}) {
  const start = new Date(session.scheduledStart)
  const end = new Date(session.scheduledEnd)
  const now = new Date()
  const startsInMs = start.getTime() - now.getTime()
  const liveStartingSoon = startsInMs <= 15 * 60 * 1000 || session.status === 'LIVE'

  return (
    <div className="mx-auto max-w-2xl py-8">
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
            disabled={!consented || loading || !liveStartingSoon}
          >
            {loading ? 'Connecting…' : liveStartingSoon ? 'Join now' : 'Too early to join'}
          </Button>
        </div>
      </div>
    </div>
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
