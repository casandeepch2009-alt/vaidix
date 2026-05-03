'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, MessageCircleQuestion, ArrowRight, ClipboardList } from 'lucide-react'
import { ObjectivesChipList, type ObjectiveRow } from './objectives-chip-list'

interface Props {
  sessionId: string
  studyPackCount: number
  preQuestionCount: number
  myPreQuestionCount: number
  objectives?: ObjectiveRow[]
}

export function PreConferenceResidentBlock({
  sessionId,
  studyPackCount,
  preQuestionCount,
  myPreQuestionCount,
  objectives = [],
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-6 mb-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-testid="pre-conference-resident-block"
    >
      <div className="border-b border-border px-6 py-3 flex items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Before this session
        </span>
      </div>

      {objectives.length > 0 && (
        <div className="border-b border-border px-6 py-4">
          <ObjectivesChipList objectives={objectives} />
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
