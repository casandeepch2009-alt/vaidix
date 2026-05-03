'use client'

import { BookOpen, Search, MessageSquare, BarChart3, Users, FileText } from 'lucide-react'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function FacultyCasesPage() {
  return (
    <ComingSoon
      icon={BookOpen}
      title="Faculty Case Review"
      subtitle="Review and annotate resident case submissions"
      description="This module lets you review ophthalmic cases submitted by residents, add structured feedback, track learning gaps across your cohort, and contribute high-quality cases to the shared knowledge base."
      backHref="/dashboard"
      backLabel="Back to dashboard"
      features={[
        {
          icon: Search,
          title: 'Case Browser',
          description: 'Filter cases by subspecialty, difficulty, resident, or date range.',
        },
        {
          icon: MessageSquare,
          title: 'Structured Feedback',
          description: 'Annotate diagnosis, management plan, and clinical reasoning with rubric-based scoring.',
        },
        {
          icon: BarChart3,
          title: 'Gap Analytics',
          description: 'Spot recurring knowledge gaps across residents and cohorts.',
        },
        {
          icon: Users,
          title: 'Peer Review',
          description: 'Co-review complex cases with colleagues before marking them complete.',
        },
        {
          icon: FileText,
          title: 'Knowledge Base Export',
          description: 'Promote excellent cases into the shared teaching library.',
        },
        {
          icon: BookOpen,
          title: 'Case Templates',
          description: 'Reusable templates for grand rounds, clinics, and surgical cases.',
        },
      ]}
    />
  )
}
