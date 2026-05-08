'use client'

// useSessionEvents — emit + receive replay-able session events.
//
// Live propagation rides the LiveKit data channel (topic 'events'). DB
// persistence is handled by POSTing to /api/classroom/sessions/[id]/events,
// which writes a SessionAuditEvent row with a server-assigned tMs offset.
//
// We deliberately fire the DC publish before awaiting the REST POST: live
// reactions need to land on screens within ~50ms; persistence is best-effort
// (rate-limited fail-open) and the recording viewer reads from the audit log
// only — never from the live data channel. So a dropped POST means a missing
// replay row, not a broken live experience.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'

const DC_TOPIC = 'events'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface SessionEvent {
  /// Stable ID for de-duping. For locally-emitted events we mint a temporary
  /// 'tmp-…' ID; the server's id is not echoed back in the live stream so
  /// late-joiner replay (REST GET) is the only place full audit IDs surface.
  id: string
  eventType: string
  actorId: string | null
  actorName?: string | null
  targetUserId: string | null
  details: Record<string, unknown> | null
  /// Wall-clock when the event was emitted on the client. Server-side tMs
  /// (offset from recording start) is computed by the persistence endpoint
  /// and not echoed on the live channel.
  emittedAt: number
}

interface UseSessionEventsOptions {
  sessionId: string
  /// Filter incoming events by type. When omitted, all replayable types
  /// surface. Useful for dedicated overlays (e.g. FloatingReactionsLayer
  /// only cares about REACTION).
  filter?: string[] | ((e: SessionEvent) => boolean)
  /// Per-event consumer callback. Called for both local-echo and remote events.
  onEvent?: (event: SessionEvent) => void
}

export function useSessionEvents({ sessionId, filter, onEvent }: UseSessionEventsOptions) {
  const { localParticipant } = useLocalParticipant()
  const { message } = useDataChannel(DC_TOPIC)
  const [events, setEvents] = useState<SessionEvent[]>([])

  // Refs hold the latest filter / onEvent without re-binding the data-channel
  // effect every render. Sync them through a useEffect (rather than mutating
  // during render) — the prior values are still good for one extra paint and
  // event delivery is not render-critical.
  const filterRef = useRef(filter)
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    filterRef.current = filter
  }, [filter])
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const matches = useCallback((e: SessionEvent): boolean => {
    const f = filterRef.current
    if (!f) return true
    if (typeof f === 'function') return f(e)
    return f.includes(e.eventType)
  }, [])

  useEffect(() => {
    if (!message) return
    try {
      const parsed = JSON.parse(decoder.decode(message.payload)) as SessionEvent
      if (!matches(parsed)) return
      // The lint rule prefers setState inside subscription callbacks rather
      // than effect bodies. Here `useDataChannel` *is* the subscription —
      // its `message` value flips when a new packet arrives — so updating
      // local state in response is the intended pattern, not a cascading
      // render. (See React's "Subscribing to an external store" example.)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvents((prev) => [...prev.slice(-499), parsed])
      onEventRef.current?.(parsed)
    } catch {
      /* malformed event, ignore */
    }
  }, [message, matches])

  const emit = useCallback(
    async (
      eventType: string,
      args: {
        targetUserId?: string | null
        details?: Record<string, unknown>
      } = {}
    ) => {
      const event: SessionEvent = {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        actorId: localParticipant.identity ?? null,
        actorName: localParticipant.name ?? null,
        targetUserId: args.targetUserId ?? null,
        details: args.details ?? null,
        emittedAt: Date.now(),
      }
      // Local echo first — keeps your own reaction visible even if the DC
      // round-trips slowly or the network blips on send.
      if (matches(event)) {
        setEvents((prev) => [...prev.slice(-499), event])
        onEventRef.current?.(event)
      }
      // Live broadcast.
      void localParticipant
        .publishData(encoder.encode(JSON.stringify(event)), { topic: DC_TOPIC, reliable: false })
        .catch(() => { /* DC not connected yet — drop */ })
      // Persistence (best-effort).
      void fetch(`/api/classroom/sessions/${sessionId}/events`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          targetUserId: args.targetUserId ?? undefined,
          details: args.details ?? undefined,
        }),
      }).catch(() => { /* swallow — DC already delivered live */ })
    },
    [localParticipant, sessionId, matches]
  )

  return { events, emit }
}
