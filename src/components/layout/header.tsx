'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Search, LogOut, User, ChevronDown, Settings, Shuffle, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useRole } from '@/contexts/role-context'
import { SIDEBAR_NAV, ROLE_LABELS } from '@/lib/constants'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { NotificationBell } from '@/components/layout/notification-bell'
import { ProgramSwitcher } from '@/components/layout/program-switcher'
import type { UserRole } from '@/lib/types'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => !part.startsWith('Dr.'))
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getPageTitle(pathname: string, role: string): string {
  const navItems = SIDEBAR_NAV[role as keyof typeof SIDEBAR_NAV] ?? []
  const match = navItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href))
  )
  return match?.label ?? 'Dashboard'
}

const ROLE_COLORS: Record<UserRole, string> = {
  resident:         'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  faculty:          'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  program_director: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  admin:            'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  external_learner: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
}

export function Header() {
  const pathname = usePathname()
  const {
    currentUser,
    currentRole,
    realRole,
    isImpersonating,
    switchRole,
    resetRole,
    allRoles,
    roleLabel,
  } = useRole()
  const pageTitle = getPageTitle(pathname, currentRole)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  function close() { setProfileOpen(false) }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // The switcher is visible only when the provider populated `allRoles`
  // (admin + NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === 'true'). For everyone
  // else the dropdown's role section is omitted entirely.
  const showRoleSwitcher = allRoles.length > 0

  return (
    <header className="relative z-30 flex shrink-0 flex-col border-b border-border/70 bg-background">
      {/* Impersonation banner — admin-only, only when actively switched */}
      {isImpersonating && (
        <div className="flex items-center justify-between gap-2 bg-amber-500/15 px-4 py-1.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 lg:px-6">
          <span>
            Viewing as <strong>{ROLE_LABELS[currentRole]}</strong> (demo override) — your real role is {ROLE_LABELS[realRole]}.
          </span>
          <button
            onClick={resetRole}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600/15 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-600/25 dark:text-amber-100"
          >
            <X className="size-3" />
            Reset
          </button>
        </div>
      )}

      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">

      {/* Left: Page title + program switcher */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground md:hidden">Vaidix</h1>
        <h1 className="hidden text-sm font-semibold text-foreground md:block">{pageTitle}</h1>
        {/* W6.11 — multi-program tenancy switcher. Hides itself when the user
            has < 2 memberships, so single-tenant LVPEI accounts see no chrome. */}
        <ProgramSwitcher />
      </div>

      {/* Center: Search */}
      <div className="hidden max-w-sm flex-1 md:block">
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
          }}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left text-xs">Search cases, pages...</span>
          <kbd className="rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      {/* Right: minimal actions + user */}
      <div className="flex shrink-0 items-center gap-0.5">

        {/* Theme toggle — ghost, no visual noise */}
        <ThemeToggle />

        {/* Notifications — popover backed by /api/notifications */}
        <NotificationBell />

        {/* Divider */}
        <div className="mx-1.5 h-5 w-px bg-border/60" />

        {/* User profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/50',
              profileOpen && 'bg-muted/50'
            )}
          >
            <Avatar size="default" className="ring-2 ring-teal-500/20 transition-all hover:ring-teal-500/40">
              <AvatarFallback className="bg-linear-to-br from-teal-500 to-blue-600 text-xs font-semibold text-white">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start md:flex">
              <span className="text-xs font-semibold leading-tight text-foreground">
                {currentUser.name}
              </span>
              <span className={cn(
                'rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide leading-none mt-0.5',
                ROLE_COLORS[currentRole]
              )}>
                {roleLabel}
              </span>
            </div>
            <ChevronDown className={cn(
              'hidden size-3 text-muted-foreground/60 transition-transform duration-200 md:block',
              profileOpen && 'rotate-180'
            )} />
          </button>

          {/* Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-full z-200 mt-2 w-56 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl shadow-black/10 dark:shadow-black/40">

              {/* User info header */}
              <div className="border-b border-border/40 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
                <p className="text-[11px] text-muted-foreground">{currentUser.email ?? 'LVPEI'}</p>
              </div>

              {/* Profile actions */}
              <div className="p-1.5 space-y-px">
                <Link
                  href="/profile"
                  onClick={close}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
                >
                  <User className="size-3.5 text-muted-foreground" />
                  View Profile
                </Link>
                {realRole === 'admin' && (
                  <Link
                    href="/admin/settings"
                    onClick={close}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
                  >
                    <Settings className="size-3.5 text-muted-foreground" />
                    Settings
                  </Link>
                )}
              </div>

              {/* Role switcher — admin-only, gated by NEXT_PUBLIC_ENABLE_ROLE_SWITCHER */}
              {showRoleSwitcher && (
                <div className="border-t border-border/40 px-3 py-2.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Shuffle className="size-3" />
                    Demo: View as role
                  </p>
                  <div className="space-y-px">
                    {allRoles.map((role) => (
                      <button
                        key={role}
                        onClick={() => { switchRole(role); setProfileOpen(false) }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                          currentRole === role
                            ? cn('font-semibold', ROLE_COLORS[role])
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        {currentRole === role && <span className="size-1.5 rounded-full bg-current" />}
                        {currentRole !== role && <span className="size-1.5 rounded-full" />}
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign out — calls NextAuth's signOut so the JWT cookie is
                  cleared and any in-flight Auth.js callbacks (logout audit,
                  CSRF token rotation) run before the redirect. */}
              <div className="border-t border-border/40 p-1.5">
                <button
                  onClick={() => {
                    close()
                    void signOut({ callbackUrl: '/login' })
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  )
}
