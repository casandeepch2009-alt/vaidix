// W6 — list topics, optionally filtered by subspecialty
import { z } from 'zod';
import {
  jsonOk,
  requireAuthWithProgram,
  handleUnexpected,
  parseQuery,
} from '@/server/services/api-helpers';
import { listTopics } from '@/server/services/topics/topics-service';

const querySchema = z.object({
  subspecialty: z.string().trim().min(1).max(40).optional(),
});

export async function GET(req: Request) {
  try {
    // W6.11 — topic curriculum is per-program.
    const gate = await requireAuthWithProgram();
    if (!gate.ok) return gate.response;
    const q = await parseQuery(req, querySchema);
    if (!q.ok) return q.response;
    const items = await listTopics({
      programId: gate.user.activeProgramId,
      subspecialty: q.data.subspecialty,
    });
    return jsonOk({ items });
  } catch (err) {
    return handleUnexpected(err);
  }
}
