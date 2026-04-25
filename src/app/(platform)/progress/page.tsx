'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BLOOMS_COGNITIVE, OSLERIAN_PRINCIPLES } from '@/lib/constants'
import {
  PageTransition,
  StaggerItem,
  AnimatedBar,
  AnimatedCounter,
  HoverCard,
  motion,
} from '@/lib/motion'
import {
  Brain,
  Heart,
  Hand,
  Eye,
  Ear,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Lock,
  Target,
  ArrowUpRight,
  Flame,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Growth over time — the REAL progress data (3H trajectory across last 10 cases)
// ---------------------------------------------------------------------------

const growthData = [
  { case: 'C1', head: 62, heart: 58, hands: 55, date: 'Jan 15' },
  { case: 'C2', head: 65, heart: 64, hands: 58, date: 'Jan 22' },
  { case: 'C3', head: 68, heart: 68, hands: 60, date: 'Jan 29' },
  { case: 'C4', head: 70, heart: 71, hands: 63, date: 'Feb 5' },
  { case: 'C5', head: 72, heart: 74, hands: 65, date: 'Feb 12' },
  { case: 'C6', head: 73, heart: 76, hands: 66, date: 'Feb 19' },
  { case: 'C7', head: 75, heart: 78, hands: 68, date: 'Feb 26' },
  { case: 'C8', head: 76, heart: 79, hands: 69, date: 'Mar 5' },
  { case: 'C9', head: 77, heart: 81, hands: 70, date: 'Mar 14' },
  { case: 'C10', head: 78, heart: 82, hands: 71, date: 'Mar 28' },
]

// Growth deltas (current vs 30 days ago)
const growthDeltas = [
  { domain: 'HEAD', current: 78, delta: 8, icon: Brain, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { domain: 'HEART', current: 82, delta: 11, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { domain: 'HANDS', current: 71, delta: 8, icon: Hand, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
]

// Consistency metrics
const consistency = {
  streak: 12,
  casesThisMonth: 10,
  avgSessionMinutes: 22,
  totalHours: 8.7,
}

// Oslerian Principles — growth (baseline vs current)
const oslerianGrowth = [
  { id: 'direct_observation', baseline: 60, current: 85, icon: 'Eye' },
  { id: 'listen_to_patient', baseline: 65, current: 90, icon: 'Ear' },
  { id: 'first_principles', baseline: 52, current: 72, icon: 'Brain' },
  { id: 'equanimity', baseline: 58, current: 78, icon: 'Heart' },
  { id: 'teaching_to_learn', baseline: 48, current: 65, icon: 'GraduationCap' },
]

const bloomsAchieved = 4

const recentCases = [
  { date: '2026-03-28', name: 'Diabetic Retinopathy - Moderate NPDR', head: 82, heart: 79, hands: 74 },
  { date: '2026-03-25', name: 'Acute Angle Closure Glaucoma', head: 75, heart: 85, hands: 68 },
  { date: '2026-03-21', name: 'Central Retinal Vein Occlusion', head: 80, heart: 84, hands: 73 },
  { date: '2026-03-18', name: 'Phacomorphic Glaucoma', head: 74, heart: 80, hands: 70 },
  { date: '2026-03-14', name: 'Orbital Cellulitis - Pediatric', head: 78, heart: 83, hands: 69 },
]

const oslerianIconMap: Record<string, LucideIcon> = {
  Eye, Ear, Brain, Heart, GraduationCap,
}

// Custom tooltip for line chart
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="font-medium uppercase" style={{ color: p.color }}>{p.name}</span>
          <span className="tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ProgressPage() {
  return (
    <PageTransition className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <StaggerItem>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Progress</h1>
            <p className="text-sm text-muted-foreground">Your growth trajectory over the last 10 cases</p>
          </div>
        </div>
      </StaggerItem>

      {/* Growth deltas — what changed, not just current state */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {growthDeltas.map((d, i) => (
            <HoverCard key={d.domain}>
              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`flex size-9 items-center justify-center rounded-lg ${d.bg}`}>
                          <d.icon className={`size-4 ${d.color}`} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.domain}</span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tabular-nums text-foreground">
                          <AnimatedCounter value={d.current} />
                        </span>
                        <div className="flex items-center gap-0.5 text-sm font-semibold text-emerald-600">
                          <ArrowUpRight className="size-4" />
                          +{d.delta}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">vs 30 days ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </HoverCard>
          ))}
        </div>
      </StaggerItem>

      {/* THE CORE CHART — 3H growth trajectory over last 10 cases */}
      <StaggerItem>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              3H Growth Trajectory
            </CardTitle>
            <CardDescription>How your scores have evolved across the last 10 completed cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="handsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[40, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '11px' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Line
                    type="monotone"
                    dataKey="head"
                    name="HEAD"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3B82F6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="heart"
                    name="HEART"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    dot={{ fill: '#F43F5E', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hands"
                    name="HANDS"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10B981', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Consistency metrics */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10">
                <Flame className="size-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  <AnimatedCounter value={consistency.streak} />
                </p>
                <p className="text-xs text-muted-foreground">day streak</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Target className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  <AnimatedCounter value={consistency.casesThisMonth} />
                </p>
                <p className="text-xs text-muted-foreground">cases / month</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Brain className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  <AnimatedCounter value={consistency.avgSessionMinutes} />
                </p>
                <p className="text-xs text-muted-foreground">avg session (min)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10">
                <GraduationCap className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{consistency.totalHours}h</p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* Oslerian Principles — showing growth (baseline vs current), not just current */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-4 text-amber-500" />
              Oslerian Principles — Growth
            </CardTitle>
            <CardDescription>How you&apos;ve improved on each principle since your first case</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {OSLERIAN_PRINCIPLES.map((principle, i) => {
              const growth = oslerianGrowth.find((g) => g.id === principle.id)
              if (!growth) return null
              const delta = growth.current - growth.baseline
              const Icon = oslerianIconMap[principle.icon] ?? Eye
              return (
                <motion.div
                  key={principle.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{principle.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {growth.baseline} → {growth.current}
                      </span>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        +{delta}
                      </Badge>
                    </div>
                  </div>
                  {/* Two-layer bar: faded baseline + bright current */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-500/30"
                      style={{ width: `${growth.baseline}%` }}
                    />
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${growth.current}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Bloom's Cognitive Progression — already temporal (unlock order) */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4.5 text-indigo-500" />
              Bloom&apos;s Cognitive Progression
            </CardTitle>
            <CardDescription>Levels unlocked through demonstrated reasoning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {BLOOMS_COGNITIVE.map((bloom, i) => {
                const achieved = bloom.level <= bloomsAchieved
                return (
                  <motion.div
                    key={bloom.level}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 200 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: achieved ? 5 : 0 }}
                      className={`flex size-14 items-center justify-center rounded-xl border-2 transition-colors ${
                        achieved
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-muted bg-muted/40'
                      }`}
                    >
                      {achieved ? (
                        <CheckCircle2 className="size-6 text-emerald-500" />
                      ) : (
                        <Lock className="size-5 text-muted-foreground/50" />
                      )}
                    </motion.div>
                    <div className="text-center">
                      <p className={`text-xs font-semibold ${achieved ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                        L{bloom.level}
                      </p>
                      <p className={`text-[11px] leading-tight ${achieved ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                        {bloom.label}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Recent cases table */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>Recent Cases</CardTitle>
            <CardDescription>Your last 5 completed cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Case</th>
                    <th className="pb-3 pr-2 text-center"><span className="text-blue-500">HEAD</span></th>
                    <th className="pb-3 pr-2 text-center"><span className="text-rose-500">HEART</span></th>
                    <th className="pb-3 text-center"><span className="text-emerald-500">HANDS</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.06 }}
                      className="border-b last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">
                        {new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">{c.name}</td>
                      <td className="py-3 pr-2 text-center">
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 tabular-nums">{c.head}</Badge>
                      </td>
                      <td className="py-3 pr-2 text-center">
                        <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 tabular-nums">{c.heart}</Badge>
                      </td>
                      <td className="py-3 text-center">
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">{c.hands}</Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>
    </PageTransition>
  )
}
