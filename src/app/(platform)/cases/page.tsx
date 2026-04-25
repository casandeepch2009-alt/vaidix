'use client'

import { useState, useMemo } from 'react'
import { Search, BookOpen, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { CaseCard } from '@/components/cases/case-card'
import { BLOOMS_COGNITIVE } from '@/lib/constants'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'
import type { ClinicalCase } from '@/lib/types'
import casesData from '@/mock-data/cases.json'

const difficultyOptions = ['all', 'beginner', 'intermediate', 'advanced'] as const

const specialties = Array.from(
  new Set((casesData as unknown as ClinicalCase[]).map((c) => c.specialty))
).sort()

export default function CaseLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [bloomsFilter, setBloomsFilter] = useState<string>('all')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')

  const allCases = casesData as unknown as ClinicalCase[]

  const filteredCases = useMemo(() => {
    return allCases.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          c.title.toLowerCase().includes(q) ||
          c.condition.toLowerCase().includes(q) ||
          c.patientName.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      if (difficultyFilter !== 'all' && c.difficulty !== difficultyFilter) return false
      if (bloomsFilter !== 'all' && c.bloomsLevel !== Number(bloomsFilter)) return false
      if (specialtyFilter !== 'all' && c.specialty !== specialtyFilter) return false
      return true
    })
  }, [allCases, searchQuery, difficultyFilter, bloomsFilter, specialtyFilter])

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Case Library</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore clinical cases and practice Socratic reasoning
          </p>
        </div>
      </StaggerItem>

      {/* Search and filter bar */}
      <StaggerItem>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, condition, or patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="hidden size-4 text-muted-foreground sm:block" />
            <Select value={difficultyFilter} onValueChange={(v) => setDifficultyFilter(v ?? 'all')}>
              <SelectTrigger className="w-35">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bloomsFilter} onValueChange={(v) => setBloomsFilter(v ?? 'all')}>
              <SelectTrigger className="w-37.5">
                <SelectValue placeholder="Bloom's Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bloom&apos;s</SelectItem>
                {BLOOMS_COGNITIVE.map((b) => (
                  <SelectItem key={b.level} value={String(b.level)}>
                    L{b.level}: {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={specialtyFilter} onValueChange={(v) => setSpecialtyFilter(v ?? 'all')}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </StaggerItem>

      {/* Difficulty pill toggles */}
      <StaggerItem>
        <div className="flex items-center gap-2">
          {difficultyOptions.map((d) => {
            const isActive = difficultyFilter === d
            return (
              <motion.div key={d} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDifficultyFilter(d)}
                  className="rounded-full text-xs capitalize"
                >
                  {d === 'all' ? 'All' : d}
                </Button>
              </motion.div>
            )
          })}
        </div>
      </StaggerItem>

      {/* Case count */}
      <StaggerItem>
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">{filteredCases.length}</span>{' '}
          of{' '}
          <span className="font-medium text-foreground">{allCases.length}</span>{' '}
          cases
        </p>
      </StaggerItem>

      {/* Case grid with staggered animation */}
      {filteredCases.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCases.map((caseItem, i) => (
            <CaseCard key={caseItem.id} caseData={caseItem} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center"
        >
          <BookOpen className="size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold">No cases found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchQuery('')
              setDifficultyFilter('all')
              setBloomsFilter('all')
              setSpecialtyFilter('all')
            }}
          >
            Clear all filters
          </Button>
        </motion.div>
      )}
    </PageTransition>
  )
}
