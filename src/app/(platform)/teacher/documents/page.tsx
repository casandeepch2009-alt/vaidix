// ════════════════════════════════════════════════════════════════════════════
// /teacher/documents — Faculty Document Library (W4 Stream C)
// ════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Role } from '@prisma/client';
import { BookOpen } from 'lucide-react';
import { listDocuments } from '@/server/services/documents/document-service';
import { DocumentsLibraryClient } from './documents-library-client';

export const dynamic = 'force-dynamic';

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

export default async function FacultyDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/teacher/documents');
  if (!FACULTY_LIKE.includes(session.user.role)) redirect('/dashboard');

  // Faculty get a true personal folder — only their own uploads. Program
  // directors and admins keep the full view for moderation.
  const personalOnly = session.user.role === Role.FACULTY;
  const documents = await listDocuments(
    { userId: session.user.id, role: session.user.role },
    { mine: personalOnly },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <BookOpen className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {personalOnly ? 'My Documents' : 'Teacher library'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {personalOnly
              ? 'Your personal folder — PDFs, slides, notes & videos.'
              : 'All teacher uploads — moderation view.'}{' '}
            <span className="font-semibold text-foreground">{documents.length}</span> saved.
          </p>
        </div>
      </div>

      <DocumentsLibraryClient initialDocuments={documents} />
    </div>
  );
}
