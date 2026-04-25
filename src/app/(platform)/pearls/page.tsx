'use client'

import { useState, useMemo } from 'react'
import {
  Lightbulb,
  Search,
  BookOpen,
  Brain,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Quote,
  GraduationCap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  PageTransition,
  StaggerItem,
  AnimatedCounter,
  HoverCard,
  motion,
} from '@/lib/motion'
import { AnimatePresence } from 'framer-motion'

import pearlsData from '@/mock-data/pearls.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  authors: string
  title: string
  journal: string
  year: number
  doi: string
}

interface Pearl {
  id: string
  question: string
  answer: string
  mechanism: string
  condition: string
  subspecialty: string
  category: string
  citation: Citation
  bloomsLevel: number
  tags: string[]
  difficulty: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const pearls: Pearl[] = pearlsData as Pearl[]

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'infection', label: 'Infections' },
  { key: 'inflammation', label: 'Diagnostics' },
  { key: 'autoimmune', label: 'Clinical Signs' },
  { key: 'pharmacology', label: 'Pharmacology' },
] as const

const DIFFICULTY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
] as const

const categoryStyle: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  infection:    { bg: 'bg-rose-50 dark:bg-rose-950/40',   text: 'text-rose-700 dark:text-rose-400',     ring: 'ring-rose-200 dark:ring-rose-800',   label: 'Infection' },
  inflammation: { bg: 'bg-blue-50 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-400',     ring: 'ring-blue-200 dark:ring-blue-800',   label: 'Diagnostics' },
  autoimmune:   { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400',   ring: 'ring-amber-200 dark:ring-amber-800', label: 'Clinical Signs' },
  pharmacology: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400', ring: 'ring-purple-200 dark:ring-purple-800', label: 'Pharmacology' },
  neoplastic:   { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800', label: 'Neoplastic' },
}

const difficultyStyle: Record<string, string> = {
  beginner:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  advanced:     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const bloomsLabels: Record<number, string> = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PearlsPage() {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set())
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeDifficulty, setActiveDifficulty] = useState('all')

  // Derived counts
  const masteredCount = masteredIds.size
  const reviewCount = reviewIds.size
  const newCount = pearls.length - masteredCount - reviewCount

  // Filtered pearls
  const filteredPearls = useMemo(() => {
    return pearls.filter((pearl) => {
      // Category filter
      if (activeCategory !== 'all' && pearl.category !== activeCategory) return false

      // Difficulty filter
      if (activeDifficulty !== 'all' && pearl.difficulty !== activeDifficulty) return false

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesQuestion = pearl.question.toLowerCase().includes(q)
        const matchesCondition = pearl.condition.toLowerCase().includes(q)
        const matchesTags = pearl.tags.some((tag) => tag.toLowerCase().includes(q))
        const matchesAnswer = pearl.answer.toLowerCase().includes(q)
        if (!matchesQuestion && !matchesCondition && !matchesTags && !matchesAnswer) return false
      }

      return true
    })
  }, [searchQuery, activeCategory, activeDifficulty])

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleMastered = (id: string) => {
    setMasteredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Remove from review if present
        setReviewIds((r) => {
          const nr = new Set(r)
          nr.delete(id)
          return nr
        })
      }
      return next
    })
  }

  const toggleReview = (id: string) => {
    setReviewIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Remove from mastered if present
        setMasteredIds((m) => {
          const nm = new Set(m)
          nm.delete(id)
          return nm
        })
      }
      return next
    })
  }

  const getCatStyle = (cat: string) =>
    categoryStyle[cat] ?? { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-700 dark:text-gray-300', ring: 'ring-gray-200 dark:ring-gray-700', label: cat }

  return (
    <PageTransition className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                       */}
      {/* ----------------------------------------------------------------- */}
      <StaggerItem>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-lg bg-amber-500/10 p-2">
            <Lightbulb className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clinical Pearls</h1>
            <p className="text-sm text-muted-foreground">
              Bite-sized wisdom from faculty teaching rounds
            </p>
          </div>
        </div>
      </StaggerItem>

      {/* Stats row */}
      <StaggerItem>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-blue-500/10 p-2">
              <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Total Pearls</p>
              <p className="text-lg font-bold">{pearls.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-green-500/10 p-2">
              <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Mastered</p>
              <p className="text-lg font-bold">{masteredCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-teal-500/10 p-2">
              <RotateCcw className="size-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">In Review</p>
              <p className="text-lg font-bold">{reviewCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-amber-500/10 p-2">
              <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">New</p>
              <p className="text-lg font-bold">{newCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      </StaggerItem>

      {/* ----------------------------------------------------------------- */}
      {/* Search & Filters                                                  */}
      {/* ----------------------------------------------------------------- */}
      <StaggerItem>
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search pearls by question, condition, or tag..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Category:</span>
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveCategory(f.key)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Difficulty pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Difficulty:</span>
          {DIFFICULTY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveDifficulty(f.key)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeDifficulty === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      </StaggerItem>

      <Separator />

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filteredPearls.length}</span>{' '}
        {filteredPearls.length === 1 ? 'pearl' : 'pearls'}
      </p>

      {/* ----------------------------------------------------------------- */}
      {/* Pearl Cards Grid                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filteredPearls.map((pearl, pearlIndex) => {
          const isRevealed = revealedIds.has(pearl.id)
          const isMastered = masteredIds.has(pearl.id)
          const isInReview = reviewIds.has(pearl.id)
          const cat = getCatStyle(pearl.category)

          return (
            <motion.div
              key={pearl.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pearlIndex * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
            <Card
              className={`relative transition-all duration-300 ${
                isMastered
                  ? 'ring-green-400/50 dark:ring-green-500/30'
                  : isInReview
                    ? 'ring-teal-400/50 dark:ring-teal-500/30'
                    : ''
              }`}
              style={{
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 4px 12px -2px rgba(0,0,0,0.05)',
              }}
            >
              {/* ---- Front: Question ---- */}
              <CardContent className="space-y-4 pt-1">
                {/* Top badges row */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cat.bg} ${cat.text} ${cat.ring}`}
                  >
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isMastered && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        <CheckCircle className="size-3" />
                        Mastered
                      </span>
                    )}
                    {isInReview && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                        <RotateCcw className="size-3" />
                        In Review
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                        difficultyStyle[pearl.difficulty] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {pearl.difficulty}
                    </span>
                  </div>
                </div>

                {/* Question */}
                <div className="space-y-2">
                  <p className="text-[15px] font-semibold leading-relaxed tracking-tight text-foreground" style={{ fontStyle: 'italic' }}>
                    &ldquo;{pearl.question}&rdquo;
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {pearl.condition}
                  </p>
                </div>

                {/* Bottom meta row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      <GraduationCap className="size-3" />
                      {bloomsLabels[pearl.bloomsLevel] ?? `Level ${pearl.bloomsLevel}`}
                    </span>
                    {pearl.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Reveal / Collapse toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-950/30"
                  onClick={() => toggleReveal(pearl.id)}
                >
                  {isRevealed ? (
                    <>
                      <ChevronUp className="size-3.5" />
                      Hide Answer
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5" />
                      Reveal Answer
                    </>
                  )}
                </Button>
              </CardContent>

              {/* ---- Expanded: Answer ---- */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isRevealed ? '800px' : '0px',
                  opacity: isRevealed ? 1 : 0,
                }}
              >
                <div className="border-t border-border/60" />
                <CardContent className="space-y-4 pb-2 pt-4">
                  {/* Answer */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Answer
                    </p>
                    <p className="text-sm font-semibold leading-relaxed text-foreground">
                      {pearl.answer}
                    </p>
                  </div>

                  {/* Mechanism */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mechanism
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {pearl.mechanism}
                    </p>
                  </div>

                  {/* Citation */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3 dark:bg-muted/10">
                    <div className="flex items-start gap-2.5">
                      <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs leading-relaxed text-foreground">
                          {pearl.citation.authors}.{' '}
                          {pearl.citation.title}.{' '}
                          <span className="italic">{pearl.citation.journal}</span>.{' '}
                          <span className="font-bold">{pearl.citation.year}</span>.
                        </p>
                        {pearl.citation.doi && (
                          <p className="text-[11px] text-muted-foreground">
                            DOI: {pearl.citation.doi}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className={`gap-1.5 ${
                        isMastered
                          ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
                          : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                      }`}
                      onClick={() => toggleMastered(pearl.id)}
                    >
                      <CheckCircle className="size-3.5" />
                      {isMastered ? 'Mastered' : 'Mark as Mastered'}
                    </Button>
                    <Button
                      size="sm"
                      className={`gap-1.5 ${
                        isInReview
                          ? 'bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600'
                          : 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:hover:bg-teal-900/60'
                      }`}
                      onClick={() => toggleReview(pearl.id)}
                    >
                      <RotateCcw className="size-3.5" />
                      {isInReview ? 'In Review' : 'Add to Review'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        window.location.href = '/cases'
                      }}
                    >
                      <Brain className="size-3.5" />
                      Discuss with AI
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredPearls.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex items-center justify-center rounded-full bg-muted p-4">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No pearls found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
