// /api/learners/[id]/coach
// Stream D #19 — Teaching Bot Reinforcement Coach.
// POST: ask the coach a free-form question. Stateless in Phase A — response is
//       returned directly. Persistence (CoachInteraction model) lands in W7
//       when the journal/coach surface gets saved transcripts.
//
// Phase A note: full Gemini integration uses the existing /api/grade pattern
// (gemini-grader.ts) but coach has its own persona prompt. Until the Gemini
// helper is added, this returns a structured placeholder. The contract is
// stable so the swap is one file.

import { z } from 'zod';
import { Role } from '@prisma/client';
import {
  handleUnexpected,
  jsonError,
  jsonOk,
  parseBody,
  requireAuth,
} from '@/server/services/api-helpers';
import { db } from '@/lib/db';
import { checkRateLimit, LIMITS } from '@/server/services/rate-limit';

const askSchema = z.object({
  question: z.string().min(1).max(2000),
});

interface CoachReply {
  answer: string;
  followUpQuiz: string;
  caseExample: string;
}

function placeholderCoachResponse(question: string): CoachReply {
  // Phase A placeholder. Real implementation calls Gemini with a coach persona.
  return {
    answer: `Coaching response for: "${question.slice(0, 80)}". (Phase A placeholder — Gemini hook pending in Stream D follow-up.)`,
    followUpQuiz: 'Follow-up: which finding most reliably differentiates the two diagnoses?',
    caseExample: 'Case example: 58 y/o diabetic with sudden vision loss — apply the framework above.',
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, askSchema);
  if (!body.ok) return body.response;
  const { id: learnerId } = await ctx.params;

  // A learner can coach themselves; admins/PD/faculty can coach anyone.
  if (
    learnerId !== auth.user.id &&
    auth.user.role !== Role.ADMIN &&
    auth.user.role !== Role.PROGRAM_DIRECTOR &&
    auth.user.role !== Role.FACULTY
  ) {
    return jsonError('FORBIDDEN', 'Cannot coach another user', 403);
  }

  const rl = await checkRateLimit({ bucket: `coach:${auth.user.id}`, ...LIMITS.COACH_ASK });
  if (!rl.allowed) {
    return jsonError('RATE_LIMITED', 'Coach throttled — try again later', 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  try {
    const learner = await db.user.findUnique({ where: { id: learnerId }, select: { id: true } });
    if (!learner) return jsonError('NOT_FOUND', 'Learner not found', 404);
    const reply = placeholderCoachResponse(body.data.question);
    return jsonOk({ reply });
  } catch (err) {
    return handleUnexpected(err);
  }
}
