'use client'

// ════════════════════════════════════════════════════════════════════════════
// Pre-Conference Prep Block — shared surface for SCHEDULED + PENDING sessions
// ════════════════════════════════════════════════════════════════════════════
// Renders the 3-tab Pre-Conference panel (Study Pack curator + Readiness +
// Teaser video) above the LiveSession pre-join screen for host/faculty/PD/admin.
// Same component re-used inside pending-session-manager via PreConferencePanels
// — extracted here so the SCHEDULED page can render without duplicating code.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, BookOpen, Activity, Sparkles, Target, ShieldCheck } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StudyPackCurator } from './study-pack-curator'
import { ReadinessPanel } from './readiness-panel'
import { TeaserVideoButton } from './teaser-video-button'
import { ObjectivesChipList, type ObjectiveRow } from './objectives-chip-list'
import { ObjectivesCurator } from './objectives-curator'
import type { PrereqConfig } from '@/lib/validation/session'

export function PreConferencePrepBlock({
  sessionId,
  canCurate,
  objectives = [],
  topic,
  prereqConfig,
}: {
  sessionId: string
  canCurate: boolean
  objectives?: ObjectiveRow[]
  topic?: { name: string; subspecialty: string | null } | null
  prereqConfig?: PrereqConfig | null
}) {
  const [tab, setTab] = useState<'objectives' | 'pack' | 'readiness' | 'teaser'>('objectives')
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-6 mb-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-testid="pre-conference-panels"
    >
      <div className="border-b border-border px-6 py-3 flex flex-wrap items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Pre-Conference Prep
        </span>
        {prereqConfig && prereqConfig.mode !== 'NONE' && (
          <PrereqBadge config={prereqConfig} />
        )}
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
      <div className="p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList variant="line" className="mb-5">
            <TabsTrigger value="objectives" data-testid="prep-tab-objectives">
              <Target className="size-3.5" /> Objectives
            </TabsTrigger>
            <TabsTrigger value="pack" data-testid="prep-tab-pack">
              <BookOpen className="size-3.5" /> Study Pack
            </TabsTrigger>
            <TabsTrigger value="readiness" data-testid="prep-tab-readiness">
              <Activity className="size-3.5" /> Readiness
            </TabsTrigger>
            <TabsTrigger value="teaser" data-testid="prep-tab-teaser">
              <Sparkles className="size-3.5" /> Teaser video
            </TabsTrigger>
          </TabsList>
          <TabsContent value="objectives">
            {canCurate ? (
              <ObjectivesCurator sessionId={sessionId} />
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Only the host (or PD/admin) can edit objectives. Read-only preview is in the chip list above.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="pack">
            {canCurate ? (
              <StudyPackCurator sessionId={sessionId} />
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Only the host (or PD/admin) can curate the study pack. Preview the resident view at{' '}
                  <a href={`/classroom/${sessionId}/study`} className="text-primary hover:underline">
                    /classroom/{sessionId}/study
                  </a>.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="readiness">
            <ReadinessPanel sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="teaser">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Promo Teaser Video</CardTitle>
                <CardDescription>
                  Generate a 15-second silent vertical MP4 to share on WhatsApp Status / Instagram Reels.
                  Copy is auto-written by Gemini with a clinical-marketing persona.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TeaserVideoButton sessionId={sessionId} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  )
}

function PrereqBadge({ config }: { config: PrereqConfig }) {
  const enabled = [
    config.requirePreQuestions ? `pre-Qs ≥ ${config.minPreQuestions}` : null,
    config.requireStudyPack ? 'study pack' : null,
    config.requireReadinessAck ? 'readiness' : null,
  ].filter(Boolean)
  const cls =
    config.mode === 'MANDATORY'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
      data-testid="curator-prereq-badge"
    >
      <ShieldCheck className="size-3" />
      Gate: {config.mode === 'MANDATORY' ? 'Required' : 'Show only'}
      {enabled.length > 0 && (
        <span className="font-normal opacity-80">· {enabled.join(', ')}</span>
      )}
    </span>
  )
}
