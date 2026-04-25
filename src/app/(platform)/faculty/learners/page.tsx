'use client'

import { useState, useMemo } from 'react'
import { Search, Users, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'
import type { User } from '@/lib/types'
import usersData from '@/mock-data/users.json'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Mock 3H scores for each resident
// ---------------------------------------------------------------------------

const learnerScores: Record<string, { head: number; heart: number; hands: number; lastActive: string }> = {
  'user-006': { head: 72, heart: 78, hands: 65, lastActive: '2 hours ago' },
  'user-007': { head: 68, heart: 74, hands: 62, lastActive: '4 hours ago' },
  'user-008': { head: 70, heart: 80, hands: 60, lastActive: '1 hour ago' },
  'user-009': { head: 82, heart: 85, hands: 78, lastActive: '30 minutes ago' },
  'user-010': { head: 79, heart: 88, hands: 75, lastActive: '3 hours ago' },
  'user-011': { head: 76, heart: 82, hands: 73, lastActive: '6 hours ago' },
  'user-012': { head: 88, heart: 90, hands: 85, lastActive: '1 hour ago' },
  'user-013': { head: 85, heart: 87, hands: 82, lastActive: '5 hours ago' },
  'user-014': { head: 91, heart: 92, hands: 88, lastActive: '45 minutes ago' },
  'user-015': { head: 89, heart: 86, hands: 84, lastActive: '2 hours ago' },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LearnersPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const residents = useMemo(() => {
    return (usersData as unknown as User[]).filter((u) => u.role === 'resident')
  }, [])

  const filteredResidents = useMemo(() => {
    if (!searchQuery) return residents
    const q = searchQuery.toLowerCase()
    return residents.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.yearOfTraining?.toLowerCase().includes(q)
    )
  }, [residents, searchQuery])

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Learners</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor resident progress and development
          </p>
        </div>
      </StaggerItem>

      {/* Search */}
      <StaggerItem>
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            className="pl-9"
          />
        </div>
      </StaggerItem>

      {/* Learner Cards Grid */}
      <StaggerItem>
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredResidents.map((resident, index) => {
            const scores = learnerScores[resident.id]
            return (
              <motion.div
                key={resident.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
              >
                <Card
                  className="transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardContent className="pt-1">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <Avatar size="lg" className="size-12">
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(resident.name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {resident.name}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {resident.yearOfTraining}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {resident.department}
                        </p>

                        {/* 3H Scores */}
                        {scores && (
                          <div className="mt-3 flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                HEAD
                              </span>
                              <span className="text-sm font-bold text-blue-500">
                                {scores.head}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                HEART
                              </span>
                              <span className="text-sm font-bold text-rose-500">
                                {scores.heart}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                HANDS
                              </span>
                              <span className="text-sm font-bold text-green-500">
                                {scores.hands}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Last Active + View Profile */}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Last Active: {scores?.lastActive ?? 'N/A'}
                          </span>
                          <Button variant="outline" size="sm">
                            <Eye className="size-3.5" />
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </StaggerItem>

      {filteredResidents.length === 0 && (
        <StaggerItem>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="size-10 mb-3 opacity-40" />
            <p className="text-sm">No learners match your search.</p>
          </div>
        </StaggerItem>
      )}
    </PageTransition>
  )
}
