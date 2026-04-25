// POST /api/classroom/sessions/[id]/live-captions/ingest
// Receives caption segments from the LiveKit Agent (Python sidecar) and
// publishes them to Redis pub/sub for SSE broadcast.
// Auth: shared-secret bearer in Authorization header (LIVE_CAPTIONS_INGEST_SECRET).

import { z } from 'zod';
import { env } from '@/lib/env';
import { redis } from '@/lib/redis';
import { handleUnexpected, jsonError, jsonOk, parseBody } from '@/server/services/api-helpers';
import { liveCaptionChannel, type LiveCaptionSegment } from '@/server/services/captions/captions-pubsub';

const segmentSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().min(1).max(5000),
  lang: z.enum(['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'ur']),
  speaker: z.string().max(60).optional(),
  partial: z.boolean().optional(),
});

const ingestSchema = z.object({
  segments: z.array(segmentSchema).min(1).max(50),
});

function isAuthorized(req: Request): boolean {
  if (!env.LIVE_CAPTIONS_INGEST_SECRET) return false;
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === env.LIVE_CAPTIONS_INGEST_SECRET;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    return jsonError('UNAUTHORIZED', 'Invalid or missing ingest secret', 401);
  }
  const body = await parseBody(req, ingestSchema);
  if (!body.ok) return body.response;
  const { id: sessionId } = await ctx.params;

  try {
    const channel = liveCaptionChannel(sessionId);
    let published = 0;
    for (const seg of body.data.segments) {
      const payload: LiveCaptionSegment = { ...seg, sessionId };
      await redis.publish(channel, JSON.stringify(payload));
      published++;
    }
    return jsonOk({ published });
  } catch (err) {
    return handleUnexpected(err);
  }
}
