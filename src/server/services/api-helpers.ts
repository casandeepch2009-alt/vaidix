// ════════════════════════════════════════════════════════════════════════════
// API Route Helpers
// ════════════════════════════════════════════════════════════════════════════
// Consistent JSON responses, error handling, auth guards.

import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { auth } from '@/auth';
import { Role } from '@prisma/client';

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(code: string, message: string, status = 400, details?: unknown): Response {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status }
  );
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError('INVALID_JSON', 'Invalid JSON body', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError('VALIDATION_ERROR', 'Request body failed validation', 422, parsed.error.flatten().fieldErrors),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function parseQuery<T>(req: Request, schema: ZodSchema<T>): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError('INVALID_QUERY', 'Query string failed validation', 422, parsed.error.flatten().fieldErrors),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function requireAuth(): Promise<{ ok: true; user: { id: string; email: string; name: string; role: Role } } | { ok: false; response: Response }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: jsonError('UNAUTHORIZED', 'Authentication required', 401) };
  }
  return {
    ok: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
  };
}

export async function requireRole(...allowed: Role[]): Promise<{ ok: true; user: { id: string; email: string; name: string; role: Role } } | { ok: false; response: Response }> {
  const gate = await requireAuth();
  if (!gate.ok) return gate;
  if (!allowed.includes(gate.user.role)) {
    return { ok: false, response: jsonError('FORBIDDEN', 'Insufficient role', 403) };
  }
  return gate;
}

export function handleUnexpected(err: unknown): Response {
  if (err instanceof ZodError) {
    return jsonError('VALIDATION_ERROR', 'Validation failed', 422, err.flatten().fieldErrors);
  }
  console.error('[api] unexpected error:', err);
  return jsonError('INTERNAL_ERROR', 'Something went wrong', 500);
}
