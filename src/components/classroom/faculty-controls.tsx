'use client'

import { useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { Settings, Link2, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FacultyControls({ sessionId, isHost }: { sessionId: string; isHost: boolean }) {
  const room = useRoomContext()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function muteAll() {
    if (!confirm('Mute all participants except you?')) return
    setBusy(true)
    try {
      const me = room.localParticipant.identity
      const others = Array.from(room.remoteParticipants.values()).filter((p) => p.identity !== me)
      await Promise.all(
        others.map((p) =>
          fetch(`/api/classroom/sessions/${sessionId}/participants/${p.identity}/mute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ muted: true }),
          })
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function endSession() {
    if (!confirm('End this session for everyone?')) return
    setBusy(true)
    try {
      await fetch(`/api/classroom/sessions/${sessionId}/end`, { method: 'POST' })
    } finally {
      setBusy(false)
    }
  }

  async function copyShareLink() {
    setBusy(true)
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlHours: 24 }),
      })
      const json = await res.json()
      if (!json.ok) return
      await navigator.clipboard.writeText(json.data.url)
      alert(`Share link copied. Expires: ${new Date(json.data.expiresAt).toLocaleString()}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <Settings className="size-4 mr-1.5" /> Host controls
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-popover p-1 shadow-lg z-50">
          <MenuItem onClick={muteAll} disabled={busy}>
            Mute all (except me)
          </MenuItem>
          <MenuItem onClick={copyShareLink} disabled={busy}>
            <Link2 className="size-3.5 mr-2" /> Copy share link
          </MenuItem>
          {isHost && (
            <MenuItem destructive onClick={endSession} disabled={busy}>
              <PhoneOff className="size-3.5 mr-2" /> End session
            </MenuItem>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  children,
  destructive,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted disabled:opacity-50 ${
        destructive ? 'text-destructive hover:bg-destructive/10' : ''
      }`}
    >
      {children}
    </button>
  )
}
