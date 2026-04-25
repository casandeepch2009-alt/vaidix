'use client'

import { useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  createdAt: string
}

const DC_TOPIC = 'chat'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function ChatPanel({
  sessionId,
  currentUser,
}: {
  sessionId: string
  currentUser: { id: string; name: string }
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const { localParticipant } = useLocalParticipant()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load scrollback on mount
  useEffect(() => {
    let mounted = true
    fetch(`/api/classroom/sessions/${sessionId}/chat?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted || !json.ok) return
        setMessages(
          json.data.messages.map((m: { id: string; userId: string; content: string; createdAt: string; user: { name: string } }) => ({
            id: m.id,
            userId: m.userId,
            userName: m.user.name,
            content: m.content,
            createdAt: m.createdAt,
          }))
        )
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [sessionId])

  // Real-time data-channel receive
  const { message: lastDc } = useDataChannel(DC_TOPIC)
  useEffect(() => {
    if (!lastDc) return
    try {
      const parsed = JSON.parse(decoder.decode(lastDc.payload)) as ChatMessage
      // Ignore echoes from self (we already appended on send)
      if (parsed.userId === currentUser.id) return
      setMessages((prev) => [...prev, parsed])
    } catch {
      /* malformed, ignore */
    }
  }, [lastDc, currentUser.id])

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setSending(true)
    try {
      // Optimistic append
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        content,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      setDraft('')

      // Persist to DB
      const res = await fetch(`/api/classroom/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (!json.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }

      // Broadcast to room
      await localParticipant.publishData(
        encoder.encode(
          JSON.stringify({
            id: json.data.message.id,
            userId: currentUser.id,
            userName: currentUser.name,
            content,
            createdAt: json.data.message.createdAt,
          })
        ),
        { topic: DC_TOPIC, reliable: true }
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="rounded-md bg-muted/40 p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">{m.userName}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-sm">{m.content}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
