// ════════════════════════════════════════════════════════════════════════════
// Study Pack — resident-facing pre-session prep page
// ════════════════════════════════════════════════════════════════════════════
// Route: /classroom/[id]/study
//
// Resident sees three sections:
//   1. Pre-readings  (PDFs / docs / slides — opens signed URL in new tab)
//   2. Pre-watch videos (inline preview + "Mark as viewed" check)
//   3. Pre-cases (clicking "Start" sends them to /cases/[caseId])
//
// Server component does only auth + session lookup. The interactive list lives
// in study-pack-list.tsx so view-tracking + Start handlers can use hooks.

import { notFound, redirect } from 'next/navigation'
import { ClipboardList, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { StudyPackList } from '@/components/classroom/study-pack-list'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StudyPackPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, auth()])
  if (!session?.user) redirect(`/login?next=/classroom/${id}/study`)

  const s = await db.teachingSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      scheduledStart: true,
      scheduledEnd: true,
      sessionType: true,
      hostId: true,
    },
  })
  if (!s) notFound()

  const host = await db.user.findUnique({
    where: { id: s.hostId },
    select: { name: true },
  })

  const startStr = s.scheduledStart.toLocaleString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <Link
        href={`/classroom/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to session
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Study Pack</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Prep for <span className="font-medium text-foreground">{s.title}</span>
          {host?.name ? ` — hosted by ${host.name}` : ''} · {startStr}
        </p>
      </header>

      <StudyPackList sessionId={id} />
    </div>
  )
}
