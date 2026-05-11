'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRole } from '@/contexts/role-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  PageTransition,
  StaggerItem,
  AnimatedCounter,
  AnimatedBar,
  AnimatedRing,
  PulseDot,
  Shimmer,
  motion,
} from '@/lib/motion'
import {
  BookOpen,
  Brain,
  Heart,
  Hand,
  Calendar,
  Clock,
  RotateCcw,
  ArrowRight,
  Users,
  FileText,
  ClipboardCheck,
  BarChart3,
  GraduationCap,
  AlertTriangle,
  Milestone,
  Shield,
  Video,
  HardDrive,
  Activity,
  Wifi,
  UserPlus,
  Database,
  ChevronRight,
  Star,
  MessageSquare,
  Stethoscope,
  Eye,
  Sparkles,
  Zap,
  Target,
  Flame,
  TrendingUp,
  CheckCircle2,
  PlayCircle,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Shared dashboard data hook — fetches /api/dashboard/me once per page load.
// The endpoint returns a discriminated union keyed by role; each role panel
// narrows on `snap.role` and unpacks `snap.data`.
// ---------------------------------------------------------------------------

interface ResidentSnap {
  role: 'RESIDENT'
  data: {
    stats: { coursesInProgress: number; modulesCompleted: number; hoursThisMonth: number; dayStreak: number; casesThisMonth: number }
    myCourses: Array<{ id: string; title: string; href: string; module: string; progress: number; modulesDone: number; modulesTotal: number; lastStudied: string; accent: string }>
    completedModules: Array<{ id: string; title: string; topic: string; completedOn: string; durationMin: number }>
  }
}
interface FacultySnap {
  role: 'FACULTY'
  data: {
    stats: { activeLearners: number; casesAuthored: number; assessmentsThisWeek: number; avgCohortScore: number }
    cohortLearners: Array<{ id: string; name: string; head: number; heart: number; hands: number; lastActive: string }>
    recentConversations: Array<{ id: string; learner: string; caseTitle: string; summary: string; date: string; headScore: number | null; heartScore: number | null }>
  }
}
interface PdSnap {
  role: 'PROGRAM_DIRECTOR'
  data: {
    stats: { totalResidents: number; onTrack: number; attention: number; milestonesDue: number }
    epaMatrix: { residents: Array<{ residentId: string; residentName: string; levels: Record<string, number> }>; epaLabels: Array<{ code: string; label: string }> }
    upcomingMilestones: Array<{ name: string; milestone: string; date: string; status: 'on_track' | 'attention' }>
    accreditation: { documentationCompletenessPct: number; epaPct: number; facultyEvalPct: number; caseLogsPct: number } | null
  }
}
interface AdminSnap {
  role: 'ADMIN'
  data: {
    stats: { totalUsers: number; activeCases: number; storage: string | null; uptime: string | null }
    recentActivity: Array<{ id: string; action: string; details: string; time: string; success: boolean; actor: string }>
  }
}
interface ExternalSnap { role: 'EXTERNAL_LEARNER'; data: Record<string, never> }

type DashboardSnap = ResidentSnap | FacultySnap | PdSnap | AdminSnap | ExternalSnap

function useDashboardSnap<T extends DashboardSnap['role']>(forRole: T) {
  type Narrowed = Extract<DashboardSnap, { role: T }>
  const [snap, setSnap] = useState<Narrowed['data'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/me')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.ok && j.data?.role === forRole) {
          // `Narrowed['data']` is a union when T is a generic, which leaves
          // `SetStateAction<Narrowed['data'] | null>` requiring an
          // intersection of every branch — impossible to satisfy from a
          // single JSON shape. The runtime guard above (`role === forRole`)
          // proves which branch is live; loosen the setter type to bypass.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(setSnap as (v: unknown) => void)(j.data.data)
        }
      })
      .catch(() => { /* silent — empty state covers it */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [forRole])

  return { snap, loading }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => !part.startsWith('Dr.'))
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Greeting Banner
// ---------------------------------------------------------------------------

function GreetingBanner({
  name,
  subtitle,
  quote,
}: {
  name: string
  subtitle?: string
  quote?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary/90 via-primary to-teal-700 px-6 py-7 text-primary-foreground shadow-lg shadow-primary/20 dark:from-primary/70 dark:via-primary/60 dark:to-teal-800"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 size-32 rounded-full bg-white/5" />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute right-20 top-4 size-24 rounded-full bg-white/10 blur-xl"
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="size-6" />
            </div>
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {getGreeting()}, {name}
            </h1>
            <p className="mt-0.5 text-sm text-primary-foreground/80">{getFormattedDate()}</p>
          </div>
        </div>
        {subtitle && <p className="mt-2 text-sm text-primary-foreground/70">{subtitle}</p>}
        {quote && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-4 max-w-xl border-l-2 border-white/20 pl-3 text-sm italic text-primary-foreground/60"
          >
            &ldquo;{quote}&rdquo;
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

// ===========================================================================
// RESIDENT DASHBOARD
// Student-centric: Welcome → Stats → Course details + Calendar →
// Completed modules → Quick links. No HHH scores, no 3H labels.
// ===========================================================================

function ResidentDashboard() {
  const { currentUser } = useRole()
  const firstName = currentUser.name.replace(/^Dr\.\s+/, '').split(' ')[0]
  const { snap, loading } = useDashboardSnap('RESIDENT')

  const myCourses = snap?.myCourses ?? []
  const completedModules = snap?.completedModules ?? []

  const stats = useMemo<Array<{ label: string; value: number; icon: React.ElementType; accent: 'teal' | 'emerald' | 'blue' | 'orange'; trend: string }>>(() => {
    const s = snap?.stats
    return [
      { label: 'Courses in progress', value: s?.coursesInProgress ?? 0, icon: BookOpen,     accent: 'teal',    trend: s?.coursesInProgress ? `${s.coursesInProgress} active` : 'None enrolled yet' },
      { label: 'Modules completed',   value: s?.modulesCompleted  ?? 0, icon: CheckCircle2, accent: 'emerald', trend: s?.modulesCompleted ? 'Keep it up'    : 'Complete your first' },
      { label: 'Hours this month',    value: s?.hoursThisMonth    ?? 0, icon: Clock,        accent: 'blue',    trend: s?.casesThisMonth ? `${s.casesThisMonth} case${s.casesThisMonth === 1 ? '' : 's'} this month` : 'No cases this month' },
      { label: 'Day streak',          value: s?.dayStreak         ?? 0, icon: Flame,        accent: 'orange',  trend: (s?.dayStreak ?? 0) > 0 ? 'Keep it going' : 'Start your streak' },
    ]
  }, [snap])

  return (
    <PageTransition className="space-y-6">
      {/* Welcome banner — clean premium card, no big green bar */}
      <StaggerItem>
        <WelcomeBanner
          firstName={firstName}
          subtitle={`${currentUser.yearOfTraining ?? 'Resident'} · ${currentUser.department ?? 'Ophthalmology'}`}
        />
      </StaggerItem>

      {/* Quick actions — vivid resident toolkit */}
      <StaggerItem>
        <QuickActionStrip
          actions={[
            { label: 'Pearls',      hint: 'Faculty wisdom',     icon: Sparkles, href: '/pearls',     gradient: 'from-amber-500 via-orange-500 to-yellow-500', shadow: 'shadow-amber-500/30',  glow: 'bg-amber-400/20' },
            { label: 'Sign Atlas',  hint: 'Image reference',    icon: Eye,      href: '/atlas',      gradient: 'from-blue-500 via-cyan-500 to-sky-500',       shadow: 'shadow-blue-500/30',   glow: 'bg-blue-400/20' },
            { label: 'Journal',     hint: 'Reflect on cases',   icon: BookOpen, href: '/journal',    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500', shadow: 'shadow-violet-500/30', glow: 'bg-violet-400/20' },
            { label: 'Challenges',  hint: 'Test your skills',   icon: Target,   href: '/challenges', gradient: 'from-rose-500 via-pink-500 to-red-500',       shadow: 'shadow-rose-500/30',   glow: 'bg-rose-400/20' },
          ]}
        />
      </StaggerItem>

      {/* Stats row */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatTile key={s.label} {...s} delay={i * 0.05} />
          ))}
        </div>
      </StaggerItem>

      {/* Upcoming sessions — before courses, all residents see this */}
      <StaggerItem>
        <UniversalUpcoming showScheduleCta />
      </StaggerItem>

      {/* Course details */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4">
          {/* My courses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-teal-600 dark:text-teal-300" />
                My courses
              </CardTitle>
              <Link href="/topics" className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
                Browse all <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && myCourses.length === 0 && (
                <>
                  <Shimmer className="h-20 w-full" />
                  <Shimmer className="h-20 w-full" />
                </>
              )}
              {!loading && myCourses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <BookOpen className="mx-auto size-6 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium text-foreground">No courses enrolled yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Browse the catalog to enrol in a course.</p>
                  <Link href="/topics" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
                    Browse topics <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
              {myCourses.map((c, i) => (
                <Link key={c.id} href={c.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    whileHover={{ x: 3 }}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-teal-500/40 hover:shadow-md"
                  >
                    <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-border', accentBg(c.accent))}>
                      <BookOpen className={cn('size-5', accentText(c.accent))} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{c.lastStudied}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{c.module}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${c.progress}%` }}
                            transition={{ duration: 1, delay: 0.4 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                            className={cn('h-full rounded-full bg-linear-to-r', accentGradient(c.accent))}
                          />
                        </div>
                        <span className="w-12 text-right text-[11px] font-bold tabular-nums text-foreground">{c.progress}%</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {c.modulesDone} of {c.modulesTotal} modules complete
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </motion.div>
                </Link>
              ))}
            </CardContent>
          </Card>

        </div>
      </StaggerItem>

      {/* Activity feed — new comments, content, mentions */}
      <StaggerItem>
        <ActivityFeed limit={6} title="What's new for you" />
      </StaggerItem>

      {/* Completed modules */}
      <StaggerItem>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-emerald-600 dark:text-emerald-300" />
              Recently completed
            </CardTitle>
            <span className="text-xs text-muted-foreground">{completedModules.length} this week</span>
          </CardHeader>
          <CardContent>
            {loading && completedModules.length === 0 && (
              <Shimmer className="h-16 w-full" />
            )}
            {!loading && completedModules.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No completed modules yet — finish a course to see it here.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {completedModules.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-emerald-500/40 hover:shadow-sm"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.topic} · {m.durationMin} min · {m.completedOn}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

    </PageTransition>
  )
}

// ---------------------------------------------------------------------------
// Welcome banner — premium glass card, gradient sweep instead of green bar
// ---------------------------------------------------------------------------

function WelcomeBanner({ firstName, subtitle }: { firstName: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Subtle gradient sweep — premium without screaming */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-teal-500/8 via-transparent to-blue-500/8" />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-teal-500/10 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-blue-500/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500/20 to-blue-500/15 ring-1 ring-teal-500/30">
            <Sparkles className="size-6 text-teal-600 dark:text-teal-300" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {getFormattedDate()}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/topics">
            <Button className="gap-2 bg-linear-to-r from-teal-600 to-blue-600 text-white shadow-md shadow-teal-500/25 hover:from-teal-600 hover:to-blue-700">
              <PlayCircle className="size-4" />
              Resume learning
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Stat tile — premium clean tile with mini sparkline
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  delay,
}: {
  label: string
  value: number
  icon: React.ElementType
  accent: 'teal' | 'emerald' | 'blue' | 'orange'
  trend: string
  delay: number
}) {
  const accentMap = {
    teal:    { iconBg: 'from-teal-500 via-emerald-500 to-cyan-500',       cardBg: 'from-teal-500/8 via-card to-card',    glow: 'bg-teal-400/20',    bar: 'from-teal-400 to-emerald-500',     shadow: 'shadow-teal-500/20' },
    emerald: { iconBg: 'from-emerald-500 via-green-500 to-lime-500',      cardBg: 'from-emerald-500/8 via-card to-card', glow: 'bg-emerald-400/20', bar: 'from-emerald-400 to-green-500',    shadow: 'shadow-emerald-500/20' },
    blue:    { iconBg: 'from-blue-500 via-cyan-500 to-sky-500',           cardBg: 'from-blue-500/8 via-card to-card',    glow: 'bg-blue-400/20',    bar: 'from-blue-400 to-cyan-500',        shadow: 'shadow-blue-500/20' },
    orange:  { iconBg: 'from-orange-500 via-amber-500 to-yellow-500',     cardBg: 'from-orange-500/8 via-card to-card',  glow: 'bg-orange-400/20',  bar: 'from-orange-400 to-amber-500',     shadow: 'shadow-orange-500/20' },
  }
  const a = accentMap[accent]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
    >
      <Card className={cn('relative h-full overflow-hidden bg-linear-to-br transition-shadow hover:shadow-lg', a.cardBg, a.shadow)}>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
          className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl', a.glow)}
        />
        <CardContent className="relative pt-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">
                <AnimatedCounter value={value} />
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{trend}</p>
            </div>
            <div className={cn('flex size-11 items-center justify-center rounded-xl bg-linear-to-br shadow-md', a.iconBg, a.shadow)}>
              <Icon className="size-5 text-white drop-shadow" />
            </div>
          </div>
          {/* Decorative micro sparkline */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1.2, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn('h-full rounded-full bg-linear-to-r shadow-sm', a.bar)}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Upcoming calendar — schedule-style list with day chips
// ---------------------------------------------------------------------------

interface Training {
  id: string
  title: string
  day: string
  time: string
  startsAt: string
  faculty: string
  type: string
  isLive: boolean
  accent: string
}

function useUpcomingSessions() {
  const [sessions, setSessions] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/upcoming')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.ok && Array.isArray(j.data?.trainings)) setSessions(j.data.trainings)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { sessions, loading }
}

// Live countdown to a future ISO timestamp — updates every second
function SessionCountdown({ startsAt }: { startsAt: string }) {
  const [diff, setDiff] = useState(() => new Date(startsAt).getTime() - Date.now())
  useEffect(() => {
    const id = setInterval(() => setDiff(new Date(startsAt).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [startsAt])
  if (diff <= 0) return <span className="font-bold text-red-500">Live now</span>
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h >= 24) {
    const days = Math.floor(h / 24)
    return <span className="font-bold tabular-nums">{days}d {h % 24}h</span>
  }
  if (h > 0) return <span className="font-bold tabular-nums">{h}h {m}m</span>
  return <span className="font-bold tabular-nums text-amber-500">{m}m {s}s</span>
}

// ---------------------------------------------------------------------------
// UniversalUpcoming — full-width sessions strip used by all roles
// ---------------------------------------------------------------------------

function UniversalUpcoming({ showScheduleCta = false }: { showScheduleCta?: boolean }) {
  const { sessions, loading } = useUpcomingSessions()
  const next = sessions[0]
  const rest = sessions.slice(1)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="size-4 text-teal-600 dark:text-teal-300" />
          Upcoming sessions
        </CardTitle>
        <div className="flex items-center gap-2">
          {!loading && <span className="text-xs text-muted-foreground">{sessions.length} scheduled</span>}
          {showScheduleCta && (
            <Link href="/calendar/new">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                <Calendar className="size-3" /> Schedule
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="space-y-2">
            <Shimmer className="h-20 w-full" />
            <Shimmer className="h-14 w-full" />
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-teal-500/10">
              <Calendar className="size-6 text-teal-600 dark:text-teal-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No sessions scheduled</p>
              <p className="text-xs text-muted-foreground">Nothing in the next 30 days</p>
            </div>
            {showScheduleCta && (
              <Link href="/calendar/new">
                <Button size="sm" className="gap-2 bg-linear-to-r from-teal-600 to-blue-600 text-white">
                  <Calendar className="size-3" /> Schedule a session
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Hero next session */}
        {next && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-5',
              next.isLive
                ? 'border-red-500/40 bg-linear-to-br from-red-500/15 via-rose-500/10 to-orange-500/8 shadow-md shadow-red-500/20'
                : next.day === 'Today'
                  ? 'border-teal-500/40 bg-linear-to-br from-teal-500/15 via-emerald-500/10 to-cyan-500/8 shadow-md shadow-teal-500/20'
                  : 'border-violet-500/20 bg-linear-to-br from-violet-500/8 via-indigo-500/5 to-blue-500/5',
            )}
          >
            {/* Decorative animated blob */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className={cn(
                'pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl',
                next.isLive ? 'bg-red-400/30' : next.day === 'Today' ? 'bg-teal-400/30' : 'bg-violet-400/20',
              )}
            />
            {next.isLive && (
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-red-500/30"
              />
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {next.isLive ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1">
                      <PulseDot color="bg-red-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">Live now</span>
                    </div>
                  ) : next.day === 'Today' ? (
                    <span className="rounded-full bg-teal-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-600 dark:text-teal-400">Today</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{next.day}</span>
                  )}
                  <Badge variant="secondary" className="text-[10px]">{next.type}</Badge>
                </div>
                <p className="mt-2 text-base font-bold text-foreground">{next.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="size-3" />{next.time}</span>
                  <span>·</span>
                  <span>{next.faculty}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {next.isLive ? 'happening' : 'starts in'}
                </p>
                <div className="mt-0.5 text-xl">
                  {next.isLive ? (
                    <span className="font-bold text-red-500">Now</span>
                  ) : (
                    <SessionCountdown startsAt={next.startsAt} />
                  )}
                </div>
                {next.isLive && (
                  <Link href={`/classroom`}>
                    <Button size="sm" className="mt-2 h-7 gap-1 bg-red-500 text-white hover:bg-red-600">
                      <PlayCircle className="size-3" /> Join
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Remaining sessions */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rest.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-teal-500/30 hover:shadow-sm"
              >
                <div className={cn('flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1.5 ring-1 ring-border', accentBg(t.accent))}>
                  <span className={cn('text-[9px] font-bold uppercase', accentText(t.accent))}>{t.day.split(' ')[0]}</span>
                  <span className={cn('text-xs font-bold', accentText(t.accent))}>{t.day.split(' ')[1] ?? t.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="size-2.5" />{t.time}
                    <span>·</span><span className="truncate">{t.faculty}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[9px]">{t.type}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ResidentRadar — visual cards for faculty cohort overview
// ---------------------------------------------------------------------------

function scoreRing(avg: number): string {
  if (avg === 0) return 'ring-muted-foreground/30'
  if (avg < 40)  return 'ring-red-500'
  if (avg < 65)  return 'ring-amber-500'
  return 'ring-emerald-500'
}
function scoreRingBg(avg: number): string {
  if (avg === 0) return 'bg-linear-to-br from-muted/40 to-muted/20'
  if (avg < 40)  return 'bg-linear-to-br from-red-500/25 to-rose-500/10'
  if (avg < 65)  return 'bg-linear-to-br from-amber-500/25 to-orange-500/10'
  return 'bg-linear-to-br from-emerald-500/25 to-green-500/10'
}
function scoreCardBg(avg: number, idle: boolean): string {
  if (idle) return 'border-amber-500/40 bg-linear-to-br from-amber-500/8 via-card to-card'
  if (avg === 0) return 'border-border bg-card'
  if (avg < 40)  return 'border-red-500/30 bg-linear-to-br from-red-500/6 via-card to-card'
  if (avg < 65)  return 'border-amber-500/30 bg-linear-to-br from-amber-500/6 via-card to-card'
  return 'border-emerald-500/30 bg-linear-to-br from-emerald-500/6 via-card to-card'
}
function idleWarning(lastActive: string): boolean {
  return lastActive.includes('week') || lastActive.includes('month') || lastActive.includes('ago') && parseInt(lastActive) >= 7
}

function ResidentRadar({
  learners,
  loading,
}: {
  learners: Array<{ id: string; name: string; head: number; heart: number; hands: number; lastActive: string }>
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Resident radar
        </CardTitle>
        <Link href="/faculty/cohort" className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
          Full view <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <Shimmer key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        )}
        {!loading && learners.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center">
            <Users className="mx-auto size-6 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground">No residents assigned yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Add residents to your cohort to track progress</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {learners.map((l, i) => {
            const avg = Math.round((l.head + l.heart + l.hands) / 3)
            const idle = idleWarning(l.lastActive)
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 200 }}
                whileHover={{ y: -3, scale: 1.03 }}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all hover:shadow-lg',
                  scoreCardBg(avg, idle),
                )}
              >
                {idle && (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-amber-500 shadow-md shadow-amber-500/50"
                  >
                    <AlertTriangle className="size-3 text-white" />
                  </motion.div>
                )}
                <div className={cn('relative flex size-14 items-center justify-center rounded-full ring-[3px] shadow-md', scoreRingBg(avg), scoreRing(avg))}>
                  <span className="text-base font-bold text-foreground">{getInitials(l.name)}</span>
                  {avg >= 65 && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      className="pointer-events-none absolute -inset-1 rounded-full"
                      style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.4) 25%, transparent 50%)' }}
                    />
                  )}
                </div>
                <div className="w-full">
                  <p className="truncate text-xs font-semibold text-foreground">{l.name.replace(/^Dr\.\s+/, '')}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{l.lastActive}</p>
                </div>
                <div className="flex w-full items-center justify-center gap-2">
                  {[
                    { label: 'H', value: l.head,  color: 'bg-blue-500' },
                    { label: 'Ht', value: l.heart, color: 'bg-rose-500' },
                    { label: 'Hn', value: l.hands, color: 'bg-emerald-500' },
                  ].map((bar) => (
                    <div key={bar.label} className="flex flex-col items-center gap-0.5">
                      <div className="flex h-8 w-4 items-end overflow-hidden rounded-sm bg-muted">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${bar.value}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          className={cn('w-full rounded-sm', bar.color)}
                        />
                      </div>
                      <span className="text-[8px] font-bold text-muted-foreground">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// BoldStatCard — vivid gradient stat tile used by Faculty/PD/Admin sections
// ---------------------------------------------------------------------------

type StatTone = 'teal' | 'blue' | 'amber' | 'purple' | 'emerald' | 'rose'

const STAT_TONES: Record<StatTone, { iconBg: string; cardBg: string; glow: string; bar: string; shadow: string }> = {
  teal:    { iconBg: 'from-teal-500 via-emerald-500 to-cyan-500',       cardBg: 'from-teal-500/8 via-card to-card',    glow: 'bg-teal-400/20',    bar: 'from-teal-400 to-emerald-500',     shadow: 'shadow-teal-500/20' },
  blue:    { iconBg: 'from-blue-500 via-cyan-500 to-sky-500',           cardBg: 'from-blue-500/8 via-card to-card',    glow: 'bg-blue-400/20',    bar: 'from-blue-400 to-cyan-500',        shadow: 'shadow-blue-500/20' },
  amber:   { iconBg: 'from-amber-500 via-orange-500 to-yellow-500',     cardBg: 'from-amber-500/8 via-card to-card',   glow: 'bg-amber-400/20',   bar: 'from-amber-400 to-orange-500',     shadow: 'shadow-amber-500/20' },
  purple:  { iconBg: 'from-violet-500 via-purple-500 to-fuchsia-500',   cardBg: 'from-violet-500/8 via-card to-card',  glow: 'bg-violet-400/20',  bar: 'from-violet-400 to-fuchsia-500',   shadow: 'shadow-violet-500/20' },
  emerald: { iconBg: 'from-emerald-500 via-green-500 to-lime-500',      cardBg: 'from-emerald-500/8 via-card to-card', glow: 'bg-emerald-400/20', bar: 'from-emerald-400 to-green-500',    shadow: 'shadow-emerald-500/20' },
  rose:    { iconBg: 'from-rose-500 via-pink-500 to-red-500',           cardBg: 'from-rose-500/8 via-card to-card',    glow: 'bg-rose-400/20',    bar: 'from-rose-400 to-pink-500',        shadow: 'shadow-rose-500/20' },
}

function BoldStatCard({
  title,
  value,
  icon: Icon,
  tone,
  delay = 0,
  animated = true,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  tone: StatTone
  delay?: number
  animated?: boolean
}) {
  const t = STAT_TONES[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
    >
      <Card className={cn('relative h-full overflow-hidden bg-linear-to-br transition-shadow hover:shadow-lg', t.cardBg, t.shadow)}>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
          className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl', t.glow)}
        />
        <CardContent className="relative pt-1">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
              <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">
                {animated && typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
              </p>
            </div>
            <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-md', t.iconBg, t.shadow)}>
              <Icon className="size-5 text-white drop-shadow" />
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1.2, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn('h-full rounded-full bg-linear-to-r', t.bar)}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// QuickActionStrip — vivid gradient action cards, used by every role
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string
  hint: string
  icon: React.ElementType
  href: string
  gradient: string
  shadow: string
  glow: string
}

function QuickActionStrip({ actions }: { actions: QuickAction[] }) {
  const cols = actions.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
  return (
    <div className={cn('grid grid-cols-1 gap-4', cols)}>
      {actions.map((a, i) => (
        <Link key={a.label} href={a.href}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 200 }}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'group relative overflow-hidden rounded-2xl bg-linear-to-br p-[1.5px] shadow-lg transition-all hover:shadow-xl',
              a.gradient,
              a.shadow,
            )}
          >
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
              className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl', a.glow)}
            />
            <div className="relative flex items-center gap-3 rounded-[15px] bg-card/90 p-4 backdrop-blur-sm">
              <div className={cn('flex size-12 items-center justify-center rounded-xl bg-linear-to-br shadow-md', a.gradient, a.shadow)}>
                <a.icon className="size-6 text-white drop-shadow" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{a.label}</p>
                <p className="text-[11px] text-muted-foreground">{a.hint}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityFeed — recent notifications (comments, new content, assignments)
// ---------------------------------------------------------------------------

interface NotifItem {
  id: string
  kind: string
  title: string
  body: string | null
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day}d ago`
  if (day < 30) return `${Math.round(day / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function iconForKind(kind: string): { Icon: React.ElementType; color: string; bg: string; ring: string } {
  if (kind.startsWith('comment') || kind.includes('feedback') || kind.includes('reply'))
    return { Icon: MessageSquare, color: 'text-blue-500',    bg: 'bg-linear-to-br from-blue-500/15 to-cyan-500/10',   ring: 'ring-blue-500/30' }
  if (kind.startsWith('session') || kind.includes('schedule') || kind.includes('classroom'))
    return { Icon: Calendar,      color: 'text-teal-500',    bg: 'bg-linear-to-br from-teal-500/15 to-emerald-500/10',ring: 'ring-teal-500/30' }
  if (kind.startsWith('pearl') || kind.includes('wisdom'))
    return { Icon: Sparkles,      color: 'text-amber-500',   bg: 'bg-linear-to-br from-amber-500/15 to-orange-500/10',ring: 'ring-amber-500/30' }
  if (kind.startsWith('case') || kind.includes('study') || kind.includes('material') || kind.includes('document'))
    return { Icon: FileText,      color: 'text-purple-500',  bg: 'bg-linear-to-br from-purple-500/15 to-fuchsia-500/10', ring: 'ring-purple-500/30' }
  if (kind.includes('approval') || kind.includes('approved'))
    return { Icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-linear-to-br from-emerald-500/15 to-green-500/10', ring: 'ring-emerald-500/30' }
  if (kind.includes('assessment') || kind.includes('dops') || kind.includes('cex'))
    return { Icon: Stethoscope,   color: 'text-rose-500',    bg: 'bg-linear-to-br from-rose-500/15 to-pink-500/10',   ring: 'ring-rose-500/30' }
  if (kind.includes('mention') || kind.includes('tag'))
    return { Icon: Star,          color: 'text-violet-500',  bg: 'bg-linear-to-br from-violet-500/15 to-indigo-500/10', ring: 'ring-violet-500/30' }
  return { Icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted/50', ring: 'ring-border' }
}

function ActivityFeed({ limit = 8, title = 'Recent activity' }: { limit?: number; title?: string }) {
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/notifications?limit=${limit}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.ok && Array.isArray(j.data?.items)) setItems(j.data.items)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [limit])

  return (
    <Card className="relative overflow-hidden">
      {/* Subtle background flair */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/3 via-transparent to-pink-500/3" />
      <CardHeader className="relative flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex size-7 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/20 to-pink-500/15 ring-1 ring-violet-500/20">
            <Activity className="size-4 text-violet-600 dark:text-violet-400" />
          </div>
          {title}
        </CardTitle>
        <Link href="/inbox" className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
          Inbox <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="relative space-y-2">
        {loading && <Shimmer className="h-16 w-full" />}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Sparkles className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">You're all caught up</p>
            <p className="text-xs text-muted-foreground">New comments, content, and assignments appear here</p>
          </div>
        )}
        {items.map((n, i) => {
          const { Icon, color, bg, ring } = iconForKind(n.kind)
          const unread = !n.readAt
          const content = (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ x: 3 }}
              className={cn(
                'group relative flex items-start gap-3 rounded-xl border p-3 transition-all',
                unread
                  ? 'border-violet-500/20 bg-linear-to-r from-violet-500/4 to-transparent hover:border-violet-500/40 hover:shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30',
              )}
            >
              {unread && (
                <span className="absolute right-3 top-3 size-2 rounded-full bg-violet-500 ring-2 ring-violet-500/30" />
              )}
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl ring-1', bg, ring)}>
                <Icon className={cn('size-5', color)} />
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn('truncate text-sm', unread ? 'font-bold text-foreground' : 'font-semibold text-foreground/90')}>
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>}
              </div>
            </motion.div>
          )
          return n.linkUrl ? (
            <Link key={n.id} href={n.linkUrl}>{content}</Link>
          ) : (
            <div key={n.id}>{content}</div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Accent helpers
// ---------------------------------------------------------------------------

function accentBg(accent: string): string {
  return {
    rose:   'bg-rose-500/10',
    orange: 'bg-orange-500/10',
    blue:   'bg-blue-500/10',
    teal:   'bg-teal-500/10',
    amber:  'bg-amber-500/10',
    purple: 'bg-purple-500/10',
  }[accent] ?? 'bg-muted'
}
function accentText(accent: string): string {
  return {
    rose:   'text-rose-600 dark:text-rose-300',
    orange: 'text-orange-600 dark:text-orange-300',
    blue:   'text-blue-600 dark:text-blue-300',
    teal:   'text-teal-600 dark:text-teal-300',
    amber:  'text-amber-600 dark:text-amber-300',
    purple: 'text-purple-600 dark:text-purple-300',
  }[accent] ?? 'text-foreground'
}
function accentGradient(accent: string): string {
  return {
    rose:   'from-rose-400 to-rose-600',
    orange: 'from-orange-400 to-orange-600',
    blue:   'from-blue-400 to-blue-600',
    teal:   'from-teal-400 to-teal-600',
    amber:  'from-amber-400 to-amber-600',
    purple: 'from-purple-400 to-purple-600',
  }[accent] ?? 'from-teal-400 to-teal-600'
}

// ===========================================================================
// FACULTY DASHBOARD
// ===========================================================================

function FacultyHero({
  name,
  subtitle,
  stats,
  nextSession,
}: {
  name: string
  subtitle?: string
  stats: { activeLearners: number; assessmentsThisWeek: number }
  nextSession: Training | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/6 via-transparent to-teal-500/6" />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-teal-500/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:flex-nowrap sm:px-8">
        {/* Left — identity */}
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-teal-500/15 ring-1 ring-primary/20">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{getFormattedDate()}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {getGreeting()}, {name}
            </h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* Right — live signals */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Active learners chip */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-teal-500/10">
              <Users className="size-3.5 text-teal-600 dark:text-teal-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Learners</p>
              <p className="text-sm font-bold tabular-nums text-foreground"><AnimatedCounter value={stats.activeLearners} /></p>
            </div>
          </motion.div>

          {/* Assessments chip */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.28 }}
            className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10">
              <ClipboardCheck className="size-3.5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assessments / 7d</p>
              <p className="text-sm font-bold tabular-nums text-foreground"><AnimatedCounter value={stats.assessmentsThisWeek} /></p>
            </div>
          </motion.div>

          {/* Next session countdown chip */}
          {nextSession && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.36 }}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2',
                nextSession.isLive
                  ? 'border-red-500/30 bg-red-500/8'
                  : nextSession.day === 'Today'
                    ? 'border-teal-500/30 bg-teal-500/8'
                    : 'border-border bg-muted/50',
              )}
            >
              <div className={cn('flex size-7 items-center justify-center rounded-lg', nextSession.isLive ? 'bg-red-500/15' : 'bg-primary/10')}>
                {nextSession.isLive ? <PulseDot color="bg-red-500" /> : <Calendar className="size-3.5 text-primary" />}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {nextSession.isLive ? 'Live now' : 'Next session'}
                </p>
                <div className="text-sm">
                  {nextSession.isLive ? (
                    <span className="font-bold text-red-500">Happening</span>
                  ) : (
                    <SessionCountdown startsAt={nextSession.startsAt} />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function FacultyDashboard() {
  const { currentUser } = useRole()
  const { snap, loading } = useDashboardSnap('FACULTY')
  const { sessions, loading: sessionsLoading } = useUpcomingSessions()

  const cohortLearners = snap?.cohortLearners ?? []
  const recentConversations = snap?.recentConversations ?? []
  const facultyStats = snap?.stats

  const nextSession = sessions[0] ?? null

  const facultySubtitle = currentUser.department
    ? `${currentUser.designation} · ${currentUser.department}`
    : currentUser.designation

  return (
    <PageTransition className="space-y-6">
      {/* Hero with live signals */}
      <StaggerItem>
        <FacultyHero
          name={currentUser.name.split(' ').slice(1).join(' ')}
          subtitle={facultySubtitle}
          stats={{ activeLearners: facultyStats?.activeLearners ?? 0, assessmentsThisWeek: facultyStats?.assessmentsThisWeek ?? 0 }}
          nextSession={sessionsLoading ? null : nextSession}
        />
      </StaggerItem>

      {/* Quick actions — vivid gradient action cards */}
      <StaggerItem>
        <QuickActionStrip
          actions={[
            { label: 'Record DOPS',     hint: 'Direct observation',    icon: Stethoscope, href: '/faculty/assess/dops', gradient: 'from-teal-500 via-emerald-500 to-cyan-500',   shadow: 'shadow-teal-500/30',   glow: 'bg-teal-400/20' },
            { label: 'Forge a Deck',    hint: 'AI-built presentation', icon: Sparkles,    href: '/faculty/decks/new',   gradient: 'from-amber-500 via-orange-500 to-rose-500',   shadow: 'shadow-amber-500/30', glow: 'bg-amber-400/20' },
            { label: 'Schedule Session',hint: 'Teaching & rounds',     icon: Calendar,    href: '/calendar/new',         gradient: 'from-violet-500 via-fuchsia-500 to-pink-500', shadow: 'shadow-violet-500/30',glow: 'bg-violet-400/20' },
          ]}
        />
      </StaggerItem>

      {/* Upcoming sessions — the pulse of the platform */}
      <StaggerItem>
        <UniversalUpcoming showScheduleCta />
      </StaggerItem>

      {/* Resident Radar + Activity Feed side by side */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ResidentRadar learners={cohortLearners} loading={loading} />
          <ActivityFeed limit={6} title="What's new" />
        </div>
      </StaggerItem>

      {/* Secondary stats row */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {([
            { title: 'Active Learners',  value: facultyStats?.activeLearners      ?? 0, icon: Users,          tone: 'teal'    as StatTone },
            { title: 'Cases Authored',   value: facultyStats?.casesAuthored       ?? 0, icon: FileText,       tone: 'blue'    as StatTone },
            { title: 'Assessments / 7d', value: facultyStats?.assessmentsThisWeek ?? 0, icon: ClipboardCheck, tone: 'amber'   as StatTone },
            { title: 'Avg Cohort Score', value: facultyStats?.avgCohortScore      ?? 0, icon: BarChart3,      tone: 'purple'  as StatTone },
          ]).map((s, i) => (
            <BoldStatCard key={s.title} title={s.title} value={s.value} icon={s.icon} tone={s.tone} delay={i * 0.06} />
          ))}
        </div>
      </StaggerItem>

      {/* Recent Conversations */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4 text-primary" />Recent AI conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && recentConversations.length === 0 && <Shimmer className="h-16 w-full" />}
            {!loading && recentConversations.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No recent AI conversations from your mentees.</p>
            )}
            {recentConversations.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                whileHover={{ x: 3 }}
                className="group flex items-start gap-4 rounded-xl border border-border/50 p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{c.learner}</p>
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                  <p className="text-xs font-medium text-primary">{c.caseTitle}</p>
                  {c.summary && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.summary}</p>}
                  {(c.headScore !== null || c.heartScore !== null) && (
                    <div className="mt-2 flex items-center gap-2">
                      {c.headScore !== null && <Badge variant="secondary" className="bg-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400">HEAD {c.headScore}</Badge>}
                      {c.heartScore !== null && <Badge variant="secondary" className="bg-rose-500/10 text-[10px] text-rose-600 dark:text-rose-400">HEART {c.heartScore}</Badge>}
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </StaggerItem>
    </PageTransition>
  )
}

// ===========================================================================
// PROGRAM DIRECTOR DASHBOARD
// ===========================================================================

function ProgramDirectorDashboard() {
  const { currentUser } = useRole()
  const { snap, loading } = useDashboardSnap('PROGRAM_DIRECTOR')

  const epaMatrix = snap?.epaMatrix
  const upcomingMilestones = snap?.upcomingMilestones ?? []
  const accreditation = snap?.accreditation
  const pdStats = snap?.stats

  const entrustmentColors: Record<number, string> = {
    1: 'bg-red-500/80 text-white',
    2: 'bg-orange-400/80 text-white',
    3: 'bg-amber-400/80 text-amber-900',
    4: 'bg-emerald-400/80 text-emerald-900',
    5: 'bg-emerald-600/90 text-white',
    0: 'bg-muted text-muted-foreground',
  }

  const statusBadge = { on_track: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', attention: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }

  const pdSubtitle = currentUser.department
    ? `${currentUser.designation} · ${currentUser.department}`
    : currentUser.designation

  return (
    <PageTransition className="space-y-6">
      <StaggerItem>
        <GreetingBanner name={currentUser.name.split(' ').slice(1).join(' ')} subtitle={pdSubtitle} quote={
          pdStats && pdStats.totalResidents > 0
            ? `${pdStats.totalResidents} residents · ${pdStats.onTrack} on track${pdStats.attention > 0 ? ` · ${pdStats.attention} need attention` : ''}`
            : undefined
        } />
      </StaggerItem>

      {/* Quick actions — PD toolkit */}
      <StaggerItem>
        <QuickActionStrip
          actions={[
            { label: 'Cohort Analytics',hint: 'Drill into EPAs',       icon: BarChart3,   href: '/faculty/cohort',     gradient: 'from-teal-500 via-emerald-500 to-cyan-500',   shadow: 'shadow-teal-500/30',   glow: 'bg-teal-400/20' },
            { label: 'Approvals',       hint: 'Pending workflow',      icon: ClipboardCheck, href: '/inbox/approvals', gradient: 'from-amber-500 via-orange-500 to-rose-500',   shadow: 'shadow-amber-500/30',  glow: 'bg-amber-400/20' },
            { label: 'Schedule Session',hint: 'Teaching & rounds',     icon: Calendar,    href: '/calendar/new',         gradient: 'from-violet-500 via-fuchsia-500 to-pink-500', shadow: 'shadow-violet-500/30', glow: 'bg-violet-400/20' },
          ]}
        />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {([
            { title: 'Total Residents', value: pdStats?.totalResidents ?? 0, icon: Users,         tone: 'teal'    as StatTone },
            { title: 'On Track',        value: pdStats?.onTrack        ?? 0, icon: Star,          tone: 'emerald' as StatTone },
            { title: 'Needs Attention', value: pdStats?.attention      ?? 0, icon: AlertTriangle, tone: 'amber'   as StatTone },
            { title: 'Milestones Due',  value: pdStats?.milestonesDue  ?? 0, icon: Milestone,     tone: 'purple'  as StatTone },
          ]).map((s, i) => (
            <BoldStatCard key={s.title} title={s.title} value={s.value} icon={s.icon} tone={s.tone} delay={i * 0.06} />
          ))}
        </div>
      </StaggerItem>

      {/* Upcoming sessions */}
      <StaggerItem>
        <UniversalUpcoming showScheduleCta />
      </StaggerItem>

      {/* EPA Heatmap */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary" />EPA Entrustment Overview</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Shimmer className="h-32 w-full" />
            ) : !epaMatrix || epaMatrix.residents.length === 0 || epaMatrix.epaLabels.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No EPA records yet — assessments populate this matrix as they&apos;re recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="pb-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resident</th>
                      {epaMatrix.epaLabels.map((l) => (<th key={l.code} className="pb-3 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{l.label}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {epaMatrix.residents.map((r, ri) => (
                      <tr key={r.residentId}>
                        <td className="py-1.5 pr-4 text-sm font-medium text-foreground">{r.residentName}</td>
                        {epaMatrix.epaLabels.map((l, ci) => {
                          const level = r.levels[l.code] ?? 0
                          return (
                            <td key={l.code} className="p-1 text-center">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3 + ri * 0.05 + ci * 0.03, type: 'spring', stiffness: 300 }}
                                className={cn('mx-auto flex size-9 items-center justify-center rounded-lg text-xs font-bold', entrustmentColors[level])}
                              >{level === 0 ? '—' : level}</motion.div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Entrustment:</span>
              {[1, 2, 3, 4, 5].map((lvl) => (<div key={lvl} className="flex items-center gap-1"><div className={cn('size-4 rounded', entrustmentColors[lvl])} /><span>{lvl}</span></div>))}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Activity feed */}
      <StaggerItem>
        <ActivityFeed limit={8} title="Program activity" />
      </StaggerItem>

      {/* Milestones + Accreditation */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Milestone className="size-4 text-primary" />Upcoming Milestones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading && upcomingMilestones.length === 0 && <Shimmer className="h-12 w-full" />}
              {!loading && upcomingMilestones.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No upcoming milestones tracked yet.</p>
              )}
              {upcomingMilestones.map((m, i) => (
                <motion.div key={m.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40">
                  <Avatar className="size-8"><AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{getInitials(m.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.milestone}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className={cn('text-[10px]', statusBadge[m.status])}>{m.status === 'on_track' ? 'On Track' : 'Attention'}</Badge>
                    <span className="text-xs text-muted-foreground">{m.date}</span>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4 text-primary" />Accreditation Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Shimmer className="h-24 w-full" />
              ) : !accreditation ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <Shield className="mx-auto size-6 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium text-foreground">Accreditation tracking not yet configured</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Documentation, EPA, and faculty-evaluation rates will populate once the accreditation module ships.</p>
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Documentation Completeness</span>
                      <span className="text-sm font-bold tabular-nums text-primary">{accreditation.documentationCompletenessPct}%</span>
                    </div>
                    <AnimatedBar value={accreditation.documentationCompletenessPct} barClassName="bg-linear-to-r from-primary to-teal-400" className="h-3" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'EPA',          value: accreditation.epaPct,         good: accreditation.epaPct         >= 80 },
                      { label: 'Faculty Eval', value: accreditation.facultyEvalPct, good: accreditation.facultyEvalPct >= 80 },
                      { label: 'Case Logs',    value: accreditation.caseLogsPct,    good: accreditation.caseLogsPct    >= 80 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className={cn('mt-1 text-xl font-bold tabular-nums', item.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                          <AnimatedCounter value={item.value} suffix="%" />
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerItem>
    </PageTransition>
  )
}

// ===========================================================================
// ADMIN DASHBOARD
// ===========================================================================

function AdminDashboard() {
  const { currentUser } = useRole()
  const { snap, loading } = useDashboardSnap('ADMIN')

  // Map audit eventType prefixes to icons. Unknown types fall back to Activity.
  const iconForAction = (eventType: string): React.ElementType => {
    if (eventType.startsWith('user.'))                                    return UserPlus
    if (eventType.startsWith('case.') || eventType.startsWith('document.')) return FileText
    if (eventType.startsWith('pearl.') || eventType.includes('knowledge'))  return Database
    if (eventType.startsWith('role.'))                                    return Shield
    if (eventType.startsWith('system.') || eventType.includes('backup'))   return HardDrive
    return Activity
  }
  const recentActivity = (snap?.recentActivity ?? []).map((a) => ({ ...a, icon: iconForAction(a.action) }))
  const adminStats = snap?.stats

  const adminSubtitle = currentUser.department
    ? `${currentUser.designation} · ${currentUser.department}`
    : currentUser.designation

  return (
    <PageTransition className="space-y-6">
      <StaggerItem><GreetingBanner name={currentUser.name} subtitle={adminSubtitle} /></StaggerItem>

      {/* Quick actions — admin toolkit */}
      <StaggerItem>
        <QuickActionStrip
          actions={[
            { label: 'Users',          hint: 'Manage accounts',     icon: UserPlus,     href: '/admin/users',           gradient: 'from-teal-500 via-emerald-500 to-cyan-500',   shadow: 'shadow-teal-500/30',   glow: 'bg-teal-400/20' },
            { label: 'Knowledge Base', hint: 'Upload references',   icon: Database,     href: '/admin/knowledge-base',  gradient: 'from-amber-500 via-orange-500 to-rose-500',   shadow: 'shadow-amber-500/30',  glow: 'bg-amber-400/20' },
            { label: 'Institution',    hint: 'Configure programs',  icon: GraduationCap,href: '/admin/institution',     gradient: 'from-violet-500 via-fuchsia-500 to-pink-500', shadow: 'shadow-violet-500/30', glow: 'bg-violet-400/20' },
          ]}
        />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {([
            { title: 'Total Users',  value: adminStats?.totalUsers  ?? 0,   icon: Users,     tone: 'teal'    as StatTone, animated: true  },
            { title: 'Active Cases', value: adminStats?.activeCases ?? 0,   icon: BookOpen,  tone: 'blue'    as StatTone, animated: true  },
            { title: 'Storage',      value: adminStats?.storage     ?? '—', icon: HardDrive, tone: 'amber'   as StatTone, animated: false },
            { title: 'Uptime',       value: adminStats?.uptime      ?? '—', icon: Wifi,      tone: 'emerald' as StatTone, animated: false },
          ]).map((s, i) => (
            <BoldStatCard key={s.title} title={s.title} value={s.value} icon={s.icon} tone={s.tone} delay={i * 0.06} animated={s.animated} />
          ))}
        </div>
      </StaggerItem>

      <StaggerItem>
        <UniversalUpcoming showScheduleCta />
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {loading && recentActivity.length === 0 && <Shimmer className="h-12 w-full" />}
            {!loading && recentActivity.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No recent activity recorded.</p>
            )}
            {recentActivity.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
                <div className="flex items-center gap-4 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/40">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', a.success ? 'bg-muted' : 'bg-rose-500/10')}>
                    <a.icon className={cn('size-4', a.success ? 'text-muted-foreground' : 'text-rose-500')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.action}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.details}{a.actor && a.actor !== 'system' ? ` · by ${a.actor}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.time}</span>
                </div>
                {i < recentActivity.length - 1 && <Separator />}
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </StaggerItem>

    </PageTransition>
  )
}

// ===========================================================================
// EXTERNAL LEARNER DASHBOARD
// Slim view for invited guests (visiting fellows, alumni, conference
// attendees). No DOPS / EPA / cohort-analytics widgets — they don't have
// records on those tables. Surfaces sessions, cases, pearls, atlas.
// ===========================================================================

function ExternalLearnerDashboard() {
  const { currentUser } = useRole()
  const firstName = currentUser.name.replace(/^Dr\.\s+/, '').split(' ')[0]
  const subtitle = currentUser.department ?? 'Invited learner · LVPEI'

  return (
    <PageTransition className="space-y-6">
      <StaggerItem>
        <WelcomeBanner firstName={firstName} subtitle={subtitle} />
      </StaggerItem>

      {/* Quick actions — external learner library */}
      <StaggerItem>
        <QuickActionStrip
          actions={[
            { label: 'Browse Cases',  hint: 'Clinical scenarios',  icon: BookOpen,  href: '/cases',     gradient: 'from-teal-500 via-emerald-500 to-cyan-500',   shadow: 'shadow-teal-500/30',   glow: 'bg-teal-400/20' },
            { label: 'Pearls',        hint: 'Faculty wisdom',      icon: Sparkles,  href: '/pearls',    gradient: 'from-amber-500 via-orange-500 to-yellow-500', shadow: 'shadow-amber-500/30',  glow: 'bg-amber-400/20' },
            { label: 'Signs Atlas',   hint: 'Image library',       icon: Eye,       href: '/atlas',     gradient: 'from-violet-500 via-purple-500 to-fuchsia-500', shadow: 'shadow-violet-500/30', glow: 'bg-violet-400/20' },
            { label: 'Live Sessions', hint: 'Grand rounds',        icon: Video,     href: '/classroom', gradient: 'from-rose-500 via-pink-500 to-red-500',       shadow: 'shadow-rose-500/30',   glow: 'bg-rose-400/20' },
          ]}
        />
      </StaggerItem>

      <StaggerItem>
        <UniversalUpcoming />
      </StaggerItem>
    </PageTransition>
  )
}

// ===========================================================================
// MAIN
// ===========================================================================

export default function DashboardPage() {
  const { currentRole } = useRole()

  // Exhaustive switch over UserRole — the `never` fallthrough makes TS error
  // at build time if a new role is added to the union without a branch here.
  switch (currentRole) {
    case 'resident':         return <ResidentDashboard />
    case 'faculty':          return <FacultyDashboard />
    case 'program_director': return <ProgramDirectorDashboard />
    case 'admin':            return <AdminDashboard />
    case 'external_learner': return <ExternalLearnerDashboard />
    default: {
      const _exhaustive: never = currentRole
      void _exhaustive
      return <ResidentDashboard />
    }
  }
}
