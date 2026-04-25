'use client';

// ════════════════════════════════════════════════════════════════════════════
// DocumentsLibraryClient — upload modal + library listing + classification
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentRoute } from '@prisma/client';

interface DocumentRow {
  id: string;
  title: string;
  kind: string;
  route: DocumentRoute;
  status: string;
  visibility: string;
  uploaderName: string;
  sizeBytes: number;
  createdAt: string;
}

const ROUTE_LABEL: Record<DocumentRoute, string> = {
  DECK_FORGE: 'PPT to polish',
  REFERENCE: 'Reference',
  CASE_NOTE: 'Case notes',
  PROMO_ASSET: 'Promo asset',
  UNCLASSIFIED: 'Unclassified',
};

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsLibraryClient({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocuments);
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/documents', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { ok: boolean; data?: { documents: DocumentRow[] } };
    if (json.ok && json.data) setDocs(json.data.documents);
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file') as File | null;
    const title = String(fd.get('title') ?? '').trim();
    if (!file || !title) {
      setUploadError('Title and file are required');
      return;
    }
    setUploading(true);
    try {
      const draftRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: String(fd.get('description') ?? ''),
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      const draft = (await draftRes.json()) as {
        ok: boolean;
        data?: { presignedUploadUrl: string; document: { id: string } };
        error?: { message: string };
      };
      if (!draft.ok || !draft.data) throw new Error(draft.error?.message ?? 'Failed to create draft');

      // PUT directly to MinIO
      const putRes = await fetch(draft.data.presignedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Storage upload failed: ${putRes.status}`);

      // Trigger classification
      await fetch(`/api/documents/${draft.data.document.id}/classify`, { method: 'POST' });
      form.reset();
      await refresh();
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function approveRoute(id: string, route: DocumentRoute) {
    setClassifying(id);
    try {
      await fetch(`/api/documents/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route }),
      });
      await refresh();
    } finally {
      setClassifying(null);
    }
  }

  return (
    <div className="space-y-6">
      <section
        id="upload"
        className="rounded-lg border border-border bg-card p-6"
      >
        <h2 className="text-lg font-medium">Upload</h2>
        <p className="text-sm text-muted-foreground">
          PPT / PDF / DOC / image / video. Max 500 MB.
        </p>
        <form onSubmit={handleUpload} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            required
            placeholder="Title (e.g. PDR Management Algorithm)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            name="file"
            type="file"
            required
            accept=".ppt,.pptx,.pdf,.doc,.docx,.md,.png,.jpg,.jpeg,.mp4,.mov"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="Optional description"
            className="sm:col-span-2 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload + classify'}
            </button>
            {uploadError && <p className="mt-2 text-sm text-destructive">{uploadError}</p>}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="border-b p-4">
          <h2 className="text-lg font-medium">Library ({docs.length})</h2>
        </header>
        {docs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No documents yet — upload one above.</p>
        ) : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="grid gap-3 p-4 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.kind} · {formatSize(d.sizeBytes)} · uploaded by {d.uploaderName}
                  </p>
                </div>
                <div className="text-sm sm:col-span-3">
                  <span className="rounded-full bg-muted px-2 py-1">
                    {ROUTE_LABEL[d.route]}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{d.status}</p>
                </div>
                <div className="sm:col-span-4">
                  <div className="flex flex-wrap gap-1">
                    {(['DECK_FORGE', 'REFERENCE', 'CASE_NOTE', 'PROMO_ASSET'] as DocumentRoute[]).map(
                      (r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={classifying === d.id || d.route === r}
                          onClick={() => approveRoute(d.id, r)}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            d.route === r ? 'bg-foreground text-background' : 'hover:bg-muted'
                          } disabled:opacity-50`}
                        >
                          {ROUTE_LABEL[r]}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
