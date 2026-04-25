// Hybrid chat: LiveKit data channels for realtime, DB for persistence + scrollback
import { jsonOk, jsonError, requireAuth, parseBody, handleUnexpected } from '@/server/services/api-helpers';
import { db } from '@/lib/db';
import { getEffectiveSessionRole } from '@/server/services/session-service';
import { z } from 'zod';

const postSchema = z.object({ content: z.string().min(1).max(2000) });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const { id: sessionId } = await ctx.params;

    const role = await getEffectiveSessionRole(sessionId, gate.user.id, gate.user.role);
    if (!role) return jsonError('FORBIDDEN', 'No access to this session', 403);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 200);

    const messages = await db.sessionChatMessage.findMany({
      where: { sessionId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return jsonOk({ messages: messages.reverse() });
  } catch (err) {
    return handleUnexpected(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;
    const body = await parseBody(req, postSchema);
    if (!body.ok) return body.response;

    const { id: sessionId } = await ctx.params;
    const role = await getEffectiveSessionRole(sessionId, gate.user.id, gate.user.role);
    if (!role || role === 'VIEWER') {
      return jsonError('FORBIDDEN', 'No chat permission', 403);
    }

    const message = await db.sessionChatMessage.create({
      data: {
        sessionId,
        userId: gate.user.id,
        content: body.data.content,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return jsonOk({ message }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err);
  }
}
