'use client'

// ════════════════════════════════════════════════════════════════════════════
// RecordingViewer — YouTube-style recording page
// ════════════════════════════════════════════════════════════════════════════
// Layout (desktop):  [video + meta + tabs (Pearls | Transcript)]  [Q&A panel]
// Layout (mobile):   [video] [meta] [Discussion | Pearls | Transcript] tabs

import { useRef, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RecordingPlayer } from './recording-player'
import { QaSidebar } from '@/components/classroom/qa-sidebar'
import { SessionPearlsTab, type SessionPearl } from './session-pearls-tab'
import { TranscriptTab } from './transcript-tab'
import {
  ThumbsUp, Bookmark, Share2, Gem, BookOpen, MessageSquare,
  User, Calendar, Clock, Captions, X, Copy, Check, Lock, Loader2, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toggleRecordingBookmarkAction, createRecordingShareAction } from '@/app/(platform)/classroom/[id]/recording/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaptionTrack {
  language: string
  source: string
  vttUrl: string | null
}

interface Props {
  sessionId: string
  sessionTitle: string
  hostName: string | null
  scheduledStart: Date | string
  durationSec?: number | null

  hlsUrl: string
  posterUrl?: string | null
  tracks: CaptionTrack[]

  currentUser: { id: string; role: string }
  canPin: boolean
  canAnswer: boolean

  recordingId: string
  initialBookmarked: boolean
  canShare: boolean

  pearls: SessionPearl[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'EN', hi: 'हि', te: 'తె', ta: 'த', kn: 'ಕ', ml: 'മ', mr: 'म', bn: 'বা', ur: 'اردو',
}

const TABS = [
  { id: 'pearls', label: 'Pearls', icon: Gem },
  { id: 'transcript', label: 'Transcript', icon: BookOpen },
  { id: 'discussion', label: 'Discussion', icon: MessageSquare },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecordingViewer({
  sessionId, sessionTitle, hostName, scheduledStart, durationSec,
  hlsUrl, posterUrl, tracks,
  currentUser, canPin, canAnswer,
  recordingId, initialBookmarked, canShare,
  pearls,
}: Props) {
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const seekRef = useRef<((sec: number) => void) | null>(null)

  // Caption lang lives here so the action bar can control it
  const [activeLang, setActiveLang] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('vaidix.captionLang')
      if (stored && tracks.some((t) => t.language === stored)) return stored
    }
    return tracks.find((t) => t.language === 'en')?.language ?? tracks[0]?.language ?? 'off'
  })

  const [activeTab, setActiveTab] = useState<TabId>('pearls')
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [liked, setLiked] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLangChange(lang: string) {
    setActiveLang(lang)
    if (typeof window !== 'undefined') {
      if (lang === 'off') window.localStorage.removeItem('vaidix.captionLang')
      else window.localStorage.setItem('vaidix.captionLang', lang)
    }
  }

  function handleBookmark() {
    const prev = bookmarked
    setBookmarked(!prev)
    startTransition(async () => {
      try {
        const r = await toggleRecordingBookmarkAction(recordingId)
        setBookmarked(r.bookmarked)
      } catch {
        setBookmarked(prev)
      }
    })
  }

  const hasTracks = tracks.length > 0

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
        {/* ════════ Left column ════════ */}
        <div className="min-w-0 space-y-4">

          {/* Video */}
          <RecordingPlayer
            hlsUrl={hlsUrl}
            posterUrl={posterUrl}
            tracks={tracks}
            onTimeUpdate={setCurrentTimeSec}
            seekRef={seekRef}
            activeLang={activeLang}
          />

          {/* Caption language row */}
          {hasTracks && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Captions className="size-3.5" />
                CC
              </span>
              <button
                onClick={() => handleLangChange('off')}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                  activeLang === 'off'
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                Off
              </button>
              {tracks.map((t) => (
                <button
                  key={t.language}
                  disabled={!t.vttUrl}
                  onClick={() => handleLangChange(t.language)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all disabled:opacity-40',
                    activeLang === t.language
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  {LANGUAGE_LABEL[t.language] ?? t.language.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Title + metadata */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold leading-tight tracking-tight">{sessionTitle}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
              {hostName && (
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {hostName}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatDate(scheduledStart)}
              </span>
              {durationSec != null && durationSec > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {formatDuration(durationSec)}
                </span>
              )}
            </div>
          </div>

          {/* ─── Action bar ─── */}
          <div className="flex flex-wrap items-center gap-2 border-y border-border/70 py-3">
            {/* Like */}
            <motion.button
              onClick={() => setLiked((v) => !v)}
              whileTap={{ scale: 0.93 }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all',
                liked
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <ThumbsUp className={cn('size-4 transition-transform', liked && 'fill-current -rotate-6')} />
              Helpful
            </motion.button>

            {/* Save / bookmark */}
            <motion.button
              onClick={handleBookmark}
              disabled={isPending}
              whileTap={{ scale: 0.93 }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all',
                bookmarked
                  ? 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <Bookmark className={cn('size-4', bookmarked && 'fill-current')} />
              {bookmarked ? 'Saved' : 'Save'}
            </motion.button>

            {/* Share */}
            {canShare && (
              <motion.button
                onClick={() => setShareOpen(true)}
                whileTap={{ scale: 0.93 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground"
              >
                <Share2 className="size-4" />
                Share
              </motion.button>
            )}
          </div>

          {/* ─── Tab bar ─── */}
          <div>
            <div className="flex items-center border-b border-border/60">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-4 pb-3 pt-1 text-sm font-semibold transition-colors',
                    // Discussion tab hidden on desktop (Q&A lives in right panel)
                    tab.id === 'discussion' && 'xl:hidden',
                    activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground/70'
                  )}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                  {tab.id === 'pearls' && pearls.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {pearls.length}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="pt-4"
              >
                {activeTab === 'pearls' && <SessionPearlsTab pearls={pearls} />}

                {activeTab === 'transcript' && (
                  <TranscriptTab
                    tracks={tracks}
                    currentTimeSec={currentTimeSec}
                    onSeek={(sec) => seekRef.current?.(sec)}
                  />
                )}

                {/* Discussion tab — mobile only */}
                {activeTab === 'discussion' && (
                  <div className="h-[60vh] min-h-100 xl:hidden">
                    <QaSidebar
                      sessionId={sessionId}
                      currentUser={currentUser}
                      currentTimeSec={currentTimeSec}
                      onSeek={(sec) => seekRef.current?.(sec)}
                      canPin={canPin}
                      canAnswer={canAnswer}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ════════ Right column — Q&A (desktop only) ════════ */}
        <aside className="hidden xl:flex xl:flex-col">
          <div className="sticky top-4 flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Panel header */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="size-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Live Discussion</p>
                <p className="text-[10px] text-muted-foreground">Ask questions · Timestamped to playhead</p>
              </div>
            </div>
            {/* Q&A sidebar fills the rest */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <QaSidebar
                sessionId={sessionId}
                currentUser={currentUser}
                currentTimeSec={currentTimeSec}
                onSeek={(sec) => seekRef.current?.(sec)}
                canPin={canPin}
                canAnswer={canAnswer}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Share modal ─── */}
      <AnimatePresence>
        {shareOpen && (
          <ShareModal
            recordingId={recordingId}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Share modal (self-contained) ────────────────────────────────────────────

function ShareModal({ recordingId, onClose }: { recordingId: string; onClose: () => void }) {
  const [ttlDays, setTtlDays] = useState(7)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const result = await createRecordingShareAction({
        recordingId,
        ttlDays,
        password: usePassword && password.trim() ? password.trim() : undefined,
      })
      setLink(`${window.location.origin}/recordings/share/${result.token}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Share2 className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Share recording</p>
              <p className="text-[11px] text-muted-foreground">Audited link — read-only access</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {!link ? (
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Link expires in</p>
              <div className="flex flex-wrap gap-2">
                {[1, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTtlDays(d)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      ttlDays === d
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {d === 1 ? '1 day' : `${d} days`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <Lock className="size-3.5 text-muted-foreground" />
                Password protect
              </label>
              <AnimatePresence>
                {usePassword && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <Input
                      type="password"
                      placeholder="Set a password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-2"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={creating}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || (usePassword && password.trim().length < 6)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {creating ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Creating…</> : 'Create link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <p className="text-xs text-muted-foreground">
              Copy this link — shown once, not stored in plaintext.
            </p>
            <div className="flex items-center gap-2">
              <Input value={link} readOnly className="font-mono text-xs" />
              <Button size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Open link <ExternalLink className="size-3" />
            </a>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
