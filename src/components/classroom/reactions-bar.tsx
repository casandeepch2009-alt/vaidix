'use client'

// ReactionsBar + FloatingReactionsLayer.
//
// The bar is a small popover triggered from the live-session control bar.
// Picking an emoji emits a REACTION event via useSessionEvents (DC + REST).
// FloatingReactionsLayer subscribes to the same hook, filters to REACTION
// events, and renders each as a short-lived animated bubble that drifts
// upward — same idiom Teams/Zoom use for reactions during a call.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SmilePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionEvents, type SessionEvent } from '@/hooks/use-session-events'

const REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '🎉', label: 'Tada' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '🙌', label: 'Raise hands' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💡', label: 'Idea' },
] as const

export function ReactionsBar({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const { emit } = useSessionEvents({ sessionId, filter: ['REACTION'] })

  function pick(emoji: string) {
    void emit('REACTION', { details: { emoji } })
    setOpen(false)
  }

  return (
    <div className="relative flex flex-col items-center gap-1.5 group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="React"
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group-active:scale-95',
          open
            ? 'bg-amber-500/20 text-amber-300 shadow-[0_0_0_1.5px_theme(colors.amber.500/0.4)]'
            : 'bg-white/10 text-white/90 hover:bg-white/18'
        )}
      >
        <SmilePlus className="w-5 h-5" />
      </button>
      <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors leading-none">
        React
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-zinc-900/97 backdrop-blur-2xl border border-white/8 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/7 gap-2">
              <span className="text-[10px] font-semibold text-white/60 tracking-wide uppercase">
                React
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 hover:text-white/80 p-1 rounded-md hover:bg-white/8 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-2">
              {REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => pick(r.emoji)}
                  title={r.label}
                  className="w-10 h-10 text-xl rounded-xl hover:bg-white/8 active:scale-90 transition-all duration-150 flex items-center justify-center"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Floating overlay ────────────────────────────────────────────────────────
// Renders incoming REACTION events as bubbles that drift upward and fade.
// Each bubble is keyed by the event id so multiple simultaneous reactions
// animate independently. The layer is pointer-events-none so it never blocks
// clicks on the underlying video tiles.

interface FloatingBubble {
  id: string
  emoji: string
  /// Horizontal launch position, 0–1 fraction of layer width. Random per
  /// bubble so multiple reactions don't pile on the same vertical line.
  x: number
}

const BUBBLE_TTL_MS = 3500

export function FloatingReactionsLayer({ sessionId }: { sessionId: string }) {
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([])

  const onEvent = (e: SessionEvent) => {
    if (e.eventType !== 'REACTION') return
    const emoji = (e.details as { emoji?: string } | null)?.emoji
    if (!emoji) return
    const bubble: FloatingBubble = {
      id: e.id,
      emoji,
      x: 0.18 + Math.random() * 0.64,
    }
    setBubbles((prev) => [...prev, bubble])
    window.setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== bubble.id))
    }, BUBBLE_TTL_MS)
  }

  useSessionEvents({ sessionId, filter: ['REACTION'], onEvent })

  return (
    <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
      <AnimatePresence>
        {bubbles.map((b) => (
          <motion.div
            key={b.id}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: -340, opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 0.9] }}
            exit={{ opacity: 0 }}
            transition={{ duration: BUBBLE_TTL_MS / 1000, ease: 'easeOut' }}
            style={{ left: `${b.x * 100}%`, bottom: '20%' }}
            className="absolute text-4xl select-none"
          >
            {b.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
