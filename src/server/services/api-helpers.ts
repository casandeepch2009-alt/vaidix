// ════════════════════════════════════════════════════════════════════════════
// API Route Helpers
// ════════════════════════════════════════════════════════════════════════════
// Consistent JSON responses, error handling, auth guards.

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZodError, type ZodSchema } from 'zod';
import { auth } from '@/auth';
import { Role } from '@prisma/client';
import { isUserCurrent } from '@/server/services/auth-service';
import { redis } from '@/lib/redis';

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

// HARDENING-PLAN.md item #13 — re-validate that the JWT's passwordVersion
// still matches the user's current passwordVersion in DB. A bumped version
// (admin suspension, password change, forced logout) revokes every existing
// JWT within `SESSION_RECHECK_TTL_SEC` even though the JWT itself hasn't
// expired yet. Result is cached in Redis to keep latency flat under load.
const SESSION_RECHECK_TTL_SEC = 30;
// ioredis is configured with `maxRetriesPerRequest: null` (required by BullMQ),
// which means commands queue forever when Redis is down instead of throwing.
// We race redis calls with a short timeout so a stopped Redis container
// degrades to "miss + DB lookup" in 250ms instead of hanging the request.
const REDIS_TIMEOUT_MS = 250;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('REDIS_TIMEOUT')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function isSessionStillValid(userId: string, passwordVersion: number): Promise<boolean> {
  const key = `pwver:ok:${userId}:${passwordVersion}`;
  try {
    const cached = await withTimeout(redis.get(key), REDIS_TIMEOUT_MS);
    if (cached) return true;
  } catch {
    // Redis down or slow → fall through to DB. Don't fail-open to "valid".
  }
  const current = await isUserCurrent(userId, passwordVersion);
  if (current) {
    try {
      await withTimeout(redis.set(key, '1', 'EX', SESSION_RECHECK_TTL_SEC), REDIS_TIMEOUT_MS);
    } catch {
      // best-effort cache; not fatal.
    }
  }
  return current;
}

export async function requireAuth(): Promise<{ ok: true; user: { id: string; email: string; name: string; role: Role } } | { ok: false; response: Response }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: jsonError('UNAUTHORIZED', 'Authentication required', 401) };
  }
  const valid = await isSessionStillValid(session.user.id, session.user.passwordVersion);
  if (!valid) {
    return {
      ok: false,
      response: jsonError(
        'SESSION_REVOKED',
        'Your session has been revoked — please sign in again.',
        401
      ),
    };
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

// HARDENING-PLAN item #15 — CSRF double-submit cookie pattern.
//
// Wire-up: NextAuth's middleware sets/refreshes the `vaidix-csrf` cookie
// (non-httpOnly, SameSite=Lax) when missing. Browser JS reads it and echoes
// the value into the `x-csrf-token` request header on every POST/PATCH/PUT/
// DELETE. Server compares the two with constant-time equality; mismatch =
// 403. Bearer-token routes (LiveKit webhook, captions ingest, agent log
// ingest) are exempt — they authenticate via their own shared-secret check.
//
// Use `requireCsrf(req)` at the top of any mutating handler that doesn't
// already use bearer auth. (Login/forgot-password/reset are also exempt
// because they pre-date the session and NextAuth does its own CSRF on those.)

export const CSRF_COOKIE_NAME = 'vaidix-csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE_NAME)?.value;
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString('hex');
  jar.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // intentional — JS must read it to send the header
    path: '/',
    maxAge: 60 * 60 * 24, // 24h, refreshed on next visit
  });
  return token;
}

export async function requireCsrf(
  req: Request
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return { ok: true };
  const jar = await cookies();
  const cookieVal = jar.get(CSRF_COOKIE_NAME)?.value ?? '';
  const headerVal = req.headers.get(CSRF_HEADER_NAME) ?? '';
  if (!cookieVal || !headerVal || cookieVal.length !== headerVal.length) {
    return { ok: false, response: jsonError('CSRF_REQUIRED', 'CSRF token missing or malformed', 403) };
  }
  const a = Buffer.from(cookieVal);
  const b = Buffer.from(headerVal);
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, response: jsonError('CSRF_MISMATCH', 'CSRF token mismatch', 403) };
  }
  return { ok: true };
}

export function handleUnexpected(err: unknown): Response {
  if (err instanceof ZodError) {
    return jsonError('VALIDATION_ERROR', 'Validation failed', 422, err.flatten().fieldErrors);
  }
  console.error('[api] unexpected error:', err);
  // In dev, surface the underlying message so the UI can show a useful hint.
  if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
    return jsonError('INTERNAL_ERROR', `Something went wrong: ${err.message}`, 500);
  }
  return jsonError('INTERNAL_ERROR', 'Something went wrong', 500);
}
