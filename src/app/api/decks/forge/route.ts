// POST /api/decks/forge — generate a slide deck from an uploaded document
// and/or a recording transcript. Faculty-only. Phase A: synchronous Gemini.

import { z } from 'zod';
import { Role } from '@prisma/client';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  parseBody,
  requireAuth,
  requireCsrf,
} from '@/server/services/api-helpers';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';
import { checkRateLimit, LIMITS } from '@/server/services/rate-limit';
import { forgeDeck, DeckForgeError } from '@/server/services/decks/deck-forge-service';

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

const ForgeBody = z
  .object({
    documentId: z.string().min(1).optional(),
    recordingId: z.string().min(1).optional(),
    inputTitle: z.string().min(1).max(120).optional(),
    learnerLevel: z.string().min(1).max(80).optional(),
  })
  .refine((v) => Boolean(v.documentId || v.recordingId), {
    message: 'Either documentId or recordingId must be provided',
  });

export async function POST(req: Request) {
  const csrf = await requireCsrf(req);
  if (!csrf.ok) return csrf.response;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!FACULTY_LIKE.includes(auth.user.role)) {
    return jsonError('FORBIDDEN', 'Insufficient role', 403);
  }

  const parsed = await parseBody(req, ForgeBody);
  if (!parsed.ok) return parsed.response;

  const rl = await checkRateLimit({ bucket: `deck-forge:${auth.user.id}`, ...LIMITS.DECK_FORGE });
  if (!rl.allowed) {
    return jsonError('RATE_LIMITED', 'Forge requests throttled — try again later', 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  try {
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.DECK_FORGE_REQUESTED,
      entityType: 'DeckForgeJob',
      entityId: 'pending',
      summary: 'Deck forge requested',
      details: {
        documentId: parsed.data.documentId ?? null,
        recordingId: parsed.data.recordingId ?? null,
      },
      ...extractRequestMetadata(req),
    });

    const result = await forgeDeck({
      documentId: parsed.data.documentId ?? null,
      recordingId: parsed.data.recordingId ?? null,
      inputTitle: parsed.data.inputTitle,
      learnerLevel: parsed.data.learnerLevel,
      requestedById: auth.user.id,
    });

    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.DECK_FORGE_COMPLETED,
      entityType: 'DeckForgeJob',
      entityId: result.jobId,
      summary: 'Deck forge completed',
      details: { deckTitle: result.deckTitle, slideCount: result.slideCount },
      ...extractRequestMetadata(req),
    });

    return jsonOk(result);
  } catch (err) {
    if (err instanceof DeckForgeError) {
      await audit({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        eventType: AUDIT_EVENTS.DECK_FORGE_FAILED,
        entityType: 'DeckForgeJob',
        entityId: 'failed',
        summary: 'Deck forge failed',
        details: { code: err.code, message: err.message },
        ...extractRequestMetadata(req),
      });
      const status =
        err.code === 'NO_SOURCE'
          ? 400
          : err.code === 'SOURCE_NOT_FOUND'
            ? 404
            : err.code === 'AI_UNAVAILABLE'
              ? 503
              : 500;
      return jsonError(err.code, err.message, status);
    }
    return handleUnexpected(err);
  }
}
