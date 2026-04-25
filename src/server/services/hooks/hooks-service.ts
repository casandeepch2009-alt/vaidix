// ════════════════════════════════════════════════════════════════════════════
// Live Hooks Service — Stream D #4
// ════════════════════════════════════════════════════════════════════════════
// Faculty creates hooks ahead of time (or queues recurring ones every 6–8 min).
// At runtime, the LiveSession client polls /hooks?live=1 to discover newly
// fired hooks. Responses go to /hooks/[hookId]/respond and emit a HOOK_RESPONSE
// engagement signal automatically.

import { db } from '@/lib/db';
import { LiveHookKind, Role, EngagementSignalKind } from '@prisma/client';
import { recordEngagementSignal } from '@/server/services/engagement/engagement-service';

export interface CreateHookInput {
  sessionId: string;
  createdById: string;
  kind: LiveHookKind;
  prompt: string;
  options?: string[];
  correctOption?: string;
  explanation?: string;
  intervalSeconds?: number;
  scheduledAt?: Date;
}

export async function createHook(input: CreateHookInput): Promise<{ id: string }> {
  const hook = await db.liveHook.create({
    data: {
      sessionId: input.sessionId,
      createdById: input.createdById,
      kind: input.kind,
      prompt: input.prompt,
      options: input.options ? (input.options as unknown as object) : undefined,
      correctOption: input.correctOption,
      explanation: input.explanation,
      intervalSeconds: input.intervalSeconds,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
    select: { id: true },
  });
  return hook;
}

export async function fireHook(hookId: string, presenterId: string): Promise<void> {
  // Only the host can fire a hook.
  const hook = await db.liveHook.findUnique({
    where: { id: hookId },
    select: { id: true, sessionId: true, firedAt: true, session: { select: { hostId: true } } },
  });
  if (!hook) throw new Error('Hook not found');
  if (hook.session.hostId !== presenterId) throw new Error('Only host can fire hook');
  if (hook.firedAt) return; // idempotent
  await db.liveHook.update({
    where: { id: hookId },
    data: { firedAt: new Date() },
  });
}

export async function listLiveHooks(
  sessionId: string,
  opts: { sinceMs?: number; onlyFired?: boolean } = {}
): Promise<Array<{
  id: string;
  kind: LiveHookKind;
  prompt: string;
  options: string[] | null;
  intervalSeconds: number | null;
  scheduledAt: string | null;
  firedAt: string | null;
  closedAt: string | null;
}>> {
  const since = opts.sinceMs ? new Date(opts.sinceMs) : undefined;
  const rows = await db.liveHook.findMany({
    where: {
      sessionId,
      ...(opts.onlyFired ? { firedAt: { not: null } } : {}),
      ...(since ? { OR: [{ createdAt: { gte: since } }, { firedAt: { gte: since } }] } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    prompt: r.prompt,
    options: Array.isArray(r.options) ? (r.options as string[]) : null,
    intervalSeconds: r.intervalSeconds,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    firedAt: r.firedAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
  }));
}

export async function recordHookResponse(input: {
  hookId: string;
  userId: string;
  response: string;
  latencyMs?: number;
}): Promise<{ isCorrect: boolean | null }> {
  const hook = await db.liveHook.findUnique({
    where: { id: input.hookId },
    select: { id: true, sessionId: true, correctOption: true, closedAt: true },
  });
  if (!hook) throw new Error('Hook not found');
  if (hook.closedAt) throw new Error('Hook closed');

  const isCorrect = hook.correctOption == null ? null : hook.correctOption === input.response;
  await db.liveHookResponse.upsert({
    where: { hookId_userId: { hookId: hook.id, userId: input.userId } },
    create: {
      hookId: hook.id,
      userId: input.userId,
      response: input.response,
      isCorrect,
      latencyMs: input.latencyMs ?? null,
    },
    update: {
      response: input.response,
      isCorrect,
      latencyMs: input.latencyMs ?? null,
    },
  });

  await recordEngagementSignal({
    sessionId: hook.sessionId,
    userId: input.userId,
    kind: EngagementSignalKind.HOOK_RESPONSE,
    value: isCorrect == null ? 0 : isCorrect ? 1 : 0,
    metadata: { hookId: hook.id, response: input.response, latencyMs: input.latencyMs },
  });

  return { isCorrect };
}

export async function userCanCreateHook(
  sessionId: string,
  userId: string,
  role: Role
): Promise<boolean> {
  if (role === Role.ADMIN || role === Role.PROGRAM_DIRECTOR) return true;
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });
  return !!session && session.hostId === userId;
}
