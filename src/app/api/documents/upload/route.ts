// ════════════════════════════════════════════════════════════════════════════
// /api/documents/upload — server-proxied file upload
// ════════════════════════════════════════════════════════════════════════════
// Accepts multipart/form-data (fields: title, description?, file).
// Streams the file from the browser to MinIO on the server side — no
// browser→MinIO CORS config required.
//
// Next.js App Router does not buffer multipart bodies in the router itself;
// the formData() call below reads it once. For files >50 MB on Vercel, the
// 10 s default timeout would fire — set maxDuration = 120 for local/VPS.

import { Role } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3, BUCKET, ensureBucket } from '@/lib/storage';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  requireAuth,
} from '@/server/services/api-helpers';
import { inferKind, buildDocumentKey } from '@/server/services/documents/document-service';
import { DocumentRoute, DocumentStatus } from '@prisma/client';
import { checkRateLimit, LIMITS } from '@/server/services/rate-limit';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';

export const maxDuration = 120;

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!FACULTY_LIKE.includes(auth.user.role)) {
    return jsonError('FORBIDDEN', 'Only faculty/PD/admin can upload documents', 403);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError('INVALID_BODY', 'Expected multipart/form-data', 400);
  }

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || undefined;
  const file = formData.get('file');

  if (!title) return jsonError('VALIDATION_ERROR', 'Title is required', 422);
  if (!(file instanceof File) || file.size === 0) {
    return jsonError('VALIDATION_ERROR', 'File is required', 422);
  }

  const maxBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return jsonError('TOO_LARGE', `File exceeds ${env.MAX_UPLOAD_SIZE_MB} MB limit`, 413);
  }

  const rl = await checkRateLimit({
    bucket: `doc-upload:${auth.user.id}`,
    ...LIMITS.DOCUMENT_UPLOAD,
  });
  if (!rl.allowed) {
    return jsonError('RATE_LIMITED', 'Too many document uploads — try again later', 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  const mimeType = file.type || 'application/octet-stream';
  const kind = inferKind(mimeType);
  const s3Key = buildDocumentKey(auth.user.id, file.name);

  try {
    await ensureBucket();

    const bytes = await file.arrayBuffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: Buffer.from(bytes),
        ContentType: mimeType,
        ContentLength: file.size,
      })
    );

    const doc = await db.document.create({
      data: {
        uploadedById: auth.user.id,
        title,
        description: description ?? null,
        kind,
        route: DocumentRoute.UNCLASSIFIED,
        s3Key,
        sizeBytes: BigInt(file.size),
        mimeType,
        status: DocumentStatus.UPLOADED,
        visibility: DocumentStatus.PRIVATE_FACULTY,
      },
      select: { id: true, s3Key: true, status: true, kind: true, route: true },
    });

    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.DOCUMENT_UPLOAD_INITIATED,
      entityType: 'Document',
      entityId: doc.id,
      summary: `Document uploaded: ${title}`,
      details: { filename: file.name, mimeType, sizeBytes: file.size, kind: doc.kind },
      ...extractRequestMetadata(req),
    });

    return jsonOk({ document: doc }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err);
  }
}
