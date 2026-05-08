// PATCH /api/decks/[jobId]/slides/[slideId] — edit one slide.

import { z } from 'zod';
import { Role, SlideLayout } from '@prisma/client';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  parseBody,
  requireAuth,
  requireCsrf,
} from '@/server/services/api-helpers';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';
import { db } from '@/lib/db';

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

const PatchBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    bullets: z.array(z.string().min(1).max(200)).max(8).optional(),
    speakerNotes: z.string().max(2000).optional().nullable(),
    layout: z.nativeEnum(SlideLayout).optional(),
    accentHex: z
      .string()
      .regex(/^[0-9a-fA-F]{6}$/, 'accentHex must be 6 hex chars without #')
      .optional()
      .nullable(),
  })
  .refine(
    (v) =>
      Object.keys(v).length > 0,
    { message: 'At least one field must be provided' },
  );

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobId: string; slideId: string }> },
) {
  const csrf = await requireCsrf(req);
  if (!csrf.ok) return csrf.response;
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!FACULTY_LIKE.includes(auth.user.role)) return jsonError('FORBIDDEN', 'Insufficient role', 403);
  const { jobId, slideId } = await ctx.params;
  const parsed = await parseBody(req, PatchBody);
  if (!parsed.ok) return parsed.response;

  try {
    const slide = await db.slide.findUnique({
      where: { id: slideId },
      select: { id: true, deckForgeJobId: true, job: { select: { requestedById: true } } },
    });
    if (!slide || slide.deckForgeJobId !== jobId) {
      return jsonError('NOT_FOUND', 'Slide not found', 404);
    }
    if (
      slide.job.requestedById !== auth.user.id &&
      auth.user.role !== Role.ADMIN &&
      auth.user.role !== Role.PROGRAM_DIRECTOR
    ) {
      return jsonError('FORBIDDEN', 'Not your deck', 403);
    }
    const updated = await db.slide.update({
      where: { id: slideId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.bullets !== undefined ? { bullets: parsed.data.bullets } : {}),
        ...(parsed.data.speakerNotes !== undefined ? { speakerNotes: parsed.data.speakerNotes } : {}),
        ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout } : {}),
        ...(parsed.data.accentHex !== undefined ? { accentHex: parsed.data.accentHex } : {}),
      },
    });
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.DECK_SLIDE_UPDATED,
      entityType: 'Slide',
      entityId: slideId,
      summary: 'Slide edited',
      details: { jobId, fields: Object.keys(parsed.data) },
      ...extractRequestMetadata(req),
    });
    return jsonOk({ slide: updated });
  } catch (err) {
    return handleUnexpected(err);
  }
}
