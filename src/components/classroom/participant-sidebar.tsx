'use client'

import { useEffect, useState } from 'react'
import { useParticipants, useLocalParticipant } from '@livekit/components-react'
import { Hand, MicOff, UserMinus, UserPlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PendingAdmission {
  id: string
  displayName: string | null
  user: { id: string; name: string; email: string; avatarUrl: string | null; role: string }
}

export function ParticipantSidebar({
  sessionId,
  canModerate,
  currentUserId,
}: {
  sessionId: string
  canModerate: boolean
  currentUserId: string
}) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const [pending, setPending] = useState<PendingAdmission[]>([])

  // Poll pending admissions if we can moderate
  useEffect(() => {
    if (!canModerate) return
    let mounted = true
    const fetchPending = async () => {
      try {
        const res = await fetch(`/api/classroom/sessions/${sessionId}/admissions`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (mounted && json.ok) setPending(json.data.pending)
      } catch {
        /* ignore */
      }
    }
    fetchPending()
    const iv = setInterval(fetchPending, 5000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [sessionId, canModerate])

  // Sort: raised hands first, then speaking, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const ah = isHandRaised(a.metadata)
    const bh = isHandRaised(b.metadata)
    if (ah !== bh) return ah ? -1 : 1
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1
    return (a.name ?? a.identity).localeCompare(b.name ?? b.identity)
  })

  async function mute(identity: string) {
    await fetch(`/api/classroom/sessions/${sessionId}/participants/${identity}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: true }),
    })
  }
  async function remove(identity: string) {
    if (!confirm('Remove this participant?')) return
    await fetch(`/api/classroom/sessions/${sessionId}/participants/${identity}`, {
      method: 'DELETE',
    })
  }
  async function promote(identity: string) {
    await fetch(`/api/classroom/sessions/${sessionId}/participants/${identity}/promote`, {
      method: 'POST',
    })
  }
  async function admit(id: string) {
    const res = await fetch(`/api/classroom/sessions/${sessionId}/admissions/${id}/admit`, {
      method: 'POST',
    })
    if (res.ok) setPending((p) => p.filter((x) => x.id !== id))
  }
  async function deny(id: string) {
    const reason = prompt('Reason (optional):') ?? undefined
    const res = await fetch(`/api/classroom/sessions/${sessionId}/admissions/${id}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) setPending((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="divide-y">
      {canModerate && pending.length > 0 && (
        <div className="p-3 bg-amber-500/5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Waiting room ({pending.length})
          </h3>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-card p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.displayName ?? p.user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.user.email}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => admit(p.id)}>
                    <Check className="size-3.5 text-green-600" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => deny(p.id)}>
                    <X className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          In session ({participants.length})
        </h3>
        <ul className="space-y-1">
          {sorted.map((p) => {
            const handRaised = isHandRaised(p.metadata)
            const isSelf = p.identity === currentUserId
            const isLocal = p.identity === localParticipant.identity
            return (
              <li
                key={p.identity}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5',
                  handRaised && 'bg-amber-500/10'
                )}
              >
                <div className="relative size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(p.name ?? p.identity).slice(0, 2).toUpperCase()}
                  {p.isSpeaking && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-green-500 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm">
                    <span className="truncate">{p.name ?? p.identity}</span>
                    {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    {handRaised && <Hand className="size-3.5 text-amber-600 shrink-0" />}
                  </div>
                </div>
                {canModerate && !isLocal && (
                  <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon-xs" variant="ghost" title="Mute" onClick={() => mute(p.identity)}>
                      <MicOff className="size-3" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" title="Promote to co-host" onClick={() => promote(p.identity)}>
                      <UserPlus className="size-3" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" title="Remove" onClick={() => remove(p.identity)}>
                      <UserMinus className="size-3" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function isHandRaised(metadata: string | undefined): boolean {
  if (!metadata) return false
  try {
    const parsed = JSON.parse(metadata)
    return parsed?.handRaised === true
  } catch {
    return false
  }
}
