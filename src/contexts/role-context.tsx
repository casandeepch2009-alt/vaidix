'use client'

// ════════════════════════════════════════════════════════════════════════════
// RoleContext — session-driven identity, with admin-gated demo role override
// ════════════════════════════════════════════════════════════════════════════
//
// Architecture (read this before adding consumers):
//
//   (platform)/layout.tsx (server component)
//     ├─ auth()                                         ← NextAuth session
//     ├─ db.user.findUnique({ include: { profile } })   ← real Prisma row
//     ├─ mapUserToIdentity(user)                        ← see lib/identity.ts
//     └─ <PlatformShell initialIdentity={...}>          ← wraps RoleProvider
//                  └─ <RoleProvider initialIdentity={...}>
//                          └─ children
//
// This file does NOT import next-auth/react or call useSession(). The session
// is resolved exactly once per navigation in the (platform) server layout and
// passed in as a typed object. That keeps every UI consumer (sidebar, header,
// dashboard) free of session-loading states.
//
// Role override (demo / dev only):
//   The header dropdown lets admins switch the *displayed* role for screen-
//   recording demos. It is gated by:
//     1. process.env.NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === 'true'    (build flag)
//     2. initialIdentity.role === 'admin'                           (real role)
//   The override only changes UI display. The session JWT is unchanged, so
//   server-side route guards (middleware, requireAuth, route handlers) keep
//   enforcing the user's true role.

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/types'
import type { Identity } from '@/lib/identity'

const ALL_ROLES: UserRole[] = [
  'resident',
  'faculty',
  'program_director',
  'admin',
  'external_learner',
]

const ROLE_SWITCHER_FLAG = process.env.NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === 'true'

interface RoleContextValue {
  /** Always the real authenticated user. Never spoofed. */
  currentUser: Identity
  /** Effective role for UI display — may differ from currentUser.role when an admin is impersonating. */
  currentRole: UserRole
  /** Real role from the session JWT. Use this for any UI that must reflect ground truth (audit headers, etc.). */
  realRole: UserRole
  /** True when the current user is viewing the UI as a different role for demo purposes. */
  isImpersonating: boolean
  /**
   * Switch the displayed role. No-op unless the user is an admin AND the
   * NEXT_PUBLIC_ENABLE_ROLE_SWITCHER build flag is set. Server routes are
   * never affected — this only re-renders the client shell.
   */
  switchRole: (role: UserRole) => void
  /** Reset the displayed role back to the real role. */
  resetRole: () => void
  /**
   * Roles available in the switcher dropdown.
   * Empty array (= dropdown hidden) for non-admins or when the flag is off.
   */
  allRoles: UserRole[]
  /** Localized label for the effective role. */
  roleLabel: string
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

interface RoleProviderProps {
  children: ReactNode
  initialIdentity: Identity
}

export function RoleProvider({ children, initialIdentity }: RoleProviderProps) {
  const realRole = initialIdentity.role
  const canSwitch = ROLE_SWITCHER_FLAG && realRole === 'admin'

  const [overrideRole, setOverrideRole] = useState<UserRole | null>(null)

  const value = useMemo<RoleContextValue>(() => {
    const effectiveRole = canSwitch && overrideRole ? overrideRole : realRole
    return {
      currentUser: initialIdentity,
      currentRole: effectiveRole,
      realRole,
      isImpersonating: canSwitch && overrideRole != null && overrideRole !== realRole,
      switchRole: (next: UserRole) => {
        if (!canSwitch) return
        setOverrideRole(next === realRole ? null : next)
      },
      resetRole: () => setOverrideRole(null),
      allRoles: canSwitch ? ALL_ROLES : [],
      roleLabel: ROLE_LABELS[effectiveRole],
    }
  }, [initialIdentity, realRole, overrideRole, canSwitch])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
