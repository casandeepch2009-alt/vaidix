// W6 — list topics, optionally filtered by subspecialty
import { z } from 'zod';
import {
  jsonOk,
  requireAuth,
  handleUnexpected,
  parseQuery,
} from '@/server/services/api-helpers';
import { listTopics } from '@/server/services/topics/topics-service';

const querySchema = z.object({
  subspecialty: z.string().trim().min(1).max(40).optional(),
});

export async function GET(req: Request) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const q = await parseQuery(req, querySchema);
    if (!q.ok) return q.response;
    const items = await listTopics({ subspecialty: q.data.subspecialty });
    return jsonOk({ items });
  } catch (err) {
    return handleUnexpected(err);
  }
}
