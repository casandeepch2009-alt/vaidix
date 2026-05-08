'use client'

// Custom ParticipantTile wrapper that adds a host-only spotlight star button
// in the top-right corner of each tile. Tldraw's spotlight model is
// "exactly one participant focused at a time" so clicking the star toggles
// between SET (this participant) and CLEAR. We don't render the button at
// all for non-host viewers, keeping their tile chrome minimal.

import { ParticipantTile, useEnsureTrackRef } from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpotlightTileProps {
  isHostish: boolean
  spotlightedIdentity: string | null
  onToggleSpotlight: (identity: string | null) => void
  trackRef?: TrackReferenceOrPlaceholder
}

/**
 * Drop-in replacement for LiveKit's `<ParticipantTile />` that adds a
 * spotlight toggle. Pass it as the child of `<GridLayout>` instead of the
 * stock tile.
 */
export function SpotlightTile({
  isHostish,
  spotlightedIdentity,
  onToggleSpotlight,
  trackRef: trackRefProp,
}: SpotlightTileProps) {
  // GridLayout calls the child with a track ref via context — useEnsureTrackRef
  // resolves either the explicit prop or the contextual one.
  const trackRef = useEnsureTrackRef(trackRefProp)
  const identity = trackRef.participant.identity
  const isSpotlit = spotlightedIdentity === identity

  return (
    <div className="relative h-full w-full">
      <ParticipantTile trackRef={trackRef} />
      {isHostish && (
        <button
          type="button"
          onClick={() => onToggleSpotlight(isSpotlit ? null : identity)}
          title={isSpotlit ? 'Remove spotlight' : `Spotlight ${trackRef.participant.name ?? identity}`}
          className={cn(
            'absolute top-2 right-2 z-20 rounded-full p-1.5 backdrop-blur-md border transition-all duration-150',
            isSpotlit
              ? 'bg-amber-400/85 text-zinc-900 border-amber-300 shadow-md shadow-amber-500/40'
              : 'bg-black/45 text-white/85 border-white/10 hover:bg-black/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          )}
        >
          {isSpotlit ? <X className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

