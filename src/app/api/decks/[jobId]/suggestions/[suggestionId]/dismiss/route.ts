// POST /api/decks/[jobId]/suggestions/[suggestionId]/dismiss
// Marks one DeckSuggestion as dismissed. Carry-forward in analyzeDeck() keeps
// it dismissed across re-analyses so faculty isn't re-pestered.

import { Role } from '@prisma/client';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  requireAuth,
  requireCsrf,
} from '@/server/services/api-helpers';
import { db } from '@/lib/db';
import { audit, AUDIT_EVENTS, extractRequestMetadata } from '@/server/services/audit';
import { dismissSuggestion, DeckAnalyzeError } from '@/server/services/decks/deck-analyze-service';

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string; suggestionId: string }> },
) {
  const csrf = await requireCsrf(req);
  if (!csrf.ok) return csrf.response;
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!FACULTY_LIKE.includes(auth.user.role)) {
    return jsonError('FORBIDDEN', 'Insufficient role', 403);
  }
  const { jobId, suggestionId } = await ctx.params;

  const job = await db.deckForgeJob.findUnique({
    where: { id: jobId },
    select: { requestedById: true },
  });
  if (!job) return jsonError('NOT_FOUND', 'Deck not found', 404);
  if (
    job.requestedById !== auth.user.id &&
    auth.user.role !== Role.ADMIN &&
    auth.user.role !== Role.PROGRAM_DIRECTOR
  ) {
    return jsonError('FORBIDDEN', 'Not your deck', 403);
  }

  try {
    const result = await dismissSuggestion(jobId, suggestionId);
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.DECK_SUGGESTION_DISMISSED,
      entityType: 'DeckForgeJob',
      entityId: jobId,
      summary: `Dismissed suggestion ${suggestionId}`,
      details: { suggestionId },
      ...extractRequestMetadata(req),
    });
    return jsonOk({ analysis: result });
  } catch (err) {
    if (err instanceof DeckAnalyzeError) {
      const status =
        err.code === 'NOT_FOUND' || err.code === 'SUGGESTION_NOT_FOUND' ? 404 : 400;
      return jsonError(err.code, err.message, status);
    }
    return handleUnexpected(err);
  }
}
