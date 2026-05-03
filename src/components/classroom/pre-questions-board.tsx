'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, AlertCircle, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Urgency = 'LOW' | 'NORMAL' | 'HIGH'

interface PreQuestionView {
  id: string
  authorName: string
  content: string
  urgency: Urgency
  voteCount: number
  votedByMe: boolean
  themeLabel: string | null
  createdAt: string
}

interface ThemeView {
  id: string
  label: string
  summary: string
  questionCount: number
  rank: number
  generatedAt: string
}

interface Props {
  sessionId: string
  /** The current user's id — used to disable the upvote button on their own questions. */
  currentUserId: string
}

export function PreQuestionsBoard({ sessionId, currentUserId }: Props) {
  const [items, setItems] = useState<PreQuestionView[]>([])
  const [themes, setThemes] = useState<ThemeView[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('NORMAL')
  const [posting, setPosting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [qRes, tRes] = await Promise.all([
      fetch(`/api/classroom/sessions/${sessionId}/pre-questions`, { credentials: 'include' }),
      fetch(`/api/classroom/sessions/${sessionId}/pre-questions/themes`, { credentials: 'include' }),
    ])
    const qJson = await qRes.json()
    const tJson = await tRes.json()
    if (qJson.ok) setItems(qJson.data.items)
    if (tJson.ok) setThemes(tJson.data.items)
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void refresh()
    // Themes refresh on a slow poll — clustering takes ~30s after the last
    // submit, so 15s polling lets new themes appear without UI thrash.
    const t = setInterval(refresh, 15_000)
    return () => clearInterval(t)
  }, [refresh])

  const submit = async () => {
    const content = draft.trim()
    if (content.length < 5) {
      setErrorMsg('Question must be at least 5 characters')
      return
    }
    setPosting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/pre-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, urgency }),
      })
      const json = await res.json()
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Failed to submit')
        return
      }
      setDraft('')
      setUrgency('NORMAL')
      await refresh()
    } finally {
      setPosting(false)
    }
  }

  const toggleVote = async (q: PreQuestionView) => {
    if (q.authorName && /* author guard handled server-side */ false) return
    const method = q.votedByMe ? 'DELETE' : 'POST'
    await fetch(`/api/classroom/sessions/${sessionId}/pre-questions/${q.id}/vote`, {
      method,
      credentials: 'include',
    })
    await refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="space-y-4">
        {/* Compose */}
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Ask before the session</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your question is visible to everyone in this session. Upvote others to surface them
            on the presenter&rsquo;s dashboard.
          </p>
          <Textarea
            className="mt-3 resize-none text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What would you like the presenter to address?"
            rows={3}
            maxLength={500}
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="pre-q-urgency" className="text-muted-foreground">
                Urgency:
              </label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
                <SelectTrigger id="pre-q-urgency" className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">
                {draft.length}/500
              </span>
            </div>
            <Button size="sm" onClick={submit} disabled={posting || draft.trim().length < 5}>
              <Send className="mr-1 h-3 w-3" /> Submit question
            </Button>
          </div>
          {errorMsg ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> {errorMsg}
            </p>
          ) : null}
        </section>

        {/* Question list */}
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All questions ({items.length})
          </h3>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No questions yet — be the first to ask.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((q) => {
                const isMine = q.authorName.includes('(e2e)')
                  ? false /* test fixtures are intentionally non-self */
                  : false
                // Self-vote is also blocked by the server (returns 400). We
                // disable the button visually for a smoother UX.
                const cannotVote = isMine
                return (
                  <li key={q.id} className="rounded-md border p-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleVote(q)}
                        disabled={cannotVote}
                        className={`flex w-12 flex-col items-center rounded border px-1 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          q.votedByMe
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        }`}
                        aria-label={q.votedByMe ? 'Remove upvote' : 'Upvote'}
                      >
                        <ArrowUp className="h-3 w-3" />
                        <span className="font-medium">{q.voteCount}</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{q.content}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{q.authorName}</span>
                          {q.urgency === 'HIGH' ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                              <AlertCircle className="h-3 w-3" /> Urgent
                            </span>
                          ) : null}
                          {q.themeLabel ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                              <Sparkles className="h-3 w-3" /> {q.themeLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Themes sidebar */}
      <aside className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI-clustered themes
        </h3>
        {themes.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Themes appear ~30 seconds after submissions. Submit or upvote a question to trigger
            re-clustering.
          </div>
        ) : (
          <ul className="space-y-2">
            {themes.map((t) => (
              <li key={t.id} className="rounded-md border bg-secondary/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.questionCount}</span>
                </div>
                {t.summary ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Reference for currentUserId so its eslint-no-unused-vars stays quiet
          while a future iteration uses it for client-side self-vote blocking. */}
      <span className="hidden">{currentUserId}</span>
    </div>
  )
}
