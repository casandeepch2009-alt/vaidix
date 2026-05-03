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
import { ClipboardList, BookOpen, Activity, Sparkles, Target } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StudyPackCurator } from './study-pack-curator'
import { ReadinessPanel } from './readiness-panel'
import { TeaserVideoButton } from './teaser-video-button'
import { ObjectivesChipList, type ObjectiveRow } from './objectives-chip-list'
import { ObjectivesCurator } from './objectives-curator'

export function PreConferencePrepBlock({
  sessionId,
  canCurate,
  objectives = [],
}: {
  sessionId: string
  canCurate: boolean
  objectives?: ObjectiveRow[]
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
      <div className="border-b border-border px-6 py-3 flex items-center gap-2">
        <ClipboardList className="size-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Pre-Conference Prep
        </span>
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
