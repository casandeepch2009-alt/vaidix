'use client'

import { Shield, Eye, AlertTriangle, BarChart3, GitCompare, FileSearch } from 'lucide-react'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function FacultyAIAuditPage() {
  return (
    <ComingSoon
      icon={Shield}
      title="AI Audit"
      subtitle="Review and validate AI-generated assessments"
      description="Vaidix AI assists with case hints, Pearl generation, and DOPS scoring suggestions. This module lets you audit those outputs, flag inaccuracies, correct hallucinations, and improve model quality over time — all with a traceable review trail."
      backHref="/dashboard"
      backLabel="Back to dashboard"
      accentFrom="from-violet-500"
      accentTo="to-blue-600"
      features={[
        {
          icon: Eye,
          title: 'AI Output Review',
          description: 'Inspect every AI-generated hint, explanation, and scoring suggestion shown to residents.',
        },
        {
          icon: AlertTriangle,
          title: 'Flag Hallucinations',
          description: 'Mark factually incorrect or clinically misleading AI outputs for retraining.',
        },
        {
          icon: GitCompare,
          title: 'Diff View',
          description: 'Compare AI output against your corrected version side by side.',
        },
        {
          icon: BarChart3,
          title: 'Confidence Scores',
          description: 'See model confidence per output — low-confidence items are surfaced first.',
        },
        {
          icon: FileSearch,
          title: 'Audit Trail',
          description: 'Full traceable log of every AI interaction with resident and faculty timestamps.',
        },
        {
          icon: Shield,
          title: 'RLHF Pipeline',
          description: 'Approved corrections feed directly into the Vaidix Core fine-tuning queue.',
        },
      ]}
    />
  )
}
