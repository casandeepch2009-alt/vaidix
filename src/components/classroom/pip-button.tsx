'use client'

// Picture-in-Picture button.
//
// We use the spec'd document-PiP path (HTMLVideoElement.requestPictureInPicture)
// applied to the LiveKit-rendered video element of the spotlit-or-first
// participant. When PiP is open the user can move/resize a small window with
// the speaker outside the browser tab — the same UX as Teams PiP.
//
// `documentPictureInPicture` (Document Picture-in-Picture API) is more
// powerful (lets us pop out the entire UI), but it's still Chrome-only and
// gated behind permission. For Phase 1 we ship the universal video-element
// PiP. The full pop-out comes via PopOutWindowButton below.

import { useCallback, useEffect, useState } from 'react'
import { PictureInPicture } from 'lucide-react'
import { useRoomContext } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useSessionEvents } from '@/hooks/use-session-events'
import { cn } from '@/lib/utils'

interface DocumentWithPip extends Document {
  pictureInPictureEnabled?: boolean
  pictureInPictureElement?: HTMLVideoElement | null
  exitPictureInPicture?: () => Promise<void>
}

export function PictureInPictureButton({ sessionId }: { sessionId: string }) {
  const room = useRoomContext()
  const { emit } = useSessionEvents({ sessionId, filter: ['PIP_TOGGLE'] })
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    setSupported(Boolean((document as DocumentWithPip).pictureInPictureEnabled))
  }, [])

  // Track exit-by-OS-button so our state doesn't go stale.
  useEffect(() => {
    function onLeave() {
      setActive(false)
    }
    document.addEventListener('leavepictureinpicture', onLeave)
    return () => document.removeEventListener('leavepictureinpicture', onLeave)
  }, [])

  const toggle = useCallback(async () => {
    const doc = document as DocumentWithPip
    if (active) {
      try {
        await doc.exitPictureInPicture?.()
      } finally {
        setActive(false)
        void emit('PIP_TOGGLE', { details: { enabled: false } })
      }
      return
    }
    // Pick a target video element: prefer screen-share, then any remote camera.
    const tracks = Array.from(room.remoteParticipants.values())
      .flatMap((p) => Array.from(p.trackPublications.values()))
      .filter((pub) => pub.isSubscribed && pub.track)
    const screen = tracks.find((t) => t.source === Track.Source.ScreenShare)
    const camera = tracks.find((t) => t.source === Track.Source.Camera)
    const target = screen ?? camera
    const videoEl = (target?.track?.attachedElements?.[0] ?? null) as HTMLVideoElement | null
    if (!videoEl) {
      console.warn('[PiP] no remote video element to attach')
      return
    }
    try {
      await videoEl.requestPictureInPicture()
      setActive(true)
      void emit('PIP_TOGGLE', { details: { enabled: true } })
    } catch (err) {
      console.warn('[PiP] failed', err)
    }
  }, [active, room, emit])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      title={active ? 'Exit picture-in-picture' : 'Picture-in-picture'}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-150',
        active
          ? 'bg-teal-500/25 text-teal-300 border-teal-500/50'
          : 'bg-white/8 text-white/70 border-white/10 hover:bg-white/14'
      )}
    >
      <PictureInPicture className="w-4 h-4" />
    </button>
  )
}
