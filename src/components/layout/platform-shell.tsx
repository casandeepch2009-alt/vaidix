'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { RoleProvider } from '@/contexts/role-context'
import type { Identity } from '@/lib/identity'

interface PlatformShellProps {
  children: ReactNode
  initialIdentity: Identity
}

const COLLAPSE_BELOW_PX = 1280

/**
 * Client boundary for the (platform) layout. Holds the sidebar collapse state
 * and the RoleProvider that exposes the server-resolved identity to all
 * descendant client components.
 *
 * Auto-collapses the sidebar on viewports < 1280px (laptops/tablets) so dense
 * pages like the calendar don't get cropped, while still respecting the user
 * if they manually expand it on a small screen.
 */
export function PlatformShell({ children, initialIdentity }: PlatformShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userToggled, setUserToggled] = useState(false)

  useEffect(() => {
    if (userToggled) return
    const apply = () => setSidebarCollapsed(window.innerWidth < COLLAPSE_BELOW_PX)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [userToggled])

  return (
    <RoleProvider initialIdentity={initialIdentity}>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => {
            setUserToggled(true)
            setSidebarCollapsed((v) => !v)
          }}
        />
        <div className="premium-frame flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 bg-background">{children}</main>
        </div>
      </div>
    </RoleProvider>
  )
}
