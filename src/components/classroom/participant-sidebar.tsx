'use client'

import { useEffect, useState } from 'react'
import { useParticipants, useLocalParticipant } from '@livekit/components-react'
import { Hand, MicOff, UserMinus, UserPlus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useVideoRoomClient, type PendingAdmission } from './video-room-client'

export function ParticipantSidebar({
  sessionId,
  canModerate,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  currentUserRole,
  currentUserIsOrganizer,
}: {
  sessionId: string
  canModerate: boolean
  currentUserId: string
  /// Trusted profile fields for the local user, sourced from the DB row
  /// at page render time. Used as the source of truth for the local
  /// participant's display — avoids relying on LiveKit's JWT name claim
  /// which can be stale on legacy sessions.
  currentUserName?: string
  currentUserEmail?: string
  currentUserAvatarUrl?: string | null
  /// Role + organizer state for the local user, used to render badges
  /// next to their entry. Remote participants will pick up role from
  /// LiveKit JWT metadata once that round-trip is wired (TODO).
  currentUserRole?: string
  currentUserIsOrganizer?: boolean
}) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const client = useVideoRoomClient()
  const [pending, setPending] = useState<PendingAdmission[]>([])

  // Poll pending admissions if we can moderate
  useEffect(() => {
    if (!canModerate) return
    let mounted = true
    const fetchPending = async () => {
      try {
        const list = await client.loadPendingAdmissions(sessionId)
        if (mounted) setPending(list)
      } catch {
        /* ignore */
      }
    }
    void fetchPending()
    const iv = setInterval(fetchPending, 5000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [sessionId, canModerate, client])

  // Falls back through (Vaidix only admits registered users so we always
  // have something on file):
  //   1. trusted currentUserName prop  (DB row, only for the local user)
  //   2. participant.name              (LiveKit's replicated name)
  //   3. currentUserEmail prefix       (only for the local user)
  //   4. `User <id4>` derived from identity
  //   5. 'Joining…'                    (transient — placeholder during connect)
  //
  // Self detection uses BOTH reference equality with the local participant
  // (handles the pre-connect window where identity is still '') AND
  // identity matching against currentUserId (handles post-connect).
  const isSelfParticipant = (p: { identity: string }): boolean =>
    p === (localParticipant as unknown as typeof p) || p.identity === currentUserId
  const displayName = (p: { name?: string; identity: string }): string => {
    const isSelf = isSelfParticipant(p)
    if (isSelf) {
      const cn = (currentUserName ?? '').trim()
      if (cn) return cn
    }
    const n = (p.name ?? '').trim()
    if (n) return n
    if (isSelf) {
      const ep = (currentUserEmail ?? '').split('@')[0]?.trim()
      if (ep) return ep
    }
    const id = (p.identity ?? '').trim()
    if (id) return `User ${id.slice(0, 4)}`
    return 'Joining…'
  }

  // Sort: raised hands first, then speaking, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const ah = isHandRaised(a.metadata)
    const bh = isHandRaised(b.metadata)
    if (ah !== bh) return ah ? -1 : 1
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1
    return displayName(a).localeCompare(displayName(b))
  })

  async function mute(identity: string) {
    await client.muteParticipant(sessionId, identity, true).catch(() => {/* swallow */})
  }
  async function remove(identity: string) {
    if (!confirm('Remove this participant?')) return
    await client.removeParticipant(sessionId, identity).catch(() => {/* swallow */})
  }
  async function promote(identity: string) {
    await client.promoteParticipant(sessionId, identity).catch(() => {/* swallow */})
  }
  async function admit(id: string) {
    try {
      await client.admitParticipant(sessionId, id)
      setPending((p) => p.filter((x) => x.id !== id))
    } catch {/* leave in list — operator can retry */}
  }
  async function deny(id: string) {
    const reason = prompt('Reason (optional):') ?? undefined
    try {
      await client.denyParticipant(sessionId, id, reason)
      setPending((p) => p.filter((x) => x.id !== id))
    } catch {/* leave in list */}
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
            const isSelf = isSelfParticipant(p)
            const isLocal = isSelf
            const avatar = isSelf ? currentUserAvatarUrl : null
            return (
              <li
                key={p.identity || (isSelf ? 'self' : 'unknown')}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5',
                  handRaised && 'bg-amber-500/10'
                )}
              >
                <div
                  className={cn(
                    'relative size-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold',
                    avatar ? 'bg-zinc-800' : avatarColorFor(p.identity || displayName(p)),
                  )}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt={displayName(p)}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    displayName(p).slice(0, 2).toUpperCase()
                  )}
                  {p.isSpeaking && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-green-500 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm">
                    <span className="truncate">{displayName(p)}</span>
                    {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    {handRaised && <Hand className="size-3.5 text-amber-600 shrink-0" />}
                  </div>
                  {/* Role + organizer badges — only the local user has these
                      filled today (we pull from auth session at page render).
                      Remote participants need the role wired through LiveKit
                      JWT metadata, which is the next step. */}
                  {isSelf && (currentUserRole || currentUserIsOrganizer) && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] leading-none">
                      {currentUserRole && (
                        <RoleBadge role={currentUserRole} />
                      )}
                      {currentUserIsOrganizer && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                          Organizer
                        </span>
                      )}
                    </div>
                  )}
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

// Stable per-user colour palette so initials always read against the avatar
// background (the previous bg-muted + inherited text rendered near-invisible
// on the dark sidebar). Mirrors the strip's palette so a user's avatar
// colour is consistent across the whole live-room UI.
const AVATAR_PALETTE = [
  'bg-emerald-600 text-emerald-50',
  'bg-sky-600 text-sky-50',
  'bg-violet-600 text-violet-50',
  'bg-fuchsia-600 text-fuchsia-50',
  'bg-amber-600 text-amber-50',
  'bg-rose-600 text-rose-50',
  'bg-teal-600 text-teal-50',
] as const

function avatarColorFor(seed: string): string {
  if (!seed) return AVATAR_PALETTE[0]
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

// ─── Role badge ──────────────────────────────────────────────────────────────
// Single source of truth for how each Vaidix role label + colour are rendered
// in the People panel. Includes a "Guest" branch for users who join via a
// share link without a registered account (RBAC-wise we don't really admit
// these in production today, but the picker handles it gracefully).

const ROLE_DISPLAY: Record<string, { label: string; cls: string }> = {
  ADMIN:            { label: 'Admin',    cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  PROGRAM_DIRECTOR: { label: 'PD',       cls: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300' },
  FACULTY:          { label: 'Faculty',  cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  RESIDENT:         { label: 'Resident', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  GUEST:            { label: 'Guest',    cls: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_DISPLAY[role.toUpperCase()] ?? { label: role, cls: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' }
  return (
    <span className={`rounded-full px-1.5 py-0.5 font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
