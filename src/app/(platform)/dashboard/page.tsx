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
  HoverCard,
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
  Lightbulb,
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
        if (j?.ok && j.data?.role === forRole) setSnap(j.data.data as Narrowed['data'])
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

      {/* Stats row */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatTile key={s.label} {...s} delay={i * 0.05} />
          ))}
        </div>
      </StaggerItem>

      {/* Course details + Calendar */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
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

          {/* Calendar */}
          <UpcomingCalendar />
        </div>
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

      {/* Quick links */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Pearls',     href: '/pearls',     icon: Sparkles, color: 'text-amber-500',  bg: 'bg-amber-500/10' },
            { label: 'Sign Atlas', href: '/atlas',      icon: Eye,      color: 'text-blue-500',   bg: 'bg-blue-500/10' },
            { label: 'Journal',    href: '/journal',    icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Challenges', href: '/challenges', icon: Target,   color: 'text-rose-500',   bg: 'bg-rose-500/10' },
          ].map((item, i) => (
            <Link key={item.label} href={item.href}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-all hover:border-teal-500/40 hover:shadow-md"
              >
                <div className={cn('flex size-11 items-center justify-center rounded-xl ring-1 ring-border', item.bg)}>
                  <item.icon className={cn('size-5', item.color)} />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
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
    teal:    { bg: 'bg-teal-500/10',    color: 'text-teal-600 dark:text-teal-300',    bar: 'from-teal-400 to-teal-600',       ring: 'ring-teal-500/20' },
    emerald: { bg: 'bg-emerald-500/10', color: 'text-emerald-600 dark:text-emerald-300', bar: 'from-emerald-400 to-emerald-600', ring: 'ring-emerald-500/20' },
    blue:    { bg: 'bg-blue-500/10',    color: 'text-blue-600 dark:text-blue-300',    bar: 'from-blue-400 to-blue-600',       ring: 'ring-blue-500/20' },
    orange:  { bg: 'bg-orange-500/10',  color: 'text-orange-600 dark:text-orange-300', bar: 'from-orange-400 to-orange-600',   ring: 'ring-orange-500/20' },
  }
  const a = accentMap[accent]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="relative h-full overflow-hidden">
        <CardContent className="pt-1">
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
            <div className={cn('flex size-11 items-center justify-center rounded-xl ring-1', a.bg, a.ring)}>
              <Icon className={cn('size-5', a.color)} />
            </div>
          </div>
          {/* Decorative micro sparkline */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1.2, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn('h-full rounded-full bg-linear-to-r', a.bar)}
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
  faculty: string
  type: string
  isLive: boolean
  accent: string
}

function UpcomingCalendar() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/upcoming')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.ok && Array.isArray(j.data?.trainings)) setTrainings(j.data.trainings)
      })
      .catch(() => { /* silent — empty state covers it */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="size-4 text-teal-600 dark:text-teal-300" />
          Upcoming schedule
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${trainings.length} session${trainings.length === 1 ? '' : 's'}`}
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!loading && trainings.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No upcoming sessions in the next 30 days.
          </p>
        )}
        {trainings.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06 }}
            className="group flex items-stretch gap-3 rounded-xl border border-border bg-card p-2.5 transition-all hover:border-teal-500/40 hover:shadow-sm"
          >
            {/* Day chip */}
            <div className={cn('flex w-14 shrink-0 flex-col items-center justify-center rounded-lg ring-1 ring-border', accentBg(t.accent))}>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide', accentText(t.accent))}>
                {t.day.split(' ')[0]}
              </span>
              <span className={cn('text-xs font-bold', accentText(t.accent))}>
                {t.day.split(' ')[1] ?? ''}
              </span>
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold text-foreground">{t.title}</p>
                {t.isLive && (
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5">
                    <PulseDot color="bg-red-500" />
                    <span className="text-[9px] font-bold text-red-600">LIVE</span>
                  </div>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Clock className="size-2.5" />{t.time}</span>
                <span>·</span>
                <span className="truncate">{t.faculty}</span>
              </div>
              <Badge variant="secondary" className="mt-1 text-[9px]">{t.type}</Badge>
            </div>
          </motion.div>
        ))}
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

function FacultyDashboard() {
  const { currentUser } = useRole()
  const { snap, loading } = useDashboardSnap('FACULTY')

  const cohortLearners = snap?.cohortLearners ?? []
  const recentConversations = snap?.recentConversations ?? []
  const facultyStats = snap?.stats

  const facultySubtitle = currentUser.department
    ? `${currentUser.designation} · ${currentUser.department}`
    : currentUser.designation

  return (
    <PageTransition className="space-y-6">
      <StaggerItem>
        <GreetingBanner name={currentUser.name.split(' ').slice(1).join(' ')} subtitle={facultySubtitle} />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { title: 'Active Learners',      value: facultyStats?.activeLearners      ?? 0, icon: Users,           color: 'text-teal-600',   bg: 'bg-teal-500/10' },
            { title: 'Cases Authored',       value: facultyStats?.casesAuthored       ?? 0, icon: FileText,        color: 'text-blue-500',   bg: 'bg-blue-500/10' },
            { title: 'Assessments / 7d',     value: facultyStats?.assessmentsThisWeek ?? 0, icon: ClipboardCheck,  color: 'text-amber-500',  bg: 'bg-amber-500/10' },
            { title: 'Avg Cohort Score',     value: facultyStats?.avgCohortScore      ?? 0, icon: BarChart3,       color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map((s) => (
            <HoverCard key={s.title}>
              <Card className="overflow-hidden">
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.title}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground"><AnimatedCounter value={s.value} /></p>
                    </div>
                    <div className={cn('flex size-11 items-center justify-center rounded-xl', s.bg)}>
                      <s.icon className={cn('size-5', s.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </HoverCard>
          ))}
        </div>
      </StaggerItem>

      {/* Cohort */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-primary" />Cohort Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_200px_100px] items-center gap-4 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Learner</span>
                <span className="text-center">HEAD / HEART / HANDS</span>
                <span className="text-right">Last Active</span>
              </div>
              <Separator />
              {loading && cohortLearners.length === 0 && <Shimmer className="h-12 w-full" />}
              {!loading && cohortLearners.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No mentees assigned yet — add residents to your cohort to see them here.</p>
              )}
              {cohortLearners.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="grid grid-cols-[1fr_200px_100px] items-center gap-4 rounded-lg px-1 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{getInitials(l.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      { v: l.head, color: 'bg-blue-500' },
                      { v: l.heart, color: 'bg-rose-500' },
                      { v: l.hands, color: 'bg-emerald-500' },
                    ].map((bar, bi) => (
                      <div key={bi} className="flex flex-1 items-center gap-1">
                        <AnimatedBar value={bar.v} barClassName={bar.color} className="h-1.5 flex-1" delay={0.4 + i * 0.06 + bi * 0.05} />
                        <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{bar.v}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-right text-xs text-muted-foreground">{l.lastActive}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Recent Conversations */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4 text-primary" />Recent AI Conversations</CardTitle>
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
                      {c.headScore !== null && <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">HEAD {c.headScore}</Badge>}
                      {c.heartScore !== null && <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">HEART {c.heartScore}</Badge>}
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Quick Actions */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Zap className="size-4 text-primary" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Record DOPS', icon: Stethoscope },
                { label: 'Record Mini-CEX', icon: ClipboardCheck },
                { label: 'Schedule Session', icon: Calendar },
              ].map((a) => (
                <motion.div key={a.label} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" className="gap-2"><a.icon className="size-4" />{a.label}</Button>
                </motion.div>
              ))}
            </div>
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
      <StaggerItem><GreetingBanner name={currentUser.name.split(' ').slice(1).join(' ')} subtitle={pdSubtitle} /></StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { title: 'Total Residents', value: pdStats?.totalResidents ?? 0, icon: Users,          color: 'text-teal-600',    bg: 'bg-teal-500/10' },
            { title: 'On Track',        value: pdStats?.onTrack        ?? 0, icon: Star,           color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { title: 'Needs Attention', value: pdStats?.attention      ?? 0, icon: AlertTriangle,  color: 'text-amber-500',   bg: 'bg-amber-500/10' },
            { title: 'Milestones Due',  value: pdStats?.milestonesDue  ?? 0, icon: Milestone,      color: 'text-purple-500',  bg: 'bg-purple-500/10' },
          ].map((s) => (
            <HoverCard key={s.title}>
              <Card className="overflow-hidden">
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.title}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground"><AnimatedCounter value={s.value} /></p>
                    </div>
                    <div className={cn('flex size-11 items-center justify-center rounded-xl', s.bg)}><s.icon className={cn('size-5', s.color)} /></div>
                  </div>
                </CardContent>
              </Card>
            </HoverCard>
          ))}
        </div>
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

      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { title: 'Total Users',  value: adminStats?.totalUsers  ?? 0,         icon: Users,    color: 'text-teal-600',    bg: 'bg-teal-500/10' },
            { title: 'Active Cases', value: adminStats?.activeCases ?? 0,         icon: BookOpen, color: 'text-blue-500',    bg: 'bg-blue-500/10' },
            { title: 'Storage',      value: adminStats?.storage     ?? '—',       icon: HardDrive,color: 'text-amber-500',   bg: 'bg-amber-500/10' },
            { title: 'Uptime',       value: adminStats?.uptime      ?? '—',       icon: Wifi,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          ].map((s) => (
            <HoverCard key={s.title}>
              <Card className="overflow-hidden">
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.title}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{s.value}</p>
                    </div>
                    <div className={cn('flex size-11 items-center justify-center rounded-xl', s.bg)}><s.icon className={cn('size-5', s.color)} /></div>
                  </div>
                </CardContent>
              </Card>
            </HoverCard>
          ))}
        </div>
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

      <StaggerItem>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { title: 'Institution', description: 'Configure departments and branding', icon: GraduationCap, href: '/admin/institution' },
            { title: 'Users', description: 'Manage faculty, residents, and roles', icon: Users, href: '/admin/users' },
            { title: 'Knowledge Base', description: 'Upload guidelines and references', icon: Database, href: '/admin/knowledge-base' },
          ].map((item, i) => (
            <Link key={item.title} href={item.href}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                whileHover={{ y: -3, scale: 1.01 }}
                className="group rounded-xl border border-border/50 bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><item.icon className="size-5 text-primary" /></div>
                <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight className="size-3" /></div>
              </motion.div>
            </Link>
          ))}
        </div>
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

  const quickLinks: Array<{
    title: string
    description: string
    href: string
    icon: React.ElementType
    accent: string
  }> = [
    { title: 'Browse cases',    description: 'Read clinical cases and dialogues',  href: '/cases',     icon: BookOpen,  accent: 'bg-teal-500/10 text-teal-600' },
    { title: 'Pearls library',  description: 'Faculty-curated clinical wisdom',    href: '/pearls',    icon: Lightbulb, accent: 'bg-amber-500/10 text-amber-600' },
    { title: 'Signs atlas',     description: 'Ophthalmology image atlas',          href: '/atlas',     icon: Eye,       accent: 'bg-violet-500/10 text-violet-600' },
    { title: 'Live sessions',   description: 'Upcoming grand rounds & lectures',   href: '/classroom', icon: Video,    accent: 'bg-rose-500/10 text-rose-600' },
  ]

  return (
    <PageTransition className="space-y-6">
      <StaggerItem>
        <WelcomeBanner firstName={firstName} subtitle={subtitle} />
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((q) => {
            const Icon = q.icon
            return (
              <HoverCard key={q.href}>
                <Link
                  href={q.href}
                  className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                >
                  <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', q.accent)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{q.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{q.description}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </HoverCard>
            )
          })}
        </div>
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
