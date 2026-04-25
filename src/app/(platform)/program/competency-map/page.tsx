'use client'

import { useMemo } from 'react'
import { Map } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { EPA_LIST, ENTRUSTMENT_LEVELS } from '@/lib/constants'
import type { User } from '@/lib/types'
import usersData from '@/mock-data/users.json'
import { PageTransition, StaggerItem, motion, staggerContainer, staggerItem } from '@/lib/motion'

// ---------------------------------------------------------------------------
// Mock entrustment levels (resident x EPA)
// Senior residents / fellows have higher levels, juniors lower
// ---------------------------------------------------------------------------

const entrustmentData: Record<string, number[]> = {
  // PGY-1
  'user-006': [2, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 2],
  'user-007': [2, 1, 2, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2],
  'user-008': [2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 1, 2, 2],
  // PGY-2
  'user-009': [3, 3, 3, 2, 3, 2, 3, 2, 2, 2, 2, 3, 3],
  'user-010': [3, 3, 2, 3, 3, 3, 3, 2, 2, 1, 2, 3, 3],
  'user-011': [3, 2, 3, 2, 3, 2, 3, 2, 2, 2, 2, 2, 3],
  // PGY-3
  'user-012': [4, 4, 4, 3, 4, 3, 4, 3, 3, 3, 3, 4, 4],
  'user-013': [4, 3, 4, 3, 4, 4, 4, 3, 3, 2, 3, 3, 4],
  // Fellows
  'user-014': [5, 4, 4, 4, 4, 4, 5, 4, 4, 3, 4, 4, 5],
  'user-015': [4, 4, 5, 4, 5, 4, 4, 3, 3, 3, 4, 4, 4],
}

function getLevelColor(level: number): string {
  const entry = ENTRUSTMENT_LEVELS.find((e) => e.level === level)
  return entry?.color ?? '#6b7280'
}

function getLevelBgClass(level: number): string {
  switch (level) {
    case 1: return 'bg-red-500 text-white'
    case 2: return 'bg-orange-500 text-white'
    case 3: return 'bg-amber-400 text-amber-950'
    case 4: return 'bg-emerald-400 text-emerald-950'
    case 5: return 'bg-emerald-600 text-white'
    default: return 'bg-muted text-muted-foreground'
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompetencyMapPage() {
  const residents = useMemo(() => {
    return (usersData as unknown as User[]).filter((u) => u.role === 'resident')
  }, [])

  return (
    <PageTransition className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <Map className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Competency Map</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            All Residents x All EPAs
          </p>
        </div>
      </StaggerItem>

      {/* Legend */}
      <StaggerItem>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase">Entrustment:</span>
          {ENTRUSTMENT_LEVELS.map((lvl) => (
            <div key={lvl.level} className="flex items-center gap-1.5">
              <div
                className={cn('flex size-5 items-center justify-center rounded text-[10px] font-bold', getLevelBgClass(lvl.level))}
              >
                {lvl.level}
              </div>
              <span className="text-xs text-muted-foreground">{lvl.label}</span>
            </div>
          ))}
        </div>
      </StaggerItem>

      {/* Heatmap */}
      <StaggerItem>
        <Card>
          <CardContent className="overflow-x-auto pt-1">
            <TooltipProvider>
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card pb-2 pr-3 text-left text-xs font-medium text-muted-foreground min-w-[180px]">
                      Resident
                    </th>
                    {EPA_LIST.map((epa) => (
                      <th key={epa.id} className="pb-2 px-1 text-center">
                        <Tooltip>
                          <TooltipTrigger className="text-xs font-medium text-muted-foreground cursor-help">
                            EPA-{epa.id}
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {epa.title}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  {residents.map((r) => {
                    const levels = entrustmentData[r.id] ?? []
                    return (
                      <motion.tr key={r.id} variants={staggerItem} className="border-b last:border-0">
                        <td className="sticky left-0 z-10 bg-card py-2 pr-3 text-sm font-medium whitespace-nowrap">
                          {r.name}
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {r.yearOfTraining}
                          </span>
                        </td>
                        {EPA_LIST.map((epa, idx) => {
                          const level = levels[idx] ?? 0
                          return (
                            <td key={epa.id} className="py-2 px-1 text-center">
                              <Tooltip>
                                <TooltipTrigger
                                  className={cn(
                                    'mx-auto flex size-7 items-center justify-center rounded text-xs font-bold transition-transform hover:scale-110',
                                    getLevelBgClass(level)
                                  )}
                                >
                                  {level}
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {ENTRUSTMENT_LEVELS.find((e) => e.level === level)?.label ?? 'N/A'}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          )
                        })}
                      </motion.tr>
                    )
                  })}
                </motion.tbody>
              </table>
            </TooltipProvider>
          </CardContent>
        </Card>
      </StaggerItem>
    </PageTransition>
  )
}
