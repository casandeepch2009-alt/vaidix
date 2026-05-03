'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Hand, MessageSquare, Users, Trophy,
  LayoutGrid, Zap, Brain, X, Settings, Link2, ChevronDown,
} from 'lucide-react'
import { WaitingRoom } from './waiting-room'
import { PreJoin } from './pre-join'
import { ParticipantSidebar } from './participant-sidebar'
import { ChatPanel } from './chat-panel'
import { Button } from '@/components/ui/button'
import { HookOverlay } from '@/components/engagement/hook-overlay'
import { PresenterAlertsHud } from '@/components/engagement/presenter-alerts-hud'
import { LeaderboardPanel } from '@/components/engagement/leaderboard-panel'
import { HooksComposer } from '@/components/engagement/hooks-composer'
import { CoachPanel } from '@/components/engagement/coach-panel'
import { LiveCaptionsOverlay } from '@/components/engagement/live-captions-overlay'
import { BreakoutsPanel } from './breakouts-panel'
import { BreakoutRoomView } from './breakout-room-view'
import { BgPicker } from './bg-picker'
import { cn } from '@/lib/utils'

interface SessionInfo {
  id: string
  title: string
  description: string | null
  sessionType: string
  status: string
  approvalStatus: string
  scheduledStart: string
  scheduledEnd: string
  recordingEnabled: boolean
  consentRequired: boolean
  host: { id: string; name: string; email: string; avatarUrl: string | null }
}

type JoinState =
  | { kind: 'IDLE' }
  | { kind: 'FETCHING' }
  | { kind: 'WAITING'; admissionId: string }
  | { kind: 'DENIED'; reason?: string | null }
  | { kind: 'JOINED'; token: string; url: string; role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER' }
  | { kind: 'ERROR'; message: string }

export function LiveSession({
  session,
  currentUser,
  shareToken,
}: {
  session: SessionInfo
  currentUser: { id: string; name: string }
  shareToken?: string
}) {
  const router = useRouter()
  const [state, setState] = useState<JoinState>({ kind: 'IDLE' })
  const [consented, setConsented] = useState(!session.consentRequired)
  const [activeBreakout, setActiveBreakout] = useState<{ id: string; name: string } | null>(null)

  const requestToken = useCallback(async () => {
    setState({ kind: 'FETCHING' })
    try {
      const url = new URL(`/api/classroom/sessions/${session.id}/token`, window.location.origin)
      if (shareToken) url.searchParams.set('t', shareToken)
      const res = await fetch(url.toString(), { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!json.ok) {
        setState({ kind: 'ERROR', message: json.error?.message ?? 'Failed to get token' })
        return
      }
      const d = json.data
      if (d.state === 'JOINED') {
        setState({ kind: 'JOINED', token: d.token, url: d.url, role: d.role })
      } else if (d.state === 'WAITING') {
        setState({ kind: 'WAITING', admissionId: d.admissionId })
      } else if (d.state === 'DENIED') {
        setState({ kind: 'DENIED', reason: d.reason })
      }
    } catch (e) {
      setState({ kind: 'ERROR', message: (e as Error).message })
    }
  }, [session.id, shareToken])

  useEffect(() => {
    if (state.kind !== 'WAITING') return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/classroom/sessions/${session.id}/token${shareToken ? `?t=${shareToken}` : ''}`, {
          method: 'POST',
          credentials: 'include',
        })
        const json = await res.json()
        if (json.ok && json.data.state === 'JOINED') {
          setState({ kind: 'JOINED', token: json.data.token, url: json.data.url, role: json.data.role })
        } else if (json.ok && json.data.state === 'DENIED') {
          setState({ kind: 'DENIED', reason: json.data.reason })
        }
      } catch {
        /* swallow */
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [state.kind, session.id, shareToken])

  if (session.approvalStatus !== 'APPROVED') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Session is not approved yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Waiting for faculty approval. Status: {session.approvalStatus.replace(/_/g, ' ')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/calendar')}>
            Back to calendar
          </Button>
        </div>
      </div>
    )
  }

  if (state.kind === 'JOINED') {
    if (activeBreakout) {
      const isFaculty = state.role === 'HOST' || state.role === 'CO_HOST'
      return (
        <BreakoutRoomView
          sessionId={session.id}
          breakoutId={activeBreakout.id}
          breakoutName={activeBreakout.name}
          isFaculty={isFaculty}
          onLeave={() => setActiveBreakout(null)}
        />
      )
    }
    return (
      <LiveRoom
        token={state.token}
        url={state.url}
        role={state.role}
        session={session}
        currentUser={currentUser}
        onLeave={() => router.push('/calendar')}
        onJoinBreakout={(b) => setActiveBreakout(b)}
      />
    )
  }

  if (state.kind === 'WAITING') {
    return <WaitingRoom session={session} onCancel={() => router.push('/calendar')} />
  }

  if (state.kind === 'DENIED') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold">Entry denied</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.reason ?? 'The host declined your request to join.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/calendar')}>
            Back to calendar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PreJoin
      session={session}
      consented={consented}
      onConsent={setConsented}
      onJoin={requestToken}
      loading={state.kind === 'FETCHING'}
      error={state.kind === 'ERROR' ? state.message : null}
    />
  )
}

// ----------------------------------------------------------------------------
// Connected room wrapper
// ----------------------------------------------------------------------------
function LiveRoom({
  token,
  url,
  role,
  session,
  currentUser,
  onLeave,
  onJoinBreakout,
}: {
  token: string
  url: string
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER'
  session: SessionInfo
  currentUser: { id: string; name: string }
  onLeave: () => void
  onJoinBreakout: (breakout: { id: string; name: string }) => void
}) {
  const isHostish = role === 'HOST' || role === 'CO_HOST'
  const [connectedOnce, setConnectedOnce] = useState(false)
  const [exitState, setExitState] = useState<'live' | 'left' | 'failed'>('live')

  if (exitState === 'left' || exitState === 'failed') {
    const failed = exitState === 'failed'
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md shadow-sm">
          <h2 className="text-lg font-bold text-foreground">
            {failed ? 'Could not connect' : "You've left the session"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed
              ? "The live class server didn't accept the connection. Make sure LiveKit is running locally, then try again."
              : 'You disconnected from the live room. You can rejoin or go back to the calendar.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button onClick={() => { setConnectedOnce(false); setExitState('live') }}>
              Rejoin
            </Button>
            <Button variant="outline" onClick={onLeave}>
              Back to calendar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      data-lk-theme="default"
      onConnected={() => setConnectedOnce(true)}
      onDisconnected={() => setExitState(connectedOnce ? 'left' : 'failed')}
      className="h-[calc(100vh-4rem)] overflow-hidden"
    >
      <InnerRoom
        session={session}
        currentUser={currentUser}
        role={role}
        isHostish={isHostish}
        onLeave={onLeave}
        onJoinBreakout={onJoinBreakout}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

// ----------------------------------------------------------------------------
// InnerRoom — lives inside LiveKitRoom context so hooks work
// ----------------------------------------------------------------------------
function InnerRoom({
  session,
  currentUser,
  role,
  isHostish,
  onLeave,
  onJoinBreakout,
}: {
  session: SessionInfo
  currentUser: { id: string; name: string }
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER'
  isHostish: boolean
  onLeave: () => void
  onJoinBreakout: (b: { id: string; name: string }) => void
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const participants = useParticipants()

  const tabs = [
    { id: 'participants', label: 'People', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'leaderboard', label: 'Board', icon: Trophy },
    { id: 'breakouts', label: 'Breakouts', icon: LayoutGrid },
    ...(isHostish ? [{ id: 'hooks', label: 'Hooks', icon: Zap }] : []),
    ...(!isHostish ? [{ id: 'coach', label: 'Coach', icon: Brain }] : []),
  ]

  const openTab = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(true)
  }

  return (
    <div className="relative h-full bg-zinc-950 overflow-hidden">
      {/* Full-screen video layer */}
      <div className="absolute inset-0">
        <VideoGrid />
      </div>

      {/* Top gradient vignette */}
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/75 via-black/30 to-transparent z-10 pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          {/* Live badge */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-widest">LIVE</span>
          </div>
          {/* Session title */}
          <div className="bg-black/30 backdrop-blur-md border border-white/7 rounded-lg px-3 py-1.5 max-w-65">
            <span className="text-sm font-medium text-white/90 truncate block">{session.title}</span>
          </div>
          {/* Participant count */}
          <div className="flex items-center gap-1.5 text-white/40 text-xs bg-black/20 backdrop-blur-md border border-white/6 rounded-lg px-2.5 py-1.5">
            <Users className="w-3 h-3" />
            <span>{participants.length}</span>
          </div>
        </div>

        {isHostish && (
          <HostControlsMenu sessionId={session.id} isHost={role === 'HOST'} />
        )}
      </div>

      {/* Bottom gradient vignette */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-black/85 via-black/40 to-transparent z-10 pointer-events-none" />

      {/* Floating control bar */}
      <ControlBar
        sessionId={session.id}
        role={role}
        isHostish={isHostish}
        sidebarOpen={sidebarOpen}
        activeTab={activeTab}
        onOpenTab={openTab}
        onLeave={onLeave}
      />

      {/* Sidebar backdrop (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sliding sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute right-0 top-0 bottom-0 w-[320px] z-30 flex flex-col bg-zinc-900/95 backdrop-blur-2xl border-l border-white/7 shadow-2xl shadow-black/60"
          >
            {/* Sidebar header — active tab name + icon-only tab switcher */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/7 shrink-0">
              <span className="flex-1 text-xs font-semibold text-white/70 uppercase tracking-wider truncate">
                {tabs.find((t) => t.id === activeTab)?.label ?? ''}
              </span>
              <div className="flex items-center gap-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      title={tab.label}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150',
                        isActive
                          ? 'bg-teal-500/20 text-teal-400'
                          : 'text-white/35 hover:text-white/75 hover:bg-white/6'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  )
                })}
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  title="Close panel"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/80 hover:bg-white/6 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'participants' && (
                <ParticipantSidebar
                  sessionId={session.id}
                  canModerate={isHostish}
                  currentUserId={currentUser.id}
                />
              )}
              {activeTab === 'chat' && (
                <ChatPanel sessionId={session.id} currentUser={currentUser} />
              )}
              {activeTab === 'leaderboard' && (
                <LeaderboardPanel sessionId={session.id} />
              )}
              {activeTab === 'breakouts' && (
                <BreakoutsPanel
                  sessionId={session.id}
                  isFaculty={isHostish}
                  currentUserId={currentUser.id}
                  onJoin={onJoinBreakout}
                />
              )}
              {isHostish && activeTab === 'hooks' && (
                <HooksComposer sessionId={session.id} />
              )}
              {!isHostish && activeTab === 'coach' && (
                <CoachPanel learnerId={currentUser.id} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Engagement overlays */}
      <HookOverlay sessionId={session.id} />
      <PresenterAlertsHud sessionId={session.id} isHost={role === 'HOST'} />
      <LiveCaptionsOverlay sessionId={session.id} />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Floating control bar — uses LiveKit hooks
// ----------------------------------------------------------------------------
function ControlBar({
  sessionId,
  role,
  isHostish,
  sidebarOpen,
  activeTab,
  onOpenTab,
  onLeave,
}: {
  sessionId: string
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER'
  isHostish: boolean
  sidebarOpen: boolean
  activeTab: string
  onOpenTab: (tab: string) => void
  onLeave: () => void
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant()
  const [isSharing, setIsSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
  // Surfaces "no microphone / no camera / permission denied" errors as a
  // small toast instead of letting LiveKit's getUserMedia() rejection bubble
  // up to Next.js's error overlay. Cleared after 4s.
  const [deviceError, setDeviceError] = useState<string | null>(null)
  useEffect(() => {
    if (!deviceError) return
    const t = setTimeout(() => setDeviceError(null), 4000)
    return () => clearTimeout(t)
  }, [deviceError])

  function describeMediaError(err: unknown, kind: 'microphone' | 'camera'): string {
    const e = err as { name?: string; message?: string }
    const name = e?.name ?? ''
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return `No ${kind} found on this device.`
    }
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return `${kind === 'microphone' ? 'Microphone' : 'Camera'} access blocked. Check browser permissions.`
    }
    if (name === 'NotReadableError') {
      return `${kind === 'microphone' ? 'Microphone' : 'Camera'} is already in use by another app.`
    }
    return e?.message ?? `Could not enable ${kind}.`
  }

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch (err) {
      setDeviceError(describeMediaError(err, 'microphone'))
    }
  }, [isMicrophoneEnabled, localParticipant])

  const toggleCamera = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch (err) {
      setDeviceError(describeMediaError(err, 'camera'))
    }
  }, [isCameraEnabled, localParticipant])

  // Sync hand-raise state with LiveKit participant metadata
  useEffect(() => {
    if (!localParticipant.metadata) {
      setHandRaised(false)
      return
    }
    try {
      const parsed = JSON.parse(localParticipant.metadata)
      setHandRaised(parsed?.handRaised === true)
    } catch {
      setHandRaised(false)
    }
  }, [localParticipant.metadata])

  const toggleHand = useCallback(async () => {
    const next = !handRaised
    await localParticipant.setMetadata(
      next ? JSON.stringify({ handRaised: true, at: Date.now() }) : '{}'
    )
    setHandRaised(next)
    // Emit a HAND_RAISE engagement signal only on raise (not on lower) so the
    // leaderboard's `recentHandRaises` aggregate (engagement-service.ts) stays
    // aligned with the metadata broadcast. Failure is non-fatal — the LiveKit
    // metadata is the source of truth for the visual hand-raise state.
    if (next) {
      void fetch(`/api/classroom/sessions/${sessionId}/engagement-signals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'HAND_RAISE' }),
      }).catch(() => {
        /* engagement signal is best-effort; UI hand-raise already broadcast */
      })
    }
  }, [handRaised, localParticipant, sessionId])

  const toggleScreen = useCallback(async () => {
    try {
      const next = !isSharing
      await localParticipant.setScreenShareEnabled(next)
      setIsSharing(next)
    } catch (err) {
      // User-cancel via the OS picker is the common case → silent.
      // Real errors (no permission, no display capture support) show as toast.
      const e = err as { name?: string }
      if (e?.name && e.name !== 'NotAllowedError') {
        setDeviceError(describeMediaError(err, 'camera'))
      }
    }
  }, [isSharing, localParticipant])

  return (
    <div className="absolute bottom-5 inset-x-0 z-20 flex items-end justify-center gap-3 px-4">
      {/* Device-error toast (auto-dismiss after 4s) */}
      <AnimatePresence>
        {deviceError && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-md rounded-xl bg-red-500/15 border border-red-500/40 backdrop-blur-md px-4 py-2.5 text-sm text-red-100 shadow-lg shadow-black/40"
            role="alert"
          >
            {deviceError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main controls pill */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', damping: 22, stiffness: 220 }}
        className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-2xl border border-white/7 rounded-[28px] px-4 py-3 shadow-2xl shadow-black/70"
      >
        {/* Mic */}
        {role !== 'VIEWER' && (
          <CtrlBtn
            onClick={toggleMic}
            icon={isMicrophoneEnabled
              ? <Mic className="w-5 h-5" />
              : <MicOff className="w-5 h-5" />}
            label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            variant={isMicrophoneEnabled ? 'default' : 'danger'}
          />
        )}

        {/* Camera + background picker (half-pill split button) */}
        {role !== 'VIEWER' && (
          <div className="relative flex flex-col items-center gap-1.5 group">
            <div
              className={cn(
                'flex items-stretch rounded-full overflow-hidden transition-all duration-200',
                isCameraEnabled
                  ? 'bg-white/10 hover:bg-white/14'
                  : 'bg-red-500/15 hover:bg-red-500/22'
              )}
            >
              {/* Main camera toggle */}
              <button
                onClick={toggleCamera}
                title={isCameraEnabled ? 'Stop video' : 'Start video'}
                className={cn(
                  'w-10 h-12 flex items-center justify-center transition-colors duration-200 pl-2',
                  isCameraEnabled ? 'text-white/90' : 'text-red-400'
                )}
              >
                {isCameraEnabled
                  ? <Video className="w-5 h-5" />
                  : <VideoOff className="w-5 h-5" />}
              </button>
              {/* Bg picker caret */}
              <button
                onClick={() => setBgPickerOpen((v) => !v)}
                title="Change background"
                className={cn(
                  'w-6 h-12 flex items-center justify-center border-l transition-colors duration-200 pr-1',
                  isCameraEnabled ? 'border-white/10' : 'border-red-500/20',
                  bgPickerOpen
                    ? 'text-teal-400'
                    : isCameraEnabled ? 'text-white/30 hover:text-white/70' : 'text-red-400/60 hover:text-red-400'
                )}
              >
                <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', bgPickerOpen && 'rotate-180')} />
              </button>
            </div>
            <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors leading-none">
              Video
            </span>
            {/* Background picker panel */}
            <AnimatePresence>
              {bgPickerOpen && (
                <BgPicker onClose={() => setBgPickerOpen(false)} />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Screen share (host/co-host only) */}
        {isHostish && (
          <>
            <Divider />
            <CtrlBtn
              onClick={toggleScreen}
              icon={isSharing
                ? <MonitorOff className="w-5 h-5" />
                : <Monitor className="w-5 h-5" />}
              label={isSharing ? 'Stop share' : 'Share screen'}
              variant={isSharing ? 'active' : 'default'}
            />
          </>
        )}

        {/* Hand raise */}
        {role !== 'VIEWER' && (
          <CtrlBtn
            onClick={toggleHand}
            icon={<Hand className="w-5 h-5" />}
            label={handRaised ? 'Lower hand' : 'Raise hand'}
            variant={handRaised ? 'active' : 'default'}
          />
        )}

        <Divider />

        {/* Chat */}
        <CtrlBtn
          onClick={() => onOpenTab('chat')}
          icon={<MessageSquare className="w-5 h-5" />}
          label="Chat"
          variant={sidebarOpen && activeTab === 'chat' ? 'active' : 'default'}
        />

        {/* People */}
        <CtrlBtn
          onClick={() => onOpenTab('participants')}
          icon={<Users className="w-5 h-5" />}
          label="People"
          variant={sidebarOpen && activeTab === 'participants' ? 'active' : 'default'}
        />

        {/* Board */}
        <CtrlBtn
          onClick={() => onOpenTab('leaderboard')}
          icon={<Trophy className="w-5 h-5" />}
          label="Board"
          variant={sidebarOpen && activeTab === 'leaderboard' ? 'active' : 'default'}
        />
      </motion.div>

      {/* Leave — separate pill, visually distinct */}
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.22, type: 'spring', damping: 22, stiffness: 220 }}
        onClick={onLeave}
        className="flex items-center gap-2 bg-red-500 hover:bg-red-400 active:scale-95 text-white rounded-full h-12 px-6 font-semibold text-sm shadow-xl shadow-red-500/30 transition-all duration-200 shrink-0"
      >
        <PhoneOff className="w-5 h-5" />
        Leave
      </motion.button>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Individual control button
// ----------------------------------------------------------------------------
type CtrlVariant = 'default' | 'danger' | 'active'

function CtrlBtn({
  onClick,
  icon,
  label,
  variant = 'default',
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  variant?: CtrlVariant
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex flex-col items-center gap-1.5 group outline-none"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group-active:scale-95',
          variant === 'default' && 'bg-white/10 text-white/90 hover:bg-white/18',
          variant === 'danger'  && 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
          variant === 'active'  && 'bg-teal-500/20 text-teal-300 shadow-[0_0_0_1.5px_theme(colors.teal.500/0.4)] hover:bg-teal-500/30',
        )}
      >
        {icon}
      </div>
      <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors leading-none">
        {label}
      </span>
    </button>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-white/8 mx-1 self-center" />
}

// ----------------------------------------------------------------------------
// Host controls menu (dark-themed for the dark top bar)
// ----------------------------------------------------------------------------
function HostControlsMenu({ sessionId, isHost }: { sessionId: string; isHost: boolean }) {
  const room = useRoomContext()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function muteAll() {
    if (!confirm('Mute all participants except you?')) return
    setBusy(true)
    try {
      const me = room.localParticipant.identity
      const others = Array.from(room.remoteParticipants.values()).filter((p) => p.identity !== me)
      await Promise.all(
        others.map((p) =>
          fetch(`/api/classroom/sessions/${sessionId}/participants/${p.identity}/mute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ muted: true }),
          })
        )
      )
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function copyShareLink() {
    setBusy(true)
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlHours: 24 }),
      })
      const json = await res.json()
      if (!json.ok) return
      await navigator.clipboard.writeText(json.data.url)
      alert(`Share link copied. Expires: ${new Date(json.data.expiresAt).toLocaleString()}`)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function endSession() {
    if (!confirm('End this session for everyone?')) return
    setBusy(true)
    try {
      await fetch(`/api/classroom/sessions/${sessionId}/end`, { method: 'POST' })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white/80 hover:text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
      >
        <Settings className="w-3.5 h-3.5" />
        Host controls
        <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-52 rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-white/8 shadow-2xl shadow-black/60 z-50 overflow-hidden p-1"
          >
            <HostMenuItem onClick={muteAll} disabled={busy} icon={<MicOff className="w-3.5 h-3.5" />}>
              Mute all except me
            </HostMenuItem>
            <HostMenuItem onClick={copyShareLink} disabled={busy} icon={<Link2 className="w-3.5 h-3.5" />}>
              Copy share link
            </HostMenuItem>
            {isHost && (
              <>
                <div className="h-px bg-white/[0.07] my-1" />
                <HostMenuItem onClick={endSession} disabled={busy} destructive icon={<PhoneOff className="w-3.5 h-3.5" />}>
                  End session for all
                </HostMenuItem>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* click-outside */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}

function HostMenuItem({
  onClick,
  children,
  destructive,
  disabled,
  icon,
}: {
  onClick: () => void
  children: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-all duration-100 disabled:opacity-40',
        destructive
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-white/70 hover:bg-white/6 hover:text-white'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ----------------------------------------------------------------------------
// Video grid — full height
// ----------------------------------------------------------------------------
function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  return (
    <GridLayout tracks={tracks} style={{ height: '100%', background: 'transparent' }}>
      <ParticipantTile />
    </GridLayout>
  )
}
