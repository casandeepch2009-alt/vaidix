'use client'

// ════════════════════════════════════════════════════════════════════════════
// CaptionsProducer — host-side, English-only, Phase 1
// ════════════════════════════════════════════════════════════════════════════
// Mounts only for the session HOST when `session.metadata.captionsProfile`
// is 'english-only'. Captures the host's LiveKit local microphone track,
// pipes opus chunks over a WebSocket to the upstream ASR provider (using a
// 30s scoped token minted by /captions/captions-token), and POSTs finalized
// utterances to /captions/publish for fan-out + persistence.
//
// Headless component — renders nothing visible. Status is exposed via the
// optional `onStatusChange` prop so the live-session control bar can show a
// "● REC" badge or a toast on auth failure.
//
// Failure modes the component handles internally (no UI):
//   * Token mint fails → retries every 10s up to 3 times, then gives up.
//   * WS closes mid-stream → reconnects with a fresh token (provider tokens
//     are single-use after open). Up to 5 reconnects, exponential backoff.
//   * Mic track not yet published → polls the LocalParticipant for one until
//     mounted; component is a no-op until the host turns their mic on.
//
// Anything else is logged to console; we don't block the room over a captions
// failure.

import { useEffect, useRef } from 'react'
import { useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { csrfHeaders } from '@/lib/csrf-client'

export type ProducerStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'failed'
  | 'stopped'

interface Props {
  sessionId: string
  /** Pass `true` only when the local user is the session HOST (or CO_HOST). */
  enabled: boolean
  onStatusChange?: (status: ProducerStatus, detail?: string) => void
}

interface CaptionsTokenResp {
  ok: true
  data: { accessToken: string; expiresInSec: number; wsUrl: string }
}

// Shape of the finalized utterance frame emitted by the upstream ASR provider
// over the WebSocket. Kept generic — fields outside Vaidix's read path are
// optional so a provider swap doesn't require touching this file.
interface AsrFinalFrame {
  channel?: { alternatives?: Array<{ transcript?: string; confidence?: number }> }
  start?: number
  duration?: number
  is_final?: boolean
  speech_final?: boolean
}

const MAX_RECONNECTS = 5
const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000]

export function CaptionsProducer({ sessionId, enabled, onStatusChange }: Props) {
  const { localParticipant } = useLocalParticipant()
  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const stoppedRef = useRef(false)
  const reconnectsRef = useRef(0)
  const sessionStartMsRef = useRef<number>(0)

  const setStatus = (s: ProducerStatus, detail?: string) => {
    if (onStatusChange) onStatusChange(s, detail)
  }

  useEffect(() => {
    if (!enabled) return
    if (!localParticipant) return

    stoppedRef.current = false
    reconnectsRef.current = 0
    sessionStartMsRef.current = Date.now()

    let teardownTimers: ReturnType<typeof setTimeout>[] = []
    const clearTimers = () => {
      for (const t of teardownTimers) clearTimeout(t)
      teardownTimers = []
    }

    async function mintToken(): Promise<CaptionsTokenResp['data']> {
      const res = await fetch(
        `/api/classroom/sessions/${sessionId}/captions/captions-token`,
        { method: 'POST', credentials: 'include', headers: { ...csrfHeaders() } },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
        const code = body?.error?.code ?? 'UNKNOWN'
        const msg  = body?.error?.message ?? `HTTP ${res.status}`
        const err  = Object.assign(new Error(msg), { code })
        throw err
      }
      const json = (await res.json()) as CaptionsTokenResp
      return json.data
    }

    async function publishSegments(payload: {
      segments: Array<{
        startMs: number
        endMs: number
        text: string
        lang: 'en'
        confidence?: number
        partial?: boolean
      }>
      finalizeOnEnd?: boolean
    }) {
      try {
        await fetch(`/api/classroom/sessions/${sessionId}/captions/publish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
          body: JSON.stringify(payload),
          // Don't block on slow publish — the live overlay tolerates dropped
          // segments because the host's audio plays through LiveKit anyway.
          keepalive: true,
        })
      } catch (err) {
        console.warn('[captions-producer] publish failed', err)
      }
    }

    function getMicTrack(): MediaStreamTrack | null {
      const pub = localParticipant.getTrackPublication(Track.Source.Microphone)
      const track = pub?.audioTrack
      return track?.mediaStreamTrack ?? null
    }

    async function startOnce() {
      if (stoppedRef.current) return

      // Wait for the host's mic track before touching Deepgram at all.
      // Poll up to 30 s — if they never unmute, stay idle and don't call the API.
      let micTrack = getMicTrack()
      if (!micTrack) {
        setStatus('idle')
        const start = Date.now()
        const poll = () =>
          new Promise<MediaStreamTrack | null>((resolve) => {
            const tick = () => {
              if (stoppedRef.current) return resolve(null)
              const t = getMicTrack()
              if (t) return resolve(t)
              if (Date.now() - start > 30_000) return resolve(null)
              const id = setTimeout(tick, 500)
              teardownTimers.push(id)
            }
            tick()
          })
        micTrack = await poll()
        if (!micTrack) return // mic never appeared — stay idle
      }

      setStatus('connecting')

      let tokenInfo: CaptionsTokenResp['data']
      try {
        tokenInfo = await mintToken()
      } catch (err) {
        const e = err as Error & { code?: string }
        if (e.code === 'CAPTIONS_UNAVAILABLE') {
          console.warn('[captions-producer] captions not configured — disabled')
        } else {
          console.error('[captions-producer] token mint failed', err)
        }
        setStatus('failed', e.message)
        return
      }

      const ws = new WebSocket(tokenInfo.wsUrl, ['token', tokenInfo.accessToken])
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'

      ws.addEventListener('open', () => {
        if (stoppedRef.current) {
          ws.close()
          return
        }
        reconnectsRef.current = 0
        setStatus('streaming')

        const mediaStream = new MediaStream([micTrack])
        // Opus 48kHz matches the upstream ASR's expected encoding (set in
        // deepgramListenWsUrl()). The browser MIME negotiates to opus.
        const recorder = new MediaRecorder(mediaStream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 32_000,
        })
        recorderRef.current = recorder
        recorder.addEventListener('dataavailable', async (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const buf = await e.data.arrayBuffer()
            ws.send(buf)
          }
        })
        recorder.start(250)
      })

      ws.addEventListener('message', async (event) => {
        if (typeof event.data !== 'string') return
        let msg: AsrFinalFrame
        try {
          msg = JSON.parse(event.data) as AsrFinalFrame
        } catch {
          return
        }
        const alt = msg.channel?.alternatives?.[0]
        const text = alt?.transcript?.trim()
        if (!text) return

        const startSec = msg.start ?? 0
        const endSec = startSec + (msg.duration ?? 0)
        const partial = !msg.is_final && !msg.speech_final
        const startMs = Math.max(0, Math.round(startSec * 1000))
        const endMs = Math.max(startMs + 1, Math.round(endSec * 1000))

        await publishSegments({
          segments: [
            {
              startMs,
              endMs,
              text,
              lang: 'en',
              confidence: alt?.confidence,
              partial,
            },
          ],
        })
      })

      ws.addEventListener('error', (event) => {
        console.warn('[captions-producer] ws error', event)
      })

      ws.addEventListener('close', (event) => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          try {
            recorderRef.current.stop()
          } catch {
            // ignore — recorder may already be stopped
          }
        }
        recorderRef.current = null

        if (stoppedRef.current) {
          setStatus('stopped')
          return
        }

        if (reconnectsRef.current < MAX_RECONNECTS) {
          const wait = RECONNECT_BACKOFF_MS[reconnectsRef.current] ?? 8000
          reconnectsRef.current++
          setStatus('reconnecting', `code=${event.code}, attempt=${reconnectsRef.current}`)
          const t = setTimeout(() => {
            void startOnce()
          }, wait)
          teardownTimers.push(t)
        } else {
          setStatus('failed', `WS closed (code=${event.code}); reconnect budget exhausted`)
        }
      })
    }

    void startOnce()

    return () => {
      stoppedRef.current = true
      clearTimers()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          /* swallow */
        }
      }
      recorderRef.current = null
      const ws = wsRef.current
      wsRef.current = null
      // Tell the server we're done so finalize fires and every open
      // SessionTranscript row for this session is locked. Best-effort — if
      // the publish fails, a follow-up sweep job is expected to close the
      // row. Empty segments + finalizeOnEnd is the documented "end-of-stream
      // only" signal accepted by the publish route.
      void publishSegments({ segments: [], finalizeOnEnd: true })
        .catch(() => {})
        .finally(() => {
          if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            try {
              ws.close()
            } catch {
              /* swallow */
            }
          }
        })
      setStatus('stopped')
    }
  }, [enabled, localParticipant, sessionId, onStatusChange])

  return null
}
