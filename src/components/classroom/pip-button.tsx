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

// Document with the PiP fields surfaced (lib.dom.d.ts already declares
// `pictureInPictureEnabled` as required, but we still need the
// `pictureInPictureElement` + `exitPictureInPicture` properties for
// runtime feature detection in browsers that may not implement them).
// Use intersection rather than `extends Document` so we don't fight
// lib.dom's required typings on the inherited fields.
type DocumentWithPip = Document & {
  pictureInPictureElement?: HTMLVideoElement | null
  exitPictureInPicture?: () => Promise<void>
}

// Chrome/Edge Document Picture-in-Picture API. Lets us pop out arbitrary
// HTML (not just <video>) into a floating mini-window — used as the
// fallback when there's no video to use the standard PiP API on.
interface DocumentPictureInPicture {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>
  window: Window | null
}
interface WindowWithDocPip extends Window {
  documentPictureInPicture?: DocumentPictureInPicture
}

export function PictureInPictureButton({
  sessionId,
  sessionTitle,
  selfDisplayName,
}: {
  sessionId: string
  /// Friendly title to show inside the floating PiP window — falls back
  /// to the LiveKit room name if not provided. Pass `session.title` from
  /// the parent so users see "Chat with Avinash", not the raw room slug.
  sessionTitle?: string
  /// Friendly self-name (DB-authoritative) — replaces the LiveKit
  /// identity CUID in the "Joined as" line.
  selfDisplayName?: string
}) {
  const room = useRoomContext()
  const { emit } = useSessionEvents({ sessionId, filter: ['PIP_TOGGLE'] })
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  /// Transient error message — auto-clears after 3.5s. Used when there's
  /// no video element to pop out (e.g. alone in the room with camera off)
  /// so the click doesn't feel like a silent dead button.
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    setSupported(Boolean((document as DocumentWithPip).pictureInPictureEnabled))
  }, [])

  useEffect(() => {
    if (!err) return
    const t = setTimeout(() => setErr(null), 3500)
    return () => clearTimeout(t)
  }, [err])

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

    // Build a priority list of candidate video tracks: screen-share first
    // (slides are the highest-value content), then a remote camera, then
    // — when the user is alone or no remotes are publishing — fall back
    // to the local camera so the button still does something useful for
    // a self-view popout.
    const remoteTracks = Array.from(room.remoteParticipants.values())
      .flatMap((p) => Array.from(p.trackPublications.values()))
      .filter((pub) => pub.isSubscribed && pub.track)
    const localTracks = Array.from(room.localParticipant.trackPublications.values())
      .filter((pub) => pub.track)

    const screen = remoteTracks.find((t) => t.source === Track.Source.ScreenShare)
    const remoteCam = remoteTracks.find((t) => t.source === Track.Source.Camera)
    const localScreen = localTracks.find((t) => t.source === Track.Source.ScreenShare)
    const localCam = localTracks.find((t) => t.source === Track.Source.Camera)

    const target = screen ?? remoteCam ?? localScreen ?? localCam
    const videoEl = (target?.track?.attachedElements?.[0] ?? null) as HTMLVideoElement | null

    if (!videoEl) {
      // No video to pop out — fall back to Document Picture-in-Picture
      // (Chrome/Edge), which floats a small mini-window with the room's
      // title + leave shortcut even without video. Same affordance Teams
      // and Discord use for "minimize the meeting".
      const win = window as WindowWithDocPip
      const docPip = win.documentPictureInPicture
      if (!docPip) {
        setErr('Picture-in-picture without video needs Chrome or Edge')
        return
      }
      try {
        const pipWin = await docPip.requestWindow({ width: 320, height: 200 })
        // Prefer the human-readable session title (passed in from the
        // parent) over the LiveKit room slug `session-{cuid}`. Same for
        // the display name vs the bare identity CUID.
        const friendlyTitle = (sessionTitle ?? '').trim() || room.name || 'Live class'
        const friendlyName =
          (selfDisplayName ?? '').trim() ||
          room.localParticipant.name ||
          'Participant'
        renderRoomMiniWindow(pipWin, {
          title: friendlyTitle,
          name: friendlyName,
          parent: window,
        })
        // When the PiP window closes (user clicks OS X or our button),
        // reset state and try to bring the main Vaidix tab back to focus
        // so they're not stranded on their desktop. Multiple methods —
        // browser tab-switch is restricted, so this works reliably only
        // if the Vaidix tab was the active tab in its window when PiP
        // opened. See comment in renderRoomMiniWindow for full caveats.
        pipWin.addEventListener('pagehide', () => {
          setActive(false)
          try { window.focus() } catch { /* focus blocked — silent */ }
        }, { once: true })
        setActive(true)
        void emit('PIP_TOGGLE', { details: { enabled: true, mode: 'document' } })
      } catch (e) {
        console.warn('[PiP] documentPictureInPicture failed', e)
        setErr('Could not open picture-in-picture window')
      }
      return
    }
    try {
      await videoEl.requestPictureInPicture()
      setActive(true)
      void emit('PIP_TOGGLE', { details: { enabled: true, mode: 'video' } })
    } catch (e) {
      const name = (e as { name?: string })?.name
      // NotAllowedError fires when the browser blocks it (autoplay policy
      // or permissions). InvalidStateError when the video isn't playing.
      const msg =
        name === 'NotAllowedError' ? 'Browser blocked picture-in-picture' :
        name === 'InvalidStateError' ? 'Video not ready yet — try again in a moment' :
        'Could not start picture-in-picture'
      setErr(msg)
    }
  }, [active, room, emit, sessionTitle, selfDisplayName])

  if (!supported) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title={active ? 'Exit picture-in-picture' : 'Picture-in-picture'}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-150',
          active
            ? 'bg-teal-500/25 text-teal-300 border-teal-500/50'
            : 'bg-white/8 text-white/70 border-white/10 hover:bg-white/14',
        )}
      >
        <PictureInPicture className="w-4 h-4" />
      </button>
      {err && (
        <div
          role="alert"
          className="absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-zinc-900/95 border border-amber-400/40 px-3 py-2 text-[11px] text-amber-100 shadow-xl backdrop-blur-md"
        >
          {err}
        </div>
      )}
    </div>
  )
}

// Renders a minimal "you're in {room}" status view inside a Document
// Picture-in-Picture window. The window inherits no styles from the
// parent document, so we inline the few we need. Stays small (320×200)
// and self-contained — clicking "Return to room" closes the PiP and
// brings the parent tab back to the front.
function renderRoomMiniWindow(
  pipWin: Window,
  ctx: { title: string; name: string; parent: Window },
) {
  const doc = pipWin.document
  doc.title = `${ctx.title} — picture in picture`

  // Inline a tiny stylesheet so the mini-window doesn't render as
  // unstyled HTML. Kept minimal on purpose — corporate, clean.
  const style = doc.createElement('style')
  style.textContent = `
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #0b0b0e;
      color: #fff;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .dot {
      width: 8px; height: 8px; border-radius: 999px; background: #ef4444;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    .live { font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #fca5a5; }
    .title {
      flex: 1; min-width: 0; font-size: 13px; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .body {
      flex: 1; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 6px; padding: 12px;
    }
    .label { font-size: 11px; color: rgba(255,255,255,0.55); }
    .name  { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.92); }
    .footer {
      padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; justify-content: flex-end;
    }
    button.return {
      background: #10b981; color: #fff; border: none;
      padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;
      cursor: pointer;
    }
    button.return:hover { background: #34d399; }
  `
  doc.head.appendChild(style)

  const html = `
    <div class="header">
      <span class="dot"></span>
      <span class="live">LIVE</span>
      <span class="title">${escapeHtml(ctx.title)}</span>
    </div>
    <div class="body">
      <span class="label">Joined as</span>
      <span class="name">${escapeHtml(ctx.name)}</span>
    </div>
    <div class="footer">
      <button class="return" type="button">Return to room</button>
    </div>
  `
  doc.body.innerHTML = html

  // Clicking "Return to room" closes the PiP window and tries to focus
  // the originating browser window so the live room is on screen again.
  //
  // Browser-security caveats (worth knowing — these are NOT bugs):
  //   • `window.focus()` from the PiP child can bring the originating
  //     BROWSER WINDOW to the front, but it cannot switch TABS within
  //     that window. If the user navigated to a different tab while the
  //     PiP was open, they'll need to click the Vaidix tab themselves.
  //   • The OS focus-stealing prevention (esp. Windows) sometimes blocks
  //     even valid focus requests; we make the attempt within the user's
  //     click gesture to maximize the chance the browser honours it.
  //   • Try BOTH `parent` (our closure ref) and `pipWin.opener` (the
  //     spec property) — different browsers/versions surface the focus
  //     target differently.
  doc.querySelector('button.return')?.addEventListener('click', () => {
    // Order matters: focus the parent BEFORE close. After close the
    // script context dies and any focus call is a no-op.
    try { ctx.parent.focus() } catch { /* focus blocked — silent */ }
    try {
      const opener = (pipWin as Window & { opener?: Window | null }).opener
      opener?.focus()
    } catch { /* focus blocked — silent */ }
    pipWin.close()
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
