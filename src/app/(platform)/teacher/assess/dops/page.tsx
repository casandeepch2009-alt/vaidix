'use client'

import { useState, useMemo } from 'react'
import { ClipboardCheck, FlaskConical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'
import type { User } from '@/lib/types'
import usersData from '@/mock-data/users.json'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROCEDURES = [
  'Intravitreal Injection',
  'Phacoemulsification',
  'Nd:YAG Laser Capsulotomy',
  'PRP Laser Photocoagulation',
  'Direct Ophthalmoscopy',
  'Indirect Ophthalmoscopy',
  'Slit Lamp Examination',
  'Trabeculectomy',
  'Pterygium Excision',
  'Chalazion Incision & Curettage',
]

const SCORING_DOMAINS = [
  { id: 'indication', label: 'Demonstrates Appropriate Indication' },
  { id: 'consent', label: 'Informed Consent' },
  { id: 'preparation', label: 'Pre-procedure Preparation' },
  { id: 'technique', label: 'Technical Ability' },
  { id: 'asepsis', label: 'Aseptic Technique' },
  { id: 'postProcedure', label: 'Post-procedure Management' },
  { id: 'communication', label: 'Communication Skills' },
]

function getOverallLabel(score: number): string {
  if (score <= 3) return 'Below Expectations'
  if (score <= 6) return 'Meets Expectations'
  return 'Above Expectations'
}

function getOverallColor(score: number): string {
  if (score <= 3) return 'text-red-500'
  if (score <= 6) return 'text-amber-500'
  return 'text-emerald-500'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DOPSAssessmentPage() {
  const residents = useMemo(() => {
    return (usersData as unknown as User[]).filter((u) => u.role === 'resident')
  }, [])

  const [selectedLearner, setSelectedLearner] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [domainScores, setDomainScores] = useState<Record<string, number>>({})
  const [overallRating, setOverallRating] = useState<number>(0)
  const [feedback, setFeedback] = useState('')

  const handleDomainScore = (domainId: string, score: number) => {
    setDomainScores((prev) => ({ ...prev, [domainId]: score }))
  }

  // Submit is intentionally disabled until W8 wires `POST /api/teacher/dops` and
  // writes to the existing `DopsAssessment` table. The previous "Submission
  // Successful" screen was UI-theatre — it dropped the assessment on the floor
  // and gave faculty a false-positive receipt. Removed until the real route
  // exists. See VAIDIX-BUILD-PLAN-NOW.md §10b.

  return (
    <PageTransition className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">DOPS Assessment</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct Observation of Procedural Skills. Persistence to the{' '}
            <span className="font-medium">DopsAssessment</span> table lands in Week 8.
          </p>
        </div>
      </StaggerItem>

      {/* W8 build-plan banner — DOPS form is preview-only until /api/teacher/dops + ScoringEvent log land per VAIDIX-BUILD-PLAN-NOW.md §10b. */}
      <StaggerItem>
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 pt-6">
            <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium">Scheduled for Week 8 of the build plan.</p>
              <p className="mt-1 text-muted-foreground">
                This form is a UI preview. Submission is disabled — the{' '}
                <span className="font-medium">DopsAssessment</span> +{' '}
                <span className="font-medium">ScoringEvent</span> tables exist in the schema (W0
                lock) but the writing endpoint{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /api/teacher/dops</code>{' '}
                ships in W8 alongside Mini-CEX, EPA records, and the student progress page (3H
                radar + Bloom&rsquo;s + EPA heatmap). Submitting today would silently drop the
                assessment, so the button stays disabled until the route lands.
              </p>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Form */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment Details</CardTitle>
            <CardDescription>Select the learner, procedure, and date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Learner Select */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Learner</label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={selectedLearner}
                onChange={(e) => setSelectedLearner(e.target.value)}
              >
                <option value="">Choose a student...</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.yearOfTraining})
                  </option>
                ))}
              </select>
            </div>

            {/* Procedure Select */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Procedure</label>
              <select
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
              >
                <option value="">Choose a procedure...</option>
                {PROCEDURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Scoring Domains */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring Domains</CardTitle>
            <CardDescription>Rate each domain from 1 (lowest) to 9 (highest)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {SCORING_DOMAINS.map((domain, index) => (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium">{domain.label}</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleDomainScore(domain.id, n)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition-all sm:size-10',
                        domainScores[domain.id] === n
                          ? 'border-teal-500 bg-teal-500 text-white shadow-sm'
                          : 'border-input bg-background text-foreground hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Overall Rating */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Rating</CardTitle>
            <CardDescription>
              1-3 Below Expectations | 4-6 Meets Expectations | 7-9 Above Expectations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOverallRating(n)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all sm:size-11',
                    overallRating === n
                      ? 'border-teal-500 bg-teal-500 text-white shadow-sm'
                      : 'border-input bg-background text-foreground hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {overallRating > 0 && (
              <p className={cn('text-sm font-medium', getOverallColor(overallRating))}>
                {getOverallLabel(overallRating)}
              </p>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Feedback */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feedback</CardTitle>
            <CardDescription>Provide constructive feedback for the learner</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write your feedback here..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-24"
            />
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Submit — intentionally disabled until W8 lands the real POST endpoint */}
      <StaggerItem>
        <div className="flex flex-col items-end gap-2 pb-6">
          <Button
            size="lg"
            disabled
            title="Submission lands in Week 8 with /api/teacher/dops"
          >
            <ClipboardCheck className="size-4" />
            Submit Assessment (W8)
          </Button>
          <p className="text-xs text-muted-foreground">
            Disabled until the W8 endpoint ships — see banner above.
          </p>
        </div>
      </StaggerItem>
    </PageTransition>
  )
}
