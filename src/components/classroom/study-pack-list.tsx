'use client'

// ════════════════════════════════════════════════════════════════════════════
// Study Pack List — interactive resident view (W6.8)
// ════════════════════════════════════════════════════════════════════════════
// Renders the 3 pre-session prep sections + handles:
//   - Marking a reading viewed (POST /study-pack/views with documentLinkId)
//   - Recording a video as watched (POST /study-pack/views on <video onEnded>)
//   - Starting a pre-case (POST /pre-cases/[id]/start → router.push /cases/[caseId])
//
// State: optimistic updates so the ✓ flips instantly; on failure we revert
// and toast the error. View records are idempotent on the server side
// (multiple POSTs just write multiple rows; the de-dupe lives in the
// readiness aggregator).

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Video, BookOpen, CheckCircle2, ExternalLink, Play, Loader2,
  Sparkles, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface StudyPackItem {
  kind: 'reading' | 'video'
  linkId: string
  documentId: string
  title: string
  description: string | null
  mimeType: string
  rank: number | null
  signedUrl: string
  viewedByMe: boolean
  viewedAt: string | null
  durationSec: number | null
}

interface PreCaseItem {
  preCaseId: string
  caseTemplateId: string
  title: string
  condition: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  bloomsLevel: number
  estimatedMinutes: number
  rank: number
  required: boolean
  myCaseId: string | null
  myCaseStatus: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED' | null
  myConversationStatus: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | null
}

interface StudyPackResponse {
  sessionId: string
  readings: StudyPackItem[]
  videos: StudyPackItem[]
  preCases: PreCaseItem[]
}

interface ApiOk<T> { ok: true; data: T }
interface ApiErr { ok: false; error: { code: string; message: string } }

async function getCsrf(): Promise<string> {
  // The CSRF cookie is set by api-helpers.ensureCsrfCookie; we read it client-
  // side and echo into the x-csrf-token header for mutating requests.
  const m = document.cookie.match(/(?:^|;\s*)vaidix-csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.method && init.method !== 'GET' && init.method !== 'HEAD') {
    if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
    headers.set('x-csrf-token', await getCsrf())
  }
  const res = await fetch(input, { ...init, headers })
  const json = (await res.json()) as ApiOk<T> | ApiErr
  if (!res.ok || !json.ok) {
    const msg = !json.ok ? json.error.message : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json.data
}

export function StudyPackList({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [data, setData] = useState<StudyPackResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await jsonFetch<StudyPackResponse>(
        `/api/classroom/sessions/${sessionId}/study-pack`
      )
      setData(d)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const recordView = useCallback(
    async (kind: 'reading' | 'video', linkId: string, completed = false, durationSec?: number) => {
      // Optimistic flip — set viewedByMe immediately, revert on failure.
      setData((prev) => {
        if (!prev) return prev
        const apply = (arr: StudyPackItem[]) =>
          arr.map((it) => (it.linkId === linkId ? { ...it, viewedByMe: true } : it))
        return {
          ...prev,
          readings: apply(prev.readings),
          videos: apply(prev.videos),
        }
      })
      try {
        await jsonFetch(`/api/classroom/sessions/${sessionId}/study-pack/views`, {
          method: 'POST',
          body: JSON.stringify({ documentLinkId: linkId, completed, durationSec }),
        })
      } catch (e) {
        toast.error(`Could not record view: ${(e as Error).message}`)
        await refresh()
      }
    },
    [sessionId, refresh]
  )

  const startPreCase = useCallback(
    async (preCaseId: string) => {
      setBusyId(preCaseId)
      try {
        const result = await jsonFetch<{ caseId: string; conversationId: string; reused: boolean }>(
          `/api/classroom/sessions/${sessionId}/pre-cases/${preCaseId}/start`,
          { method: 'POST', body: '{}' }
        )
        // Also drop a /views row so the resident's "started" signal lands in
        // the same surface — readiness picks it up either way.
        await jsonFetch(`/api/classroom/sessions/${sessionId}/study-pack/views`, {
          method: 'POST',
          body: JSON.stringify({ preCaseId }),
        }).catch(() => {})
        router.push(`/cases/${result.caseId}`)
      } catch (e) {
        toast.error(`Could not start case: ${(e as Error).message}`)
      } finally {
        setBusyId(null)
      }
    },
    [sessionId, router]
  )

  const totals = useMemo(() => {
    if (!data) return { readings: 0, videos: 0, preCases: 0, done: 0, totalDone: 0 }
    const totalDone =
      data.readings.filter((r) => r.viewedByMe).length +
      data.videos.filter((v) => v.viewedByMe).length +
      data.preCases.filter((c) => c.myCaseStatus === 'COMPLETED').length
    const total = data.readings.length + data.videos.length + data.preCases.length
    return {
      readings: data.readings.length,
      videos: data.videos.length,
      preCases: data.preCases.length,
      done: totalDone,
      totalDone: total,
    }
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading study pack…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertCircle className="size-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Couldn&apos;t load study pack</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const empty =
    data.readings.length === 0 && data.videos.length === 0 && data.preCases.length === 0
  if (empty) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No prep materials yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            The session host hasn&apos;t added pre-readings, videos, or pre-cases yet. Check back closer to the session date.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress chip */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Prep progress</span>
        <Badge variant="secondary" className="font-mono">
          {totals.done} / {totals.totalDone}
        </Badge>
      </div>

      {/* Readings */}
      {data.readings.length > 0 && (
        <Section
          icon={BookOpen}
          title="Pre-readings"
          subtitle="Open each one — your progress is tracked automatically"
          accent="bg-blue-500/10 text-blue-600"
        >
          <ul className="space-y-2">
            {data.readings.map((r) => (
              <li key={r.linkId}>
                <a
                  href={r.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void recordView('reading', r.linkId, true)}
                  className="group flex items-start gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  data-testid={`study-pack-reading-${r.linkId}`}
                >
                  <FileText className="size-5 shrink-0 text-blue-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      {r.viewedByMe ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 shrink-0" data-testid="viewed-check">
                          <CheckCircle2 className="size-3.5" /> Viewed
                        </span>
                      ) : (
                        <ExternalLink className="size-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Videos */}
      {data.videos.length > 0 && (
        <Section
          icon={Video}
          title="Pre-watch videos"
          subtitle="Watch in the player below — a tap on Mark as watched also counts"
          accent="bg-rose-500/10 text-rose-600"
        >
          <ul className="space-y-3">
            {data.videos.map((v) => (
              <li key={v.linkId} className="rounded-lg border bg-card overflow-hidden" data-testid={`study-pack-video-${v.linkId}`}>
                <video
                  controls
                  preload="metadata"
                  className="w-full bg-black"
                  src={v.signedUrl}
                  onEnded={() => void recordView('video', v.linkId, true)}
                />
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">{v.title}</p>
                    {v.viewedByMe ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600" data-testid="viewed-check">
                        <CheckCircle2 className="size-3.5" /> Watched
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void recordView('video', v.linkId, true)}
                      >
                        Mark as watched
                      </Button>
                    )}
                  </div>
                  {v.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Pre-cases */}
      {data.preCases.length > 0 && (
        <Section
          icon={Sparkles}
          title="Pre-cases"
          subtitle="Work through these vignettes before the session — clinical reasoning practice"
          accent="bg-amber-500/10 text-amber-600"
        >
          <ul className="space-y-2">
            {data.preCases.map((c) => {
              const completed = c.myCaseStatus === 'COMPLETED'
              const inProgress = c.myCaseStatus === 'ACTIVE'
              return (
                <li
                  key={c.preCaseId}
                  className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
                  data-testid={`study-pack-precase-${c.preCaseId}`}
                >
                  <div className="size-9 shrink-0 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="font-medium text-sm">{c.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.required && (
                          <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {c.difficulty.toLowerCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          ~{c.estimatedMinutes} min
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.condition}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {completed
                          ? '✅ Completed'
                          : inProgress
                            ? 'In progress'
                            : 'Not started'}
                      </span>
                      <Button
                        size="sm"
                        variant={completed ? 'outline' : 'default'}
                        disabled={busyId === c.preCaseId}
                        onClick={() => void startPreCase(c.preCaseId)}
                        data-testid={`study-pack-precase-start-${c.preCaseId}`}
                      >
                        {busyId === c.preCaseId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        {completed ? 'Review' : inProgress ? 'Resume' : 'Start'}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start gap-2">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${accent}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
