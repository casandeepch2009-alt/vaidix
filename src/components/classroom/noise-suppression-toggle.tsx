'use client'

// NoiseSuppressionToggle.
//
// Two-tier noise suppression with automatic upgrade:
//
//   • Tier 1 — `@livekit/krisp-noise-filter` (ML, ~4MB WASM). Strips
//     keyboard typing, dogs, traffic, fans, etc. Loaded lazily so the
//     bundle cost is only paid by users who actually toggle the filter on.
//     **Verified 2026-05-09 via /dev/krisp-probe**: the WASM model loads
//     and `processor.init()` succeeds without any LiveKit Cloud token or
//     Krisp license check — the package is free to use at runtime when
//     installed from npm. The ToS-bound npm license still applies to
//     commercial deployments (review with LiveKit if needed) but there is
//     no technical access gate. Tier 2 stays as a defensive fallback for
//     older browsers / asset-load failures, not for licence rejections.
//
//   • Tier 2 — browser-native `noiseSuppression` + `echoCancellation`
//     constraints applied via `MediaStreamTrack.applyConstraints`. Less
//     aggressive than Krisp but instant + present in every modern browser.
//
// We always TRY Krisp first when the toggle is flipped on; if it fails
// (unsupported browser or asset load error) we silently fall back to
// constraints and remember the failure for the rest of the session so
// we don't keep retrying the WASM load.
//
// Toggling — at either tier — is recorded as a NOISE_SUPPRESSION_TOGGLE
// audit/replay event so the recording viewer can correlate audio quality
// changes with user actions.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalParticipant } from '@livekit/components-react'
import { LocalAudioTrack, Track } from 'livekit-client'
import type { TrackProcessor } from 'livekit-client'
import { Sparkles, SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionEvents } from '@/hooks/use-session-events'

const STORAGE_KEY = 'vaidix.noiseSuppression'
/// Tier label persists across renders so the badge accurately reflects what
/// the audio pipeline is doing right now.
type Tier = 'krisp' | 'browser' | 'off' | 'unsupported'

/**
 * Lazily import + try-attach the Krisp processor. Returns the processor on
 * success, null on failure — callers fall through to the browser tier.
 *
 * Failures we treat as "not supported":
 *   - `isKrispNoiseFilterSupported()` returning false (older Safari, etc.)
 *   - import() throwing (asset cache missed / network blocked)
 *   - `track.setProcessor()` throwing (asset corruption, very old hardware)
 *
 * No licence-gated path — verified empirically that init() succeeds without
 * any LiveKit Cloud token. See /dev/krisp-probe history if questions resurface.
 */
async function tryAttachKrisp(
  track: LocalAudioTrack
): Promise<TrackProcessor<Track.Kind.Audio> | null> {
  try {
    const mod = await import('@livekit/krisp-noise-filter')
    if (!mod.isKrispNoiseFilterSupported()) return null
    // `quality: 'medium'` is the recommended default; lower-spec devices in
    // the LVPEI deployment region may benefit from `low` later but we let
    // Krisp pick its own defaults until we have telemetry.
    const processor = mod.KrispNoiseFilter()
    await track.setProcessor(processor)
    return processor as unknown as TrackProcessor<Track.Kind.Audio>
  } catch (err) {
    console.warn('[NoiseSuppressionToggle] Krisp unavailable, falling back:', err)
    return null
  }
}

export function NoiseSuppressionToggle({ sessionId }: { sessionId: string }) {
  const { localParticipant } = useLocalParticipant()
  const { emit } = useSessionEvents({ sessionId, filter: ['NOISE_SUPPRESSION_TOGGLE'] })

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(STORAGE_KEY) !== 'false'
  })
  const [tier, setTier] = useState<Tier>('off')
  const [busy, setBusy] = useState(false)
  /// Once Krisp has refused to load in this session we don't retry it on
  /// every toggle — that would mean re-fetching ~4MB on each click.
  const krispBlockedRef = useRef(false)

  const apply = useCallback(
    async (next: boolean) => {
      setBusy(true)
      try {
        const pub = localParticipant.getTrackPublication(Track.Source.Microphone)
        const track = pub?.track
        if (!(track instanceof LocalAudioTrack)) {
          // Mic isn't published yet — store preference, will apply on next publish.
          setEnabled(next)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false')
          }
          return
        }
        const mediaTrack = track.mediaStreamTrack

        if (!next) {
          // OFF: drop any Krisp processor + clear constraints.
          try {
            await track.stopProcessor()
          } catch {/* no processor attached, ignore */}
          try {
            await mediaTrack.applyConstraints({
              noiseSuppression: false,
              echoCancellation: false,
            })
          } catch {/* some browsers refuse — ignore, the UI still shows OFF */}
          setEnabled(false)
          setTier('off')
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, 'false')
          }
          void emit('NOISE_SUPPRESSION_TOGGLE', { details: { enabled: false, tier: 'off' } })
          return
        }

        // ON: try Krisp first, fall back to constraints.
        let landedTier: Tier = 'browser'
        if (!krispBlockedRef.current) {
          const krisp = await tryAttachKrisp(track)
          if (krisp) {
            landedTier = 'krisp'
          } else {
            krispBlockedRef.current = true
          }
        }

        if (landedTier === 'browser') {
          const caps = mediaTrack.getCapabilities?.()
          if (!caps || !('noiseSuppression' in caps)) {
            setTier('unsupported')
            return
          }
          await mediaTrack.applyConstraints({
            noiseSuppression: true,
            echoCancellation: true,
          })
        }

        setEnabled(true)
        setTier(landedTier)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, 'true')
        }
        void emit('NOISE_SUPPRESSION_TOGGLE', {
          details: { enabled: true, tier: landedTier },
        })
      } finally {
        setBusy(false)
      }
    },
    [localParticipant, emit]
  )

  // On first mic publish, sync the stored preference. Krisp is opt-in via
  // the toggle, so the initial publish only restores constraints — flipping
  // the toggle ON afterwards is what triggers the WASM load.
  useEffect(() => {
    const handler = () => {
      void apply(enabled)
    }
    localParticipant.on('localTrackPublished' as never, handler)
    return () => {
      localParticipant.off('localTrackPublished' as never, handler)
    }
  }, [localParticipant, apply, enabled])

  const unsupported = tier === 'unsupported'
  const tierLabel =
    tier === 'krisp' ? 'AI' : tier === 'browser' ? 'ON' : tier === 'off' ? 'OFF' : 'N/A'
  const tierDescription =
    tier === 'krisp'
      ? 'AI noise filter (Krisp)'
      : tier === 'browser'
        ? 'Browser noise suppression'
        : tier === 'off'
          ? 'Raw audio — no filtering'
          : 'Not supported in this browser'

  return (
    <button
      type="button"
      disabled={busy || unsupported}
      onClick={() => apply(!enabled)}
      title={
        unsupported
          ? 'Noise suppression not available in this browser'
          : enabled
            ? `Disable noise suppression (${tierDescription.toLowerCase()})`
            : `Enable noise suppression`
      }
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
        unsupported && 'opacity-40 cursor-not-allowed',
        !unsupported && enabled && tier === 'krisp'
          ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40'
          : !unsupported && enabled
            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
            : 'bg-white/8 text-white/70 border border-white/10 hover:bg-white/12'
      )}
    >
      {enabled ? <SparklesIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 opacity-50" />}
      Noise reduction
      <span
        className={cn(
          'ml-0.5 text-[10px] font-bold tracking-wider',
          tier === 'krisp'
            ? 'text-fuchsia-200'
            : enabled
              ? 'text-teal-300'
              : 'text-white/50'
        )}
      >
        {tierLabel}
      </span>
    </button>
  )
}
