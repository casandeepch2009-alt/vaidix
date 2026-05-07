'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen, MessageCircleQuestion, ArrowRight, ClipboardList,
  ShieldCheck, Lock, CheckCircle2, Target,
} from 'lucide-react'
import { ObjectivesChipList, type ObjectiveRow } from './objectives-chip-list'
import type { PrereqStatus, PrereqCheck } from '@/server/services/sessions/prereq'

interface Props {
  sessionId: string
  studyPackCount: number
  preQuestionCount: number
  myPreQuestionCount: number
  objectives?: ObjectiveRow[]
  topic?: { name: string; subspecialty: string | null } | null
  prereqStatus?: PrereqStatus | null
}

export function PreConferenceResidentBlock({
  sessionId,
  studyPackCount,
  preQuestionCount,
  myPreQuestionCount,
  objectives = [],
  topic,
  prereqStatus,
}: Props) {
  const showPrereqStrip =
    prereqStatus &&
    (prereqStatus.hasGate || prereqStatus.mode === 'OPTIONAL') &&
    (prereqStatus.checks.preQuestions.required ||
      prereqStatus.checks.studyPack.required ||
      prereqStatus.checks.readinessAck.required)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-6 mb-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-testid="pre-conference-resident-block"
    >
      <div className="border-b border-border px-6 py-3 flex flex-wrap items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Before this session
        </span>
        {topic && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            <BookOpen className="size-3" />
            {topic.name}
            {topic.subspecialty && (
              <span className="font-normal text-primary/70">· {topic.subspecialty}</span>
            )}
          </span>
        )}
      </div>

      {objectives.length > 0 && (
        <div className="border-b border-border px-6 py-4">
          <ObjectivesChipList objectives={objectives} />
        </div>
      )}

      {showPrereqStrip && prereqStatus && (
        <div
          className={`border-b border-border px-6 py-4 ${
            prereqStatus.mode === 'MANDATORY' && !prereqStatus.allMet
              ? 'bg-amber-50/60 dark:bg-amber-950/10'
              : 'bg-emerald-50/60 dark:bg-emerald-950/10'
          }`}
          data-testid="resident-prereq-strip"
        >
          <div className="flex items-start gap-2">
            {prereqStatus.mode === 'MANDATORY' && !prereqStatus.allMet ? (
              <Lock className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            ) : (
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {prereqStatus.mode === 'MANDATORY'
                  ? prereqStatus.allMet
                    ? 'Prerequisites complete — you can join'
                    : 'Complete these to unlock the session'
                  : 'Recommended prep'}
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {prereqStatus.checks.preQuestions.required && (
                  <PrereqMini
                    label="Pre-questions"
                    icon={<MessageCircleQuestion className="size-3.5" />}
                    check={prereqStatus.checks.preQuestions}
                  />
                )}
                {prereqStatus.checks.studyPack.required && (
                  <PrereqMini
                    label="Study pack"
                    icon={<BookOpen className="size-3.5" />}
                    check={prereqStatus.checks.studyPack}
                  />
                )}
                {prereqStatus.checks.readinessAck.required && (
                  <PrereqMini
                    label="Readiness"
                    icon={<Target className="size-3.5" />}
                    check={prereqStatus.checks.readinessAck}
                  />
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <ResidentCard
          href={`/classroom/${sessionId}/study`}
          icon={<BookOpen className="size-5 text-primary" />}
          title="Study pack"
          subtitle={
            studyPackCount > 0
              ? `${studyPackCount} item${studyPackCount === 1 ? '' : 's'} to review`
              : 'No prep material yet — check back closer to the session'
          }
          cta="Open study pack"
          dim={studyPackCount === 0}
          testId="resident-cta-study"
        />

        <ResidentCard
          href={`/classroom/${sessionId}/pre-questions`}
          icon={<MessageCircleQuestion className="size-5 text-primary" />}
          title="Ask before class"
          subtitle={
            myPreQuestionCount > 0
              ? `You've asked ${myPreQuestionCount} · ${preQuestionCount} total from the cohort`
              : preQuestionCount > 0
                ? `${preQuestionCount} from the cohort — add yours`
                : 'Be the first to ask what you want covered'
          }
          cta={myPreQuestionCount > 0 ? 'Open question board' : 'Ask a question'}
          testId="resident-cta-prequestions"
        />
      </div>
    </motion.div>
  )
}

function PrereqMini({
  label,
  icon,
  check,
}: {
  label: string
  icon: React.ReactNode
  check: PrereqCheck
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 ${
        check.met ? 'border-emerald-300/60' : 'border-border'
      }`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-foreground">{label}</p>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {check.current}/{check.total}
        </p>
      </div>
      {check.met && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />}
    </li>
  )
}

function ResidentCard({
  href,
  icon,
  title,
  subtitle,
  cta,
  dim,
  testId,
}: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
  cta: string
  dim?: boolean
  testId?: string
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">{title}</p>
          <p className={`mt-0.5 text-xs ${dim ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
        {cta}
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}
