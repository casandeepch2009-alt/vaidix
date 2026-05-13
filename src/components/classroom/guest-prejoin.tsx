'use client'

// ════════════════════════════════════════════════════════════════════════════
// GuestPrejoin — anonymous-guest lobby for openToAll sessions
// ════════════════════════════════════════════════════════════════════════════
// Three states the screen walks through (no page navigation in between):
//
//   1. NAME           Type a display name + press "Ask to join". A short
//                     POST registers the guest in the waiting room and sets
//                     an HttpOnly cookie keyed to this sessionId.
//   2. WAITING        Polls every 2s for admission status. Host sees the
//                     guest's name in the in-call sidebar and clicks
//                     Admit / Deny.
//   3. JOINED         Mounts a minimal LiveKitRoom — audio + camera +
//                     screen-share controls only. Chat, Q&A, breakouts and
//                     all other Vaidix surfaces stay gated behind a real
//                     user account; the live media itself works.
//
// Teams-parity notes:
//   - First load shows no Vaidix branding bigger than necessary; the focus
//     is the "you've been invited to this meeting" card.
//   - DENIED is a terminal state for this admission; user can press "Try
//     again" which resets to NAME (and the next POST refreshes the row
//     back to PENDING via the service's re-request logic).
//   - We never persist personal info — the name is only on the admission
//     row and on the LiveKit participant identity, both ephemeral.

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, MonitorOff,
  PhoneOff, Loader2, Clock, Shield, LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type LobbyState =
  | { kind: 'NAME' }
  | { kind: 'WAITING'; admissionId: string }
  | { kind: 'JOINED'; token: string; url: string; role: 'PARTICIPANT' | 'VIEWER' }
  | { kind: 'DENIED'; reason: string | null }
  | { kind: 'NOT_PERMITTED' }

type PollResult =
  | { state: 'WAITING'; admissionId: string }
  | { state: 'JOINED'; token: string; url: string; role: 'PARTICIPANT' | 'VIEWER' }
  | { state: 'DENIED'; reason: string | null }
  | { state: 'UNKNOWN' }

export interface GuestPrejoinProps {
  sessionId: string
  title: string
  hostName: string
  hostAvatarUrl: string | null
  scheduledStart: string
  scheduledEnd: string
}

export function GuestPrejoin(props: GuestPrejoinProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<LobbyState>({ kind: 'NAME' })
  const router = useRouter()

  // ── Poll while waiting ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.kind !== 'WAITING') return
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/classroom/sessions/${props.sessionId}/guest`, {
          method: 'GET',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) return
        const data = json.data as PollResult
        if (cancelled) return
        if (data.state === 'JOINED') {
          setState({ kind: 'JOINED', token: data.token, url: data.url, role: data.role })
        } else if (data.state === 'DENIED') {
          setState({ kind: 'DENIED', reason: data.reason })
        }
      } catch {
        // Network blip — keep polling.
      }
    }
    void tick()
    const handle = window.setInterval(tick, 2000)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [state.kind, props.sessionId, state])

  const submit = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/classroom/sessions/${props.sessionId}/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code as string | undefined
        if (code === 'OPEN_NOT_PERMITTED') {
          setState({ kind: 'NOT_PERMITTED' })
          return
        }
        setError(json?.error?.message ?? 'Could not request to join. Try again.')
        return
      }
      setState({ kind: 'WAITING', admissionId: json.data.admissionId })
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [name, props.sessionId])

  const tryAgain = useCallback(() => {
    setState({ kind: 'NAME' })
    setError(null)
  }, [])

  // ── JOINED → render LiveKit room ────────────────────────────────────────
  if (state.kind === 'JOINED') {
    return (
      <GuestLiveRoom
        token={state.token}
        url={state.url}
        title={props.title}
        canPublish={state.role === 'PARTICIPANT'}
        onLeave={() => {
          // Recycle to lobby — cookie keeps admission so they could re-enter,
          // but a fresh prompt feels cleaner after hanging up.
          setState({ kind: 'NAME' })
          router.refresh()
        }}
      />
    )
  }

  // ── Pre-join chrome (NAME / WAITING / DENIED / NOT_PERMITTED) ──────────
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-white to-emerald-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_25%_15%,rgba(16,185,129,0.08),transparent_55%),radial-gradient(circle_at_75%_85%,rgba(59,130,246,0.08),transparent_55%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-8 shadow-xl backdrop-blur"
      >
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Vaidix Live
          </p>
          <h1 className="mt-1 line-clamp-2 text-xl font-semibold text-foreground">
            {props.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosted by {props.hostName}
          </p>
          <ScheduleLine start={props.scheduledStart} end={props.scheduledEnd} />
        </div>

        <AnimatePresence mode="wait">
          {state.kind === 'NAME' && (
            <motion.div
              key="name"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <label htmlFor="guest-name" className="text-sm font-medium text-foreground">
                Your name
              </label>
              <Input
                id="guest-name"
                value={name}
                placeholder="e.g. Dr. Priya Rao"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submitting) void submit()
                }}
                disabled={submitting}
                autoFocus
                maxLength={80}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is what other participants will see.
              </p>
              {error && (
                <p className="mt-2 text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                onClick={() => void submit()}
                disabled={submitting || !name.trim()}
                className="mt-4 w-full"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Ask to join'}
              </Button>
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3.5" />
                Waiting room enabled — the host will let you in.
              </div>
              <a
                href={`/login?next=/classroom/${props.sessionId}`}
                className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <LogIn className="size-3.5" />
                Have a Vaidix account? Sign in instead.
              </a>
            </motion.div>
          )}

          {state.kind === 'WAITING' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <Loader2 className="size-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="mt-4 text-base font-semibold">Waiting for the host…</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ve let {props.hostName} know you&apos;re here.
                You&apos;ll join the call as soon as you&apos;re admitted.
              </p>
            </motion.div>
          )}

          {state.kind === 'DENIED' && (
            <motion.div
              key="denied"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <h2 className="text-base font-semibold text-destructive">Join request declined</h2>
              {state.reason && (
                <p className="mt-1 text-sm text-muted-foreground">{state.reason}</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                If you think this is a mistake, sign in with a Vaidix account or contact the host.
              </p>
              <Button variant="outline" onClick={tryAgain} className="mt-4 w-full">
                Try again
              </Button>
            </motion.div>
          )}

          {state.kind === 'NOT_PERMITTED' && (
            <motion.div
              key="not-permitted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <h2 className="text-base font-semibold">This session needs a sign-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The host has not enabled guest join for this meeting.
              </p>
              <a
                href={`/login?next=/classroom/${props.sessionId}`}
                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Sign in to join
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function ScheduleLine({ start, end }: { start: string; end: string }) {
  const text = useMemo(() => {
    const s = new Date(start)
    const e = new Date(end)
    const sameDay = s.toDateString() === e.toDateString()
    const dateFmt = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const timeFmt = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return sameDay
      ? `${dateFmt.format(s)} · ${timeFmt.format(s)} – ${timeFmt.format(e)}`
      : `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(e)} ${timeFmt.format(e)}`
  }, [start, end])
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      {text}
    </p>
  )
}

// ─── Minimal LiveKit room for guests ─────────────────────────────────────────
// Stripped to media-only so we don't accidentally surface authed-user
// surfaces (chat, QA, breakouts) that would 401 every poll. Members of the
// session see the guest in the LiveKit participant list and can chat with
// them via raised-hand / spoken signals — exactly the Teams-guest contract.

function GuestLiveRoom({
  token,
  url,
  title,
  canPublish,
  onLeave,
}: {
  token: string
  url: string
  title: string
  canPublish: boolean
  onLeave: () => void
}) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      audio
      video
      onDisconnected={onLeave}
      data-lk-theme="default"
      className="h-screen w-screen"
    >
      <div className="flex h-full flex-col bg-black text-white">
        <header className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="truncate font-semibold">{title}</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Guest
          </span>
        </header>
        <main className="flex-1 overflow-hidden p-2">
          <GuestStage />
        </main>
        <RoomAudioRenderer />
        <GuestControls canPublish={canPublish} onLeave={onLeave} />
      </div>
    </LiveKitRoom>
  )
}

function GuestStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  return (
    <GridLayout tracks={tracks} className="h-full">
      <ParticipantTile />
    </GridLayout>
  )
}

function GuestControls({ canPublish, onLeave }: { canPublish: boolean; onLeave: () => void }) {
  // Avoid `useLocalParticipant` here — keeping the dependency surface narrow
  // means the guest controls never accidentally try to invoke an admin RPC.
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [shareOn, setShareOn] = useState(false)
  const lpRef = useRef<{
    setMicrophoneEnabled: (v: boolean) => Promise<unknown>
    setCameraEnabled: (v: boolean) => Promise<unknown>
    setScreenShareEnabled: (v: boolean) => Promise<unknown>
  } | null>(null)
  return (
    <LocalParticipantBridge ref={lpRef}>
      <footer className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/60 px-4 py-3">
        {canPublish && (
          <>
            <Button
              size="icon"
              variant={micOn ? 'secondary' : 'destructive'}
              onClick={async () => {
                const next = !micOn
                setMicOn(next)
                await lpRef.current?.setMicrophoneEnabled(next)
              }}
              title={micOn ? 'Mute mic' : 'Unmute mic'}
            >
              {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </Button>
            <Button
              size="icon"
              variant={camOn ? 'secondary' : 'destructive'}
              onClick={async () => {
                const next = !camOn
                setCamOn(next)
                await lpRef.current?.setCameraEnabled(next)
              }}
              title={camOn ? 'Stop camera' : 'Start camera'}
            >
              {camOn ? <VideoIcon className="size-4" /> : <VideoOff className="size-4" />}
            </Button>
            <Button
              size="icon"
              variant={shareOn ? 'default' : 'secondary'}
              onClick={async () => {
                const next = !shareOn
                setShareOn(next)
                await lpRef.current?.setScreenShareEnabled(next)
              }}
              title={shareOn ? 'Stop sharing' : 'Share screen'}
            >
              {shareOn ? <MonitorOff className="size-4" /> : <Monitor className="size-4" />}
            </Button>
          </>
        )}
        <Button size="icon" variant="destructive" onClick={onLeave} title="Leave call">
          <PhoneOff className="size-4" />
        </Button>
      </footer>
    </LocalParticipantBridge>
  )
}

// useLocalParticipant has to be called inside the LiveKitRoom subtree, but we
// also want to expose its methods to a sibling. This bridge captures the
// participant handle once and forwards it via ref.
const LocalParticipantBridge = forwardRef<unknown, { children: React.ReactNode }>(
  function LocalParticipantBridge({ children }, ref) {
    const { localParticipant } = useLocalParticipant()
    useImperativeHandle(ref, () => ({
      setMicrophoneEnabled: (v: boolean) => localParticipant.setMicrophoneEnabled(v),
      setCameraEnabled: (v: boolean) => localParticipant.setCameraEnabled(v),
      setScreenShareEnabled: (v: boolean) => localParticipant.setScreenShareEnabled(v),
    }))
    return <>{children}</>
  },
)
