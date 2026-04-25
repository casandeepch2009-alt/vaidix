// ════════════════════════════════════════════════════════════════════════════
// W4 e2e helpers — shared cookie jar, login, fetch, assertions
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the pattern from scripts/e2e-w1.ts and e2e-w2.ts.

import bcrypt from 'bcryptjs';
import { PrismaClient, Role, UserStatus } from '@prisma/client';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const db = new PrismaClient();

export class CookieJar {
  private cookies = new Map<string, string>();
  update(setCookieHeader: string | string[] | null) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader.split(',').filter((s) => s.includes('='));
    for (const raw of headers) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (value === '' || /Expires=Thu, 01 Jan 1970/.test(raw)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  clear() {
    this.cookies.clear();
  }
}

export async function doFetch(jar: CookieJar, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const cookieHeader = jar.header();
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  const setCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookie?.length) jar.update(setCookie);
  else jar.update(res.headers.get('set-cookie'));
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonResult = { status: number; json: any };

export async function jsonPost(jar: CookieJar, path: string, body?: unknown): Promise<JsonResult> {
  const res = await doFetch(jar, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: text };
  }
}

export async function jsonGet(jar: CookieJar, path: string): Promise<JsonResult> {
  const res = await doFetch(jar, path);
  const text = await res.text();
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: text };
  }
}

export async function jsonDelete(jar: CookieJar, path: string): Promise<JsonResult> {
  const res = await doFetch(jar, path, { method: 'DELETE' });
  const text = await res.text();
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: text };
  }
}

export async function login(jar: CookieJar, email: string, password: string): Promise<void> {
  jar.clear();
  const csrfRes = await doFetch(jar, '/api/auth/csrf');
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const body = new URLSearchParams({
    email,
    password,
    csrfToken: csrf.csrfToken,
    callbackUrl: '/',
    redirect: 'false',
    json: 'true',
  });
  await doFetch(jar, '/api/auth/callback/credentials?json=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

// ─── Assertions ────────────────────────────────────────────────────────────
let stepCount = 0;
export const failures: string[] = [];

export function step(label: string): void {
  stepCount++;
  process.stdout.write(`\n[${String(stepCount).padStart(2, '0')}] ${label}\n`);
}
export function pass(msg: string): void {
  process.stdout.write(`     ✓ ${msg}\n`);
}
export function fail(msg: string): void {
  process.stdout.write(`     ✗ ${msg}\n`);
  failures.push(msg);
}
export function expect(cond: boolean, msg: string): void {
  if (cond) pass(msg);
  else fail(msg);
}

export function summarize(label: string): void {
  process.stdout.write(`\n${label} — ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length} failure${failures.length === 1 ? '' : 's'})`}\n`);
  for (const f of failures) process.stdout.write(`  • ${f}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

// ─── Test fixture users + session ────────────────────────────────────────
export interface FixtureUsers {
  pdEmail: string;
  facultyEmail: string;
  residentEmail: string;
  password: string;
}

export async function ensureUsers(prefix: string, password: string): Promise<FixtureUsers> {
  const hash = await bcrypt.hash(password, 12);
  const users = [
    { email: `${prefix}.pd@vaidix.local`, name: `${prefix} PD`, role: Role.PROGRAM_DIRECTOR },
    { email: `${prefix}.faculty@vaidix.local`, name: `${prefix} Faculty`, role: Role.FACULTY },
    { email: `${prefix}.resident@vaidix.local`, name: `${prefix} Resident`, role: Role.RESIDENT },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        status: UserStatus.ACTIVE,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
      },
      update: {
        status: UserStatus.ACTIVE,
        passwordHash: hash,
        role: u.role,
      },
    });
  }
  return {
    pdEmail: users[0].email,
    facultyEmail: users[1].email,
    residentEmail: users[2].email,
    password,
  };
}

export async function createApprovedSession(opts: {
  prefix: string;
  facultyEmail: string;
  pdEmail: string;
  title: string;
  durationMin?: number;
}): Promise<string> {
  const faculty = await db.user.findUnique({ where: { email: opts.facultyEmail }, select: { id: true } });
  const pd = await db.user.findUnique({ where: { email: opts.pdEmail }, select: { id: true } });
  if (!faculty || !pd) throw new Error('Test fixture users missing');
  const start = new Date(Date.now() - 5 * 60_000);
  const end = new Date(start.getTime() + (opts.durationMin ?? 60) * 60_000);
  const session = await db.teachingSession.create({
    data: {
      title: opts.title,
      sessionType: 'CASE_CONFERENCE',
      hostId: faculty.id,
      proposedBy: pd.id,
      approvedBy: pd.id,
      approvedAt: new Date(),
      approvalStatus: 'APPROVED',
      visibility: 'OPEN_TO_ALL',
      status: 'LIVE',
      scheduledStart: start,
      scheduledEnd: end,
      actualStart: start,
      maxParticipants: 50,
      recordingEnabled: true,
      consentRequired: false,
    },
    select: { id: true },
  });
  return session.id;
}

export async function cleanupTestSessions(prefix: string): Promise<void> {
  const sessions = await db.teachingSession.findMany({
    where: { title: { startsWith: prefix } },
    select: { id: true },
  });
  const ids = sessions.map((s) => s.id);
  if (ids.length === 0) return;
  // Cleanup cascades through dependent rows via FK ON DELETE CASCADE.
  await db.recording.deleteMany({ where: { sessionId: { in: ids } } });
  await db.teachingSession.deleteMany({ where: { id: { in: ids } } });
}
