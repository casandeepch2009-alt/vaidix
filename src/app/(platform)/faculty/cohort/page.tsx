'use client'

import { useMemo } from 'react'
import { BarChart3, Users, Brain, Heart, Hand, Activity, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'
import { OSLERIAN_PRINCIPLES } from '@/lib/constants'
import type { User } from '@/lib/types'
import usersData from '@/mock-data/users.json'

// ---------------------------------------------------------------------------
// Mock 3H scores & activity data for each resident
// ---------------------------------------------------------------------------

const learnerData: Record<
  string,
  { head: number; heart: number; hands: number; cases: number; lastActive: string }
> = {
  'user-006': { head: 72, heart: 78, hands: 65, cases: 8, lastActive: '2h ago' },
  'user-007': { head: 68, heart: 74, hands: 62, cases: 6, lastActive: '4h ago' },
  'user-008': { head: 70, heart: 80, hands: 60, cases: 9, lastActive: '1h ago' },
  'user-009': { head: 82, heart: 85, hands: 78, cases: 14, lastActive: '30m ago' },
  'user-010': { head: 79, heart: 88, hands: 75, cases: 12, lastActive: '3h ago' },
  'user-011': { head: 76, heart: 82, hands: 73, cases: 11, lastActive: '6h ago' },
  'user-012': { head: 88, heart: 90, hands: 85, cases: 18, lastActive: '1h ago' },
  'user-013': { head: 85, heart: 87, hands: 82, cases: 16, lastActive: '5h ago' },
  'user-014': { head: 91, heart: 92, hands: 88, cases: 15, lastActive: '45m ago' },
  'user-015': { head: 89, heart: 86, hands: 84, cases: 11, lastActive: '2h ago' },
}

const oslerianAverages: Record<string, number> = {
  direct_observation: 82,
  listen_to_patient: 86,
  first_principles: 74,
  equanimity: 79,
  teaching_to_learn: 68,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score > 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBg(score: number): string {
  if (score > 80) return 'bg-emerald-500/10'
  if (score >= 60) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CohortAnalyticsPage() {
  const residents = useMemo(() => {
    return (usersData as unknown as User[]).filter((u) => u.role === 'resident')
  }, [])

  // Compute aggregates
  const allScores = Object.values(learnerData)
  const avgHead = Math.round(allScores.reduce((s, d) => s + d.head, 0) / allScores.length)
  const avgHeart = Math.round(allScores.reduce((s, d) => s + d.heart, 0) / allScores.length)
  const avgHands = Math.round(allScores.reduce((s, d) => s + d.hands, 0) / allScores.length)
  const avg3H = Math.round((avgHead + avgHeart + avgHands) / 3)
  const totalCases = allScores.reduce((s, d) => s + d.cases, 0)

  // Sort learners by overall score descending
  const sortedResidents = useMemo(() => {
    return [...residents].sort((a, b) => {
      const da = learnerData[a.id]
      const db = learnerData[b.id]
      if (!da || !db) return 0
      const avgA = (da.head + da.heart + da.hands) / 3
      const avgB = (db.head + db.heart + db.hands) / 3
      return avgB - avgA
    })
  }, [residents])

  // Distribution buckets for bar charts
  const computeDistribution = (key: 'head' | 'heart' | 'hands') => {
    const buckets = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '<60': 0 }
    allScores.forEach((d) => {
      const v = d[key]
      if (v >= 90) buckets['90-100']++
      else if (v >= 80) buckets['80-89']++
      else if (v >= 70) buckets['70-79']++
      else if (v >= 60) buckets['60-69']++
      else buckets['<60']++
    })
    return buckets
  }

  const headDist = computeDistribution('head')
  const heartDist = computeDistribution('heart')
  const handsDist = computeDistribution('hands')

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Cohort Analytics</h1>
          </div>
        </div>
      </StaggerItem>

      {/* Summary Stats */}
      <StaggerItem>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0 }}
          >
            <StatCard title="Cohort Size" value={10} icon={Users} color="text-blue-500" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          >
            <StatCard title="Average 3H Score" value={avg3H} icon={Activity} color="text-teal-500" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
          >
            <StatCard title="Cases Completed" value={totalCases} icon={Brain} color="text-purple-500" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
          >
            <StatCard title="Pass Rate" value="92%" icon={CheckCircle2} color="text-emerald-500" />
          </motion.div>
        </div>
      </StaggerItem>

      {/* 3H Distribution */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3H Distribution</CardTitle>
            <CardDescription>Score distribution across the cohort</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {([
                { label: 'HEAD', dist: headDist, color: 'bg-blue-500' },
                { label: 'HEART', dist: heartDist, color: 'bg-rose-500' },
                { label: 'HANDS', dist: handsDist, color: 'bg-green-500' },
              ] as const).map(({ label, dist, color }) => (
                <div key={label} className="space-y-2">
                  <h4 className="text-sm font-semibold">{label}</h4>
                  {Object.entries(dist).map(([bucket, count]) => (
                    <div key={bucket} className="flex items-center gap-2">
                      <span className="w-14 text-xs text-muted-foreground text-right shrink-0">
                        {bucket}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', color)}
                          style={{ width: `${(count / allScores.length) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-xs text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Learner Comparison Table */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learner Comparison</CardTitle>
            <CardDescription>All residents ranked by overall score</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">PGY</th>
                  <th className="pb-2 pr-4 font-medium text-center">HEAD</th>
                  <th className="pb-2 pr-4 font-medium text-center">HEART</th>
                  <th className="pb-2 pr-4 font-medium text-center">HANDS</th>
                  <th className="pb-2 pr-4 font-medium text-center">Cases</th>
                  <th className="pb-2 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {sortedResidents.map((r, index) => {
                  const d = learnerData[r.id]
                  if (!d) return null
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
                      className="border-b last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium">{r.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary" className="text-[10px]">
                          {r.yearOfTraining}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={cn('font-semibold', scoreColor(d.head))}>
                          {d.head}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={cn('font-semibold', scoreColor(d.heart))}>
                          {d.heart}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={cn('font-semibold', scoreColor(d.hands))}>
                          {d.hands}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">{d.cases}</td>
                      <td className="py-2.5 text-muted-foreground">{d.lastActive}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Oslerian Principles Averages */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Oslerian Principles Averages</CardTitle>
            <CardDescription>Cohort performance on Oslerian principles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {OSLERIAN_PRINCIPLES.map((principle, index) => {
              const avg = oslerianAverages[principle.id] ?? 0
              return (
                <motion.div
                  key={principle.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{principle.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{avg}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${avg}%` }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>
      </StaggerItem>
    </PageTransition>
  )
}
