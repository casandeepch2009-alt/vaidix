'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Image,
  Users,
  BookOpen,
  Play,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'
import type { ClinicalCase, Conversation } from '@/lib/types'
import casesData from '@/mock-data/cases.json'
import conversationsData from '@/mock-data/conversations.json'

const difficultyConfig = {
  beginner: {
    label: 'Beginner',
    cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  },
  intermediate: {
    label: 'Intermediate',
    cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  },
  advanced: {
    label: 'Advanced',
    cls: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400',
  },
}

export default function CaseOverviewPage() {
  const params = useParams<{ caseId: string }>()
  const [caseData, setCaseData] = useState<ClinicalCase | null>(null)
  const [previousConversation, setPreviousConversation] = useState<Conversation | null>(null)

  useEffect(() => {
    const found = (casesData as unknown as ClinicalCase[]).find((c) => c.id === params.caseId)
    setCaseData(found || null)

    const prevConv = (conversationsData as unknown as Conversation[]).find(
      (c) => c.caseId === params.caseId && c.status === 'completed'
    )
    setPreviousConversation(prevConv || null)
  }, [params.caseId])

  if (!caseData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Case not found.</p>
      </div>
    )
  }

  const difficulty = difficultyConfig[caseData.difficulty]

  const genderLabel =
    caseData.patientGender === 'M' || (caseData.patientGender as string) === 'Male'
      ? 'Male'
      : 'Female'

  return (
    <PageTransition className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <StaggerItem>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Cases
        </Link>
      </StaggerItem>

      {/* Hero section — only difficulty + specialty. No Bloom's level, no Oslerian principles.
          Revealing those upfront primes the learner and undermines Socratic discovery. */}
      <StaggerItem>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={difficulty.cls}>
              {difficulty.label}
            </Badge>
            <Badge variant="secondary">{caseData.specialty}</Badge>
          </div>

          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {caseData.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4" />
              {caseData.patientName} ({caseData.patientAge}y / {genderLabel})
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              ~{caseData.estimatedMinutes} minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Image className="size-4" />
              {caseData.imageCount} clinical images
            </span>
          </div>
        </div>
      </StaggerItem>

      {/* Patient narrative — the hook. This is all the learner should see before starting. */}
      <StaggerItem>
        <Card>
          <CardContent className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-1 rounded-full bg-primary/30" />
            <div className="pl-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Patient Presentation
              </p>
              <p className="text-sm italic leading-relaxed text-foreground/80">
                &ldquo;{caseData.description}&rdquo;
              </p>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Case statistics — peer benchmarking only. No pedagogical metadata that primes reasoning. */}
      <StaggerItem>
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Case Statistics</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{caseData.completions}</p>
                <p className="text-xs text-muted-foreground">Learners completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{caseData.avgScore}%</p>
                <p className="text-xs text-muted-foreground">Average score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{caseData.imageCount}</p>
                <p className="text-xs text-muted-foreground">Clinical images</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Tags — topic hints only, no pedagogical framework leak */}
      {caseData.tags.length > 0 && (
        <StaggerItem>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Related Topics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {caseData.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </StaggerItem>
      )}

      {/* Action buttons */}
      <StaggerItem>
        <div className="flex flex-col gap-3 pb-4 sm:flex-row">
          <Link href={`/cases/${caseData.id}/session`} className="flex-1">
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button className="h-12 w-full gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90">
                <Play className="size-5" />
                Start Case
              </Button>
            </motion.div>
          </Link>

          {previousConversation && (
            <Link href={`/cases/${caseData.id}/session?review=true`} className="sm:w-auto">
              <Button
                variant="outline"
                className="h-12 w-full gap-2 rounded-xl text-base sm:px-6"
              >
                <Eye className="size-5" />
                Review Previous Attempt
              </Button>
            </Link>
          )}
        </div>
      </StaggerItem>
    </PageTransition>
  )
}
