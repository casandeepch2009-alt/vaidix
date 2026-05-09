'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LayoutGrid,
  Brain,
  BookOpen,
  TrendingUp,
  NotebookPen,
  RotateCcw,
  Video,
  Microscope,
  Trophy,
  Users,
  ClipboardCheck,
  Shield,
  BarChart3,
  Map,
  Flag,
  Award,
  Building2,
  UserCog,
  ShieldCheck,
  Database,
  Image,
  Settings,
  ScrollText,
  Lightbulb,
  Scan,
  ScanEye,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Inbox,
  UsersRound,
  FolderOpen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRole } from '@/contexts/role-context'
import { SIDEBAR_NAV } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

// Map icon string names from constants to actual Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  LayoutGrid,
  Brain,
  BookOpen,
  TrendingUp,
  NotebookPen,
  RotateCcw,
  Video,
  Microscope,
  Trophy,
  Users,
  ClipboardCheck,
  Shield,
  BarChart3,
  Map,
  Flag,
  Award,
  Building2,
  UserCog,
  ShieldCheck,
  Database,
  Image,
  Settings,
  ScrollText,
  Lightbulb,
  Scan,
  ScanEye,
  CalendarDays,
  Inbox,
  UsersRound,
  FolderOpen,
  Sparkles,
}

interface AppSidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function AppSidebar({ collapsed: controlledCollapsed, onToggle }: AppSidebarProps = {}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const handleToggle = onToggle ?? (() => setInternalCollapsed((prev) => !prev))
  const pathname = usePathname()
  const { currentRole } = useRole()

  // Falls back to [] for any future role missing a nav definition. The TS
  // exhaustiveness check on `Record<UserRole, ...>` in constants.ts should
  // catch the omission at build time, but this guards runtime regardless.
  const navItems = SIDEBAR_NAV[currentRole] ?? []

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex h-full flex-col premium-sidebar transition-all duration-300 ease-in-out',
          collapsed ? 'w-17' : 'w-64'
        )}
      >
        {/* Logo / Branding + Collapse toggle */}
        <div className={cn('flex h-14 shrink-0 items-center px-3', collapsed ? 'flex-col justify-center gap-1.5' : 'justify-between gap-2')}>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 via-teal-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-teal-500/30">
              V
            </span>
            {!collapsed && (
              <span className="bg-linear-to-r from-teal-700 to-blue-700 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-teal-300 dark:to-blue-300">
                Vaidix
                <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggle}
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>

        <div className="mx-3 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />

        {/* Navigation */}
        <ScrollArea className="flex-1 overflow-hidden py-3">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon]
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-linear-to-r from-teal-500/15 via-teal-500/10 to-transparent text-teal-700 shadow-sm dark:from-teal-400/20 dark:via-teal-400/10 dark:text-teal-300'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  {/* Active accent strip */}
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-linear-to-b from-teal-500 to-blue-500" />
                  )}
                  {Icon && (
                    <Icon
                      className={cn(
                        'size-4.5 shrink-0 transition-all',
                        isActive
                          ? 'text-teal-600 drop-shadow-sm dark:text-teal-300'
                          : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                      )}
                    />
                  )}
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-semibold"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger className="w-full">
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <div key={item.href}>
                  {linkContent}
                </div>
              )
            })}
          </nav>
        </ScrollArea>

      </aside>
    </TooltipProvider>
  )
}
