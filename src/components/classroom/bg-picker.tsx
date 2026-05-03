'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type PresetNone  = { id: string; label: string; type: 'none' }
type PresetBlur  = { id: string; label: string; type: 'blur'; strength: number }
type PresetImage = { id: string; label: string; type: 'image'; src: string }
type Preset = PresetNone | PresetBlur | PresetImage

const PRESETS: Preset[] = [
  { id: 'none',         label: 'None',       type: 'none' },
  { id: 'blur-light',   label: 'Soft blur',  type: 'blur', strength: 8  },
  { id: 'blur-strong',  label: 'Heavy blur', type: 'blur', strength: 22 },
  { id: 'studio',       label: 'Studio',     type: 'image', src: '/bg/studio.svg'  },
  { id: 'vaidix',       label: 'Vaidix',     type: 'image', src: '/bg/vaidix.svg'  },
  { id: 'ocean',        label: 'Ocean',      type: 'image', src: '/bg/ocean.svg'   },
  { id: 'space',        label: 'Space',      type: 'image', src: '/bg/space.svg'   },
]

// CSS preview colours for each preset (no network request needed for the picker UI)
const PREVIEW_CLASS: Record<string, string> = {
  none:        'bg-zinc-800 border border-white/10',
  'blur-light': 'bg-zinc-700',
  'blur-strong':'bg-zinc-600',
  studio:      'bg-gradient-to-b from-[#1a1f36] to-[#0d1117]',
  vaidix:      'bg-gradient-to-br from-teal-900 to-zinc-950',
  ocean:       'bg-gradient-to-b from-[#0c2461] to-[#061020]',
  space:       'bg-gradient-to-br from-[#1a0533] to-[#04000f]',
}

export function BgPicker({ onClose }: { onClose: () => void }) {
  const { localParticipant } = useLocalParticipant()
  const [active, setActive]   = useState<string>('none')
  const [applying, setApplying] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const apply = useCallback(async (preset: Preset) => {
    setApplying(preset.id)
    setError(null)
    try {
      const pub   = localParticipant.getTrackPublication(Track.Source.Camera)
      const track = pub?.track
      if (!track) {
        setError('Camera is off — turn it on first')
        return
      }

      if (preset.type === 'none') {
        await track.stopProcessor()
      } else if (preset.type === 'blur') {
        const { BackgroundBlur } = await import('@livekit/track-processors')
        await track.setProcessor(BackgroundBlur(preset.strength))
      } else {
        const { VirtualBackground } = await import('@livekit/track-processors')
        await track.setProcessor(VirtualBackground(preset.src))
      }

      setActive(preset.id)
    } catch (err) {
      console.error('[BgPicker]', err)
      setError('Not supported in this browser')
    } finally {
      setApplying(null)
    }
  }, [localParticipant])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-60 bg-zinc-900/97 backdrop-blur-2xl border border-white/8 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/7">
        <span className="text-xs font-semibold text-white/60 tracking-wide uppercase">
          Background
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/80 p-1 rounded-lg hover:bg-white/8 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-3 gap-2 p-3">
        {PRESETS.map((preset) => {
          const isActive  = active    === preset.id
          const isLoading = applying  === preset.id

          return (
            <button
              key={preset.id}
              onClick={() => apply(preset)}
              disabled={!!applying}
              className={cn(
                'group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all duration-150 disabled:pointer-events-none',
                isActive
                  ? 'bg-teal-500/15 ring-1 ring-teal-500/50'
                  : 'hover:bg-white/5'
              )}
            >
              {/* Swatch */}
              <div
                className={cn(
                  'w-full aspect-video rounded-lg relative overflow-hidden',
                  PREVIEW_CLASS[preset.id] ?? 'bg-zinc-800'
                )}
              >
                {/* Blur visualisation */}
                {preset.type === 'blur' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-6 h-6 rounded-full bg-white/25"
                      style={{
                        filter: `blur(${preset.strength <= 10 ? '2px' : '5px'})`,
                      }}
                    />
                  </div>
                )}

                {/* Spinner overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                )}

                {/* Active tick */}
                {isActive && !isLoading && (
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-teal-400 flex items-center justify-center shadow-md">
                    <Check className="w-2 h-2 text-zinc-900" strokeWidth={3} />
                  </div>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] leading-none transition-colors',
                  isActive
                    ? 'text-teal-400'
                    : 'text-white/40 group-hover:text-white/70'
                )}
              >
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="px-4 pb-3 text-[11px] text-red-400 text-center">{error}</p>
      )}
    </motion.div>
  )
}
