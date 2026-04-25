'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar as LKControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { WaitingRoom } from './waiting-room'
import { PreJoin } from './pre-join'
import { ParticipantSidebar } from './participant-sidebar'
import { ChatPanel } from './chat-panel'
import { FacultyControls } from './faculty-controls'
import { HandRaiseButton } from './hand-raise-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HookOverlay } from '@/components/engagement/hook-overlay'
import { PresenterAlertsHud } from '@/components/engagement/presenter-alerts-hud'
import { LeaderboardPanel } from '@/components/engagement/leaderboard-panel'
import { HooksComposer } from '@/components/engagement/hooks-composer'
import { CoachPanel } from '@/components/engagement/coach-panel'
import { LiveCaptionsOverlay } from '@/components/engagement/live-captions-overlay'

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

  // Waiting-room poll: every 3s check admission; on ADMITTED re-request token
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
    return (
      <LiveRoom
        token={state.token}
        url={state.url}
        role={state.role}
        session={session}
        currentUser={currentUser}
        onLeave={() => router.push('/calendar')}
      />
    )
  }

  if (state.kind === 'WAITING') {
    return <WaitingRoom session={session} onCancel={() => router.push('/calendar')} />
  }

  if (state.kind === 'DENIED') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="rounded-lg border bg-card p-8 text-center max-w-md">
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

  // IDLE / FETCHING / ERROR → pre-join screen
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
// Connected room
// ----------------------------------------------------------------------------
function LiveRoom({
  token,
  url,
  role,
  session,
  currentUser,
  onLeave,
}: {
  token: string
  url: string
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER'
  session: SessionInfo
  currentUser: { id: string; name: string }
  onLeave: () => void
}) {
  const isHostish = role === 'HOST' || role === 'CO_HOST'
  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      data-lk-theme="default"
      onDisconnected={onLeave}
      className="h-[calc(100vh-4rem)]"
    >
      <div className="flex h-full">
        <div className="relative flex-1 min-w-0">
          <VideoGrid />
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-center gap-3">
            {role !== 'VIEWER' && <HandRaiseButton />}
            <LKControlBar
              controls={{
                microphone: role !== 'VIEWER',
                camera: role !== 'VIEWER',
                screenShare: isHostish,
                chat: false, // use our own chat
                leave: true,
              }}
            />
          </div>
          {isHostish && (
            <div className="absolute top-3 right-3">
              <FacultyControls sessionId={session.id} isHost={role === 'HOST'} />
            </div>
          )}
          {/* Stream D #4 — learner-facing live hook prompts. Host hooks appear too;
              the responder POSTs from any role; backend records correctness. */}
          <HookOverlay sessionId={session.id} />
          {/* Stream D #5 — host-only engagement alerts. No-op for learners. */}
          <PresenterAlertsHud sessionId={session.id} isHost={role === 'HOST'} />
          {/* Stream B9 — real-time captions from LiveKit Agent (Python sidecar). */}
          <LiveCaptionsOverlay sessionId={session.id} />
        </div>
        <aside className="w-80 shrink-0 border-l bg-background">
          <Tabs defaultValue="participants" className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b overflow-x-auto">
              <TabsTrigger value="participants">People</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="leaderboard">Board</TabsTrigger>
              {isHostish && <TabsTrigger value="hooks">Hooks</TabsTrigger>}
              {!isHostish && <TabsTrigger value="coach">Coach</TabsTrigger>}
            </TabsList>
            <TabsContent value="participants" className="flex-1 overflow-y-auto p-0 m-0">
              <ParticipantSidebar
                sessionId={session.id}
                canModerate={isHostish}
                currentUserId={currentUser.id}
              />
            </TabsContent>
            <TabsContent value="chat" className="flex-1 overflow-hidden p-0 m-0">
              <ChatPanel sessionId={session.id} currentUser={currentUser} />
            </TabsContent>
            <TabsContent value="leaderboard" className="flex-1 overflow-hidden p-0 m-0">
              <LeaderboardPanel sessionId={session.id} />
            </TabsContent>
            {isHostish && (
              <TabsContent value="hooks" className="flex-1 overflow-hidden p-0 m-0">
                <HooksComposer sessionId={session.id} />
              </TabsContent>
            )}
            {!isHostish && (
              <TabsContent value="coach" className="flex-1 overflow-hidden p-0 m-0">
                <CoachPanel learnerId={currentUser.id} />
              </TabsContent>
            )}
          </Tabs>
        </aside>
      </div>
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100% - 4rem)' }}>
      <ParticipantTile />
    </GridLayout>
  )
}
