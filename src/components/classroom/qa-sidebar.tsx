'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart, Pin, MessageCircleReply, Send, Clock, CheckCircle2, Edit3, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

interface QaItemView {
  id: string
  recordingId: string
  userId: string
  userName: string
  timestampSec: number
  question: string
  pinned: boolean
  likeCount: number
  parentId: string | null
  createdAt: string
  replies: QaItemView[]
  likedByMe: boolean
  answer: string | null
  answeredById: string | null
  answeredByName: string | null
  answeredAt: string | null
}

interface Props {
  sessionId: string
  currentUser: { id: string; role: string }
  /** Current playback position in seconds (for "post at this timestamp") */
  currentTimeSec: number
  /** Click-to-seek callback wired to Vidstack `currentTime` */
  onSeek: (sec: number) => void
  /** Whether the current user can pin (host/PD/admin) */
  canPin: boolean
  /**
   * Whether the current user can mark a question as officially answered.
   * Server-computed (mirror of the privileged-user check in qa-service);
   * the API enforces it regardless, this just hides the affordance.
   */
  canAnswer: boolean
}

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function QaSidebar({ sessionId, currentUser, currentTimeSec, onSeek, canPin, canAnswer }: Props) {
  const [items, setItems] = useState<QaItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answerDraft, setAnswerDraft] = useState('')
  const [answerSubmitting, setAnswerSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/classroom/sessions/${sessionId}/qa`, { credentials: 'include' })
    const json = await res.json()
    if (json.ok) setItems(json.data.items)
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const post = async () => {
    const text = draft.trim()
    if (text.length < 2) return
    setPosting(true)
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timestampSec: Math.floor(currentTimeSec), question: text }),
      })
      const json = await res.json()
      if (json.ok) {
        setDraft('')
        await refresh()
      }
    } finally {
      setPosting(false)
    }
  }

  const postReply = async (parentId: string) => {
    const text = replyDraft.trim()
    if (text.length < 2) return
    const res = await fetch(`/api/classroom/sessions/${sessionId}/qa/${parentId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ question: text }),
    })
    const json = await res.json()
    if (json.ok) {
      setReplyDraft('')
      setReplyingTo(null)
      await refresh()
    }
  }

  const toggleLike = async (item: QaItemView) => {
    const method = item.likedByMe ? 'DELETE' : 'POST'
    const res = await fetch(`/api/classroom/sessions/${sessionId}/qa/${item.id}/likes`, {
      method,
      credentials: 'include',
    })
    const json = await res.json()
    if (json.ok) {
      await refresh()
    }
  }

  const togglePin = async (item: QaItemView) => {
    if (!canPin) return
    const res = await fetch(`/api/classroom/sessions/${sessionId}/qa/${item.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pinned: !item.pinned }),
    })
    const json = await res.json()
    if (json.ok) await refresh()
  }

  const startAnswering = (item: QaItemView) => {
    setAnsweringId(item.id)
    setAnswerDraft(item.answer ?? '')
  }

  const submitAnswer = async (qaId: string, clear = false) => {
    setAnswerSubmitting(true)
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/qa/${qaId}/answer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answer: clear ? null : answerDraft.trim() }),
      })
      const json = await res.json()
      if (json.ok) {
        setAnsweringId(null)
        setAnswerDraft('')
        await refresh()
      }
    } finally {
      setAnswerSubmitting(false)
    }
  }

  const answeredCount = items.filter((q) => q.answer).length

  return (
    <div className="flex h-full flex-col gap-3 border-l bg-background p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Discussion</h3>
        <span className="text-xs text-muted-foreground">
          {items.length} question{items.length === 1 ? '' : 's'}
          {answeredCount > 0 && ` · ${answeredCount} answered`}
        </span>
      </div>

      {/* Compose */}
      <div className="flex flex-col gap-2 rounded-md border p-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Posting at {fmtTs(currentTimeSec)}
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question at this timestamp…"
          rows={2}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={post} disabled={posting || draft.trim().length < 2}>
            <Send className="mr-1 h-3 w-3" /> Post
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-1">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No questions yet. Ask the first one.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((q) => {
              const isAnswered = !!q.answer
              const isMine = q.userId === currentUser.id
              return (
                <li
                  key={q.id}
                  className={`rounded-md border p-2 ${q.pinned ? 'border-primary/40 bg-primary/5' : ''} ${
                    isAnswered && !q.pinned ? 'border-emerald-500/30 bg-emerald-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSeek(q.timestampSec)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {fmtTs(q.timestampSec)}
                    </button>
                    <div className="flex items-center gap-1">
                      {isAnswered && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Answered
                        </span>
                      )}
                      {q.pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </span>
                      )}
                      {canPin && (
                        <Button size="icon" variant="ghost" onClick={() => togglePin(q)} className="h-6 w-6" aria-label="Pin question">
                          <Pin className={`h-3 w-3 ${q.pinned ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="mt-1 text-sm">{q.question}</p>

                  {/* Faculty answer block — prominent when present */}
                  {isAnswered && (
                    <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Sparkles className="h-3 w-3" />
                          Answered by {q.answeredByName ?? 'Faculty'}
                        </div>
                        {canAnswer && (
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => startAnswering(q)} aria-label="Edit answer">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{q.answer}</p>
                      {q.answeredAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(q.answeredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{q.userName}{isMine && ' (you)'}</span>
                    <button
                      type="button"
                      onClick={() => toggleLike(q)}
                      className={`inline-flex items-center gap-1 hover:text-foreground ${q.likedByMe ? 'text-red-500' : ''}`}
                    >
                      <Heart className={`h-3 w-3 ${q.likedByMe ? 'fill-current' : ''}`} />
                      {q.likeCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingTo((cur) => (cur === q.id ? null : q.id))}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <MessageCircleReply className="h-3 w-3" />
                      Reply{q.replies.length > 0 && ` (${q.replies.length})`}
                    </button>
                    {canAnswer && !isAnswered && (
                      <button
                        type="button"
                        onClick={() => startAnswering(q)}
                        className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark answered
                      </button>
                    )}
                  </div>

                  {/* Answer composer (faculty/PD/admin/host) */}
                  {answeringId === q.id && (
                    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                      <Textarea
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        placeholder="Write the official answer…"
                        rows={3}
                        className="resize-none border-emerald-500/20 bg-background text-sm"
                        autoFocus
                      />
                      <div className="mt-2 flex justify-between gap-2">
                        <div>
                          {isAnswered && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                              onClick={() => submitAnswer(q.id, true)}
                              disabled={answerSubmitting}
                            >
                              Clear answer
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setAnsweringId(null); setAnswerDraft('') }} disabled={answerSubmitting}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => submitAnswer(q.id)}
                            disabled={answerSubmitting || answerDraft.trim().length < 2}
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {isAnswered ? 'Update answer' : 'Mark as answered'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reply composer */}
                  {replyingTo === q.id && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a reply…"
                        className="h-8 text-xs"
                      />
                      <Button size="sm" onClick={() => postReply(q.id)} disabled={replyDraft.trim().length < 2}>
                        Send
                      </Button>
                    </div>
                  )}

                  {/* Replies */}
                  {q.replies.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2 border-l pl-3">
                      {q.replies.map((r) => (
                        <li key={r.id}>
                          <p className="text-xs">
                            <span className="font-medium">{r.userName}: </span>
                            {r.question}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
