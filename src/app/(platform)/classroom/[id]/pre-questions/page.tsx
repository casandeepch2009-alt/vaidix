// W6 — /classroom/[id]/pre-questions: resident-facing submit + vote board
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { PreQuestionsBoard } from '@/components/classroom/pre-questions-board';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PreQuestionsPage({ params }: PageProps) {
  const [{ id: sessionId }, session] = await Promise.all([params, auth()]);
  if (!session?.user) redirect(`/login?next=/classroom/${sessionId}/pre-questions`);

  const teaching = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      scheduledStart: true,
      hostId: true,
      host: { select: { name: true } },
    },
  });
  if (!teaching) notFound();

  const canViewDashboard =
    session.user.role === Role.ADMIN ||
    session.user.role === Role.PROGRAM_DIRECTOR ||
    teaching.hostId === session.user.id;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Pre-Conference Questions
        </p>
        <h1 className="text-2xl font-semibold">{teaching.title}</h1>
        <p className="text-sm text-muted-foreground">
          Hosted by {teaching.host.name} · {new Date(teaching.scheduledStart).toLocaleString()}
        </p>
        {canViewDashboard ? (
          <p className="text-sm">
            <Link
              href={`/classroom/${sessionId}/pre-questions/dashboard`}
              className="text-primary hover:underline"
            >
              Open presenter dashboard →
            </Link>
          </p>
        ) : null}
      </header>

      <PreQuestionsBoard sessionId={sessionId} currentUserId={session.user.id} />
    </div>
  );
}
