// ════════════════════════════════════════════════════════════════════════════
// POST /api/classroom/sessions/[id]/captions/publish
// ════════════════════════════════════════════════════════════════════════════
// Browser-side captions producer (host's tab) posts finalized utterances here.
// Sibling to /live-captions/ingest (which is bearer-secret authed for an
// out-of-process Python LiveKit Agent). This route uses the Vaidix session
// cookie + CSRF + role-gate, since it's the same browser that already holds
// the auth context.
//
// Pipeline:
//   1. Append finalized segments to SessionTranscript (durable storage).
//   2. Publish to the existing Redis pub/sub channel `caption:<sessionId>`
//      so the existing SSE GET keeps working unchanged for listeners.
//
// Partial (interim) results are NOT persisted — they're broadcast on Redis
// only, so listeners see live word-by-word updates without filling DB rows.

import { z } from 'zod';
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
import { getEffectiveSessionRole } from '@/server/services/session-service';
import { redis } from '@/lib/redis';
import { liveCaptionChannel, type LiveCaptionSegment } from '@/server/services/captions/captions-pubsub';
import { appendSegment, finalizeTranscript } from '@/server/services/captions/transcript-service';
import { scheduleFirstHookRound } from '@/server/services/captions/hook-generator-service';
import { getQueue, QUEUES } from '@/lib/queue';
import { db } from '@/lib/db';

const SUPPORTED_LANGS = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'ur'] as const;

const segmentSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().min(1).max(5000),
  lang: z.enum(SUPPORTED_LANGS),
  partial: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const publishSchema = z
  .object({
    segments: z.array(segmentSchema).max(20).default([]),
    /** When true, the producer is signalling end-of-stream (e.g. host left). */
    finalizeOnEnd: z.boolean().optional(),
  })
  .refine((v) => v.segments.length > 0 || v.finalizeOnEnd === true, {
    message: 'segments must be non-empty unless finalizeOnEnd is true',
    path: ['segments'],
  });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = await requireCsrf(req);
  if (!csrf.ok) return csrf.response;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await ctx.params;

  const role = await getEffectiveSessionRole(sessionId, auth.user.id, auth.user.role);
  if (role !== 'HOST' && role !== 'CO_HOST') {
    return jsonError('FORBIDDEN', 'Only the session host can publish captions', 403);
  }

  const parsed = await parseBody(req, publishSchema);
  if (!parsed.ok) return parsed.response;

  const rl = await checkRateLimit({
    bucket: `captions-publish:${sessionId}`,
    ...LIMITS.CAPTIONS_PUBLISH,
  });
  if (!rl.allowed) {
    return jsonError(
      'RATE_LIMITED',
      'Caption publish rate exceeded',
      429,
      { resetAt: rl.resetAt.toISOString() },
    );
  }

  try {
    // Cache speaker name once per request — multiple segments in a single
    // POST body share the same speaker (the host).
    const speakerRow = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, name: true },
    });
    const speakerId = speakerRow?.id ?? null;
    const speakerName = speakerRow?.name?.trim() || null;

    const channel = liveCaptionChannel(sessionId);
    let publishedCount = 0;
    let persistedCount = 0;

    for (const seg of parsed.data.segments) {
      // Always broadcast (live listeners get partials + finals).
      const wirePayload: LiveCaptionSegment = {
        sessionId,
        startMs: seg.startMs,
        endMs: seg.endMs,
        text: seg.text,
        lang: seg.lang,
        speaker: speakerName ?? undefined,
        partial: seg.partial ?? false,
      };
      await redis.publish(channel, JSON.stringify(wirePayload));
      publishedCount++;

      // Persist only finals — partials would thrash the DB row.
      if (!seg.partial) {
        const result = await appendSegment({
          sessionId,
          language: seg.lang,
          source: 'deepgram',
          segment: {
            startMs: seg.startMs,
            endMs: seg.endMs,
            text: seg.text,
            speakerId,
            speakerName,
            confidence: seg.confidence ?? null,
          },
        });
        if (!result.capped) {
          persistedCount++;
          // On the very first persisted segment, arm the 15-min AI hook timer.
          if (persistedCount === 1) {
            scheduleFirstHookRound(sessionId).catch(() => {});
          }
        }
      }
    }

    if (parsed.data.finalizeOnEnd) {
      // When the batch carried segments, finalize their langs. When the
      // producer is sending a pure end-of-stream signal (segments=[]),
      // finalize every open transcript track for this session — Phase 1
      // writes only 'en' but this is forward-compatible with Phase 2.
      const segLangs = new Set(parsed.data.segments.map((s) => s.lang));
      const langsToFinalize: string[] = [];
      if (segLangs.size > 0) {
        langsToFinalize.push(...segLangs);
      } else {
        const open = await db.sessionTranscript.findMany({
          where: { sessionId, finalized: false },
          select: { language: true },
        });
        langsToFinalize.push(...open.map((r) => r.language));
      }
      for (const lang of langsToFinalize) {
        await finalizeTranscript({ sessionId, language: lang });
      }
      // Enqueue post-session content pack (Pearl + QA + SJT + PBL via Claude).
      // Idempotent: jobId deduplicates concurrent finalize calls.
      getQueue(QUEUES.POST_SESSION)
        .add('post-session-pack', { sessionId }, {
          jobId: `psp-auto-${sessionId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        })
        .catch(() => {}); // non-critical, don't block the response
      await audit({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        eventType: AUDIT_EVENTS.CAPTIONS_TRANSCRIPT_FINALIZED,
        entityType: 'TeachingSession',
        entityId: sessionId,
        summary: 'Live captions finalized',
        details: { languages: langsToFinalize },
        ...extractRequestMetadata(req),
      });
    }

    // Single audit per batch — per-segment would flood the audit log.
    await audit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      eventType: AUDIT_EVENTS.CAPTIONS_PUBLISHED,
      entityType: 'TeachingSession',
      entityId: sessionId,
      summary: `Captions batch (${publishedCount} broadcast, ${persistedCount} persisted)`,
      details: { publishedCount, persistedCount, finalizeOnEnd: parsed.data.finalizeOnEnd ?? false },
      ...extractRequestMetadata(req),
    });

    return jsonOk({ published: publishedCount, persisted: persistedCount });
  } catch (err) {
    return handleUnexpected(err);
  }
}
