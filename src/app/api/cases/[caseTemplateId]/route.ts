// W6 P2 — fetch one case-library template (by id or legacyId)
import {
  jsonOk,
  jsonError,
  requireAuth,
  handleUnexpected,
} from '@/server/services/api-helpers';
import { getCaseTemplate, CasesError } from '@/server/services/cases/cases-service';

export async function GET(_req: Request, ctx: { params: Promise<{ caseTemplateId: string }> }) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const { caseTemplateId } = await ctx.params;
    const t = await getCaseTemplate(caseTemplateId);
    return jsonOk(t);
  } catch (err) {
    if (err instanceof CasesError && err.code === 'NOT_FOUND') {
      return jsonError('NOT_FOUND', err.message, 404);
    }
    return handleUnexpected(err);
  }
}
