// W6 P2 — list case-library templates with the same filters the old mock UI had
import { z } from 'zod';
import { CaseDifficulty } from '@prisma/client';
import {
  jsonOk,
  requireAuth,
  handleUnexpected,
  parseQuery,
} from '@/server/services/api-helpers';
import { listCaseTemplates } from '@/server/services/cases/cases-service';

const querySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  difficulty: z.nativeEnum(CaseDifficulty).optional(),
  bloomsLevel: z.coerce.number().int().min(1).max(6).optional(),
  specialty: z.string().trim().min(1).max(80).optional(),
  topicSlug: z.string().trim().min(1).max(60).optional(),
});

export async function GET(req: Request) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const q = await parseQuery(req, querySchema);
    if (!q.ok) return q.response;
    const items = await listCaseTemplates(q.data);
    return jsonOk({ items });
  } catch (err) {
    return handleUnexpected(err);
  }
}
