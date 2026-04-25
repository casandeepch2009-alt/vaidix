// ════════════════════════════════════════════════════════════════════════════
// /faculty/documents — Faculty Document Library (W4 Stream C)
// ════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { Role } from '@prisma/client';
import { listDocuments } from '@/server/services/documents/document-service';
import { DocumentsLibraryClient } from './documents-library-client';

export const dynamic = 'force-dynamic';

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

export default async function FacultyDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?next=/faculty/documents');
  if (!FACULTY_LIKE.includes(session.user.role)) redirect('/dashboard');

  const documents = await listDocuments({ userId: session.user.id, role: session.user.role });

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faculty Document Library</h1>
          <p className="text-sm text-muted-foreground">
            Upload, classify, and tag documents to teaching sessions.
          </p>
        </div>
        <Link
          href="#upload"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Upload document
        </Link>
      </div>

      <DocumentsLibraryClient initialDocuments={documents} />
    </div>
  );
}
