'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, ShieldCheck, User as UserIcon, Phone, AtSign, GraduationCap, Building2, Mail, AlertCircle, UserMinus } from 'lucide-react'
import { Role, UserStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ROLE_LABELS } from '@/lib/constants'
import { mapPrismaRoleToUserRole } from '@/lib/identity'
import { UserPicker, type PickableUser } from '@/components/user-picker'
import type { AdminUserRow } from './users-client'

interface DetailedUser {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
  mobile: string | null
  username: string | null
  programDirectorId: string | null
  programDirector: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  } | null
  profile: {
    subspecialty: string | null
    yearOfResidency: number | null
    affiliation: string | null
    bio: string | null
    timezone: string | null
    mciRegNumber: string | null
  } | null
}

interface Props {
  user: AdminUserRow
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}

const ROLE_OPTIONS: Role[] = [
  Role.RESIDENT,
  Role.FACULTY,
  Role.PROGRAM_DIRECTOR,
  Role.ADMIN,
  Role.EXTERNAL_LEARNER,
]

const STATUS_OPTIONS: Array<Extract<UserStatus, 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'>> = [
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]

type Tab = 'identity' | 'profile' | 'role-status'

export function EditUserModal({ user, currentUserId, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('identity')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Identity
  const [name, setName] = useState(user.name)
  const [mobile, setMobile] = useState('')
  const [username, setUsername] = useState('')

  // Profile
  const [subspecialty, setSubspecialty] = useState('')
  const [yearOfResidency, setYearOfResidency] = useState<string>('')
  const [affiliation, setAffiliation] = useState('')
  const [mciRegNumber, setMciRegNumber] = useState('')
  const [bio, setBio] = useState('')

  // Role & status
  const [newRole, setNewRole] = useState<Role>(user.role)
  const [newStatus, setNewStatus] = useState<UserStatus>(user.status)
  const [reason, setReason] = useState('')

  // Program director (only meaningful when newRole === FACULTY)
  const [pdPick, setPdPick] = useState<PickableUser[]>([])
  const [originalPdId, setOriginalPdId] = useState<string | null>(null)

  const isSelf = user.id === currentUserId

  // Hydrate full user detail (mobile, username, profile) on open. Always
  // resolves the loading state — every error path sets it explicitly, and
  // the catch handles fetch failures (DNS, abort, parse errors).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const text = await res.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          if (!cancelled) {
            setError(`Server returned non-JSON (status ${res.status}). Check server logs.`)
            setLoading(false)
          }
          return
        }
        if (!res.ok) {
          const errMsg =
            (parsed as { error?: { message?: string } } | null)?.error?.message ??
            `Request failed (status ${res.status})`
          if (!cancelled) {
            setError(errMsg)
            setLoading(false)
          }
          return
        }
        const u = (parsed as { data: { user: DetailedUser } }).data.user
        if (cancelled) return
        setMobile(u.mobile ?? '')
        setUsername(u.username ?? '')
        setSubspecialty(u.profile?.subspecialty ?? '')
        setYearOfResidency(u.profile?.yearOfResidency != null ? String(u.profile.yearOfResidency) : '')
        setAffiliation(u.profile?.affiliation ?? '')
        setMciRegNumber(u.profile?.mciRegNumber ?? '')
        setBio(u.profile?.bio ?? '')
        setOriginalPdId(u.programDirectorId ?? null)
        setPdPick(
          u.programDirector
            ? [{
                id: u.programDirector.id,
                name: u.programDirector.name,
                email: u.programDirector.email,
                role: Role.PROGRAM_DIRECTOR,
                avatarUrl: u.programDirector.avatarUrl,
              }]
            : []
        )
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Network error'
          setError(`Could not load user details: ${msg}`)
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function callPatch(path: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return { ok: true }
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, message: j?.error?.message ?? `Request failed (${res.status})` }
  }

  async function handleSave() {
    setSubmitting(true)
    setError(null)
    try {
      const yearInt = yearOfResidency.trim() ? Number.parseInt(yearOfResidency, 10) : null
      if (yearOfResidency.trim() && (Number.isNaN(yearInt!) || yearInt! < 1 || yearInt! > 10)) {
        setError('Year of residency must be between 1 and 10')
        setSubmitting(false)
        return
      }

      // 1) Role change first (separate endpoint — writes UserRoleHistory).
      //    Order matters: subsequent identity PATCH may set programDirectorId,
      //    which the service guards behind target.role === FACULTY.
      if (!isSelf && newRole !== user.role) {
        const r1 = await callPatch(`/api/admin/users/${user.id}/role`, {
          role: newRole,
          reason: reason.trim() || undefined,
        })
        if (!r1.ok) {
          setError(r1.message ?? 'Failed to change role')
          setSubmitting(false)
          return
        }
      }

      // 2) Identity + profile + programDirectorId (single PATCH)
      const identityPayload: Record<string, unknown> = {}
      if (name.trim() !== user.name) identityPayload.name = name.trim()
      if (mobile.trim()) identityPayload.mobile = mobile.trim()
      else identityPayload.mobile = null
      if (username.trim()) identityPayload.username = username.trim().toLowerCase()
      else identityPayload.username = null

      identityPayload.profile = {
        subspecialty: subspecialty.trim() || null,
        yearOfResidency: yearInt,
        affiliation: affiliation.trim() || null,
        mciRegNumber: mciRegNumber.trim() || null,
        bio: bio.trim() || null,
      }

      // Send programDirectorId only when relevant: target is/will-be FACULTY.
      // For any other role the field is meaningless; skip it so the server
      // doesn't have to think about it.
      if (newRole === Role.FACULTY) {
        const nextPdId = pdPick[0]?.id ?? null
        if (nextPdId !== originalPdId) identityPayload.programDirectorId = nextPdId
      } else if (originalPdId) {
        // Leaving FACULTY — clear any PD link so we don't carry stale state.
        identityPayload.programDirectorId = null
      }

      const r2 = await callPatch(`/api/admin/users/${user.id}`, identityPayload)
      if (!r2.ok) {
        setError(r2.message ?? 'Failed to update user')
        setSubmitting(false)
        return
      }

      // 3) Status change (separate endpoint — bumps passwordVersion + may email)
      if (!isSelf && newStatus !== user.status && STATUS_OPTIONS.includes(newStatus as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED')) {
        const r3 = await callPatch(`/api/admin/users/${user.id}/status`, {
          status: newStatus,
          reason: reason.trim() || undefined,
        })
        if (!r3.ok) {
          setError(r3.message ?? 'Failed to change status')
          setSubmitting(false)
          return
        }
      }

      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-border/60 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                Edit user
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {user.name} · {user.email}{isSelf && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-amber-400">YOU</span>}
              </p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted/60" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-border/40 px-5">
            <TabButton active={tab === 'identity'} onClick={() => setTab('identity')}>
              <UserIcon className="size-3.5" />
              Identity
            </TabButton>
            <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>
              <GraduationCap className="size-3.5" />
              Profile
            </TabButton>
            <TabButton active={tab === 'role-status'} onClick={() => setTab('role-status')} disabled={isSelf}>
              <ShieldCheck className="size-3.5" />
              Role & Status
            </TabButton>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading user details...
              </div>
            ) : tab === 'identity' ? (
              <div className="space-y-4">
                <Field label="Full name" icon={UserIcon}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Email (read-only)" icon={Mail} hint="Email is locked. Use the invitations flow to re-issue access under a new address.">
                  <Input value={user.email} readOnly disabled className="bg-muted/40" />
                </Field>
                <Field label="Mobile" icon={Phone} hint="E.164 format with country code, e.g. +919876543210">
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91XXXXXXXXXX" />
                </Field>
                <Field label="Username" icon={AtSign} hint="3–32 chars, lowercase letters / digits / dot / dash / underscore.">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. ananya.k"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>
              </div>
            ) : tab === 'profile' ? (
              <div className="space-y-4">
                <Field label="Subspecialty" icon={GraduationCap}>
                  <Input value={subspecialty} onChange={(e) => setSubspecialty(e.target.value)} placeholder="e.g. Vitreoretinal Surgery" />
                </Field>
                <Field label="Year of residency" icon={GraduationCap} hint="1–10 (PGY level). Leave blank for non-residents.">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={yearOfResidency}
                    onChange={(e) => setYearOfResidency(e.target.value)}
                    placeholder="e.g. 3"
                  />
                </Field>
                <Field label="Affiliation" icon={Building2}>
                  <Input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="L V Prasad Eye Institute" />
                </Field>
                <Field label="MCI registration number" icon={ShieldCheck} hint="Optional — Indian Medical Council registration.">
                  <Input value={mciRegNumber} onChange={(e) => setMciRegNumber(e.target.value)} placeholder="e.g. MCI/12345/2018" />
                </Field>
                <Field label="Bio">
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Short biography..." />
                </Field>
              </div>
            ) : (
              <div className="space-y-5">
                {isSelf && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    You cannot change your own role or status. Sign in as another admin to make this change.
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Role</p>
                  <div className="grid gap-2">
                    {ROLE_OPTIONS.map((role) => (
                      <label
                        key={role}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors ${
                          newRole === role ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                        } ${isSelf ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={newRole === role}
                          onChange={() => setNewRole(role)}
                          disabled={isSelf}
                          className="size-4 accent-primary"
                        />
                        <span>{ROLE_LABELS[mapPrismaRoleToUserRole(role)]}</span>
                        {role === user.role && (
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">current</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {STATUS_OPTIONS.map((status) => (
                      <label
                        key={status}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2 text-xs font-medium transition-colors ${
                          newStatus === status ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'
                        } ${isSelf ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <input
                          type="radio"
                          name="status"
                          value={status}
                          checked={newStatus === status}
                          onChange={() => setNewStatus(status)}
                          disabled={isSelf}
                          className="hidden"
                        />
                        {status === 'ACTIVE' && '🟢'}
                        {status === 'SUSPENDED' && '🟡'}
                        {status === 'DEACTIVATED' && '🔴'}
                        {status.replace('_', ' ').toLowerCase()}
                      </label>
                    ))}
                  </div>
                  {newStatus !== 'ACTIVE' && newStatus !== user.status && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {newStatus === 'SUSPENDED'
                        ? 'Suspending invalidates active sessions and emails the user.'
                        : 'Deactivation invalidates active sessions; user keeps audit-history reference.'}
                    </p>
                  )}
                </div>

                {newRole === Role.FACULTY && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="size-3" /> Reports to (Program Director)
                    </p>
                    {pdPick.length > 0 ? (
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-700">
                          {pdPick[0].name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{pdPick[0].name}</div>
                          <div className="truncate text-xs text-muted-foreground">{pdPick[0].email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPdPick([])}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Clear program director"
                        >
                          <UserMinus className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <UserPicker
                        single
                        role={Role.PROGRAM_DIRECTOR}
                        excludeIds={[user.id]}
                        selected={pdPick}
                        onChange={setPdPick}
                        placeholder="Search program directors…"
                      />
                    )}
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Optional. Saved when you click Save changes.
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Reason (optional, recorded in audit log)</p>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. promoted to faculty after fellowship completion"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-md bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={submitting || loading}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  icon: Icon,
  hint,
  children,
}: {
  label: string
  icon?: React.ElementType
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
