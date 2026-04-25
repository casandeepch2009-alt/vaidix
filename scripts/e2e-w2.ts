// ════════════════════════════════════════════════════════════════════════════
// Vaidix W2 End-to-End Test — Live Video + Admission Flow
// ════════════════════════════════════════════════════════════════════════════
// Exercises the W2 API surface end-to-end:
//   1. PD creates approved session (INVITE_ONLY) — via Prisma direct setup
//   2. Invited resident's /token → JOINED
//   3. Outsider's /token → 403 (no access)
//   4. Host generates share link
//   5. Outsider's /token?t=<share> → WAITING
//   6. Host admits outsider → admission ADMITTED + SessionInvite created
//   7. Outsider retries /token → JOINED
//   8. Resident posts chat → persisted; GET /chat returns it
//   9. Host mutes resident → mute API returns OK (LiveKit call may error
//      without live room, we test the auth path only)
//  10. Host ends session → status=ENDED, actualEnd set
//
// Run: npm run e2e:w2  (dev server must be running at :3000)

import { PrismaClient, Role, UserStatus, SessionApprovalStatus, SessionStatus, SessionVisibility, SessionType, AdmissionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();

const PD_EMAIL = 'e2e.w2.pd@vaidix.local';
const FACULTY_EMAIL = 'e2e.w2.faculty@vaidix.local';
const RESIDENT_EMAIL = 'e2e.w2.resident@vaidix.local';
const OUTSIDER_EMAIL = 'e2e.w2.outsider@vaidix.local';
const PASSWORD = 'E2eTest@2026!';

// ─── Cookie jar + HTTP helpers (borrowed from e2e-w1) ──────────────────────
class CookieJar {
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

async function doFetch(jar: CookieJar, path: string, init: RequestInit = {}): Promise<Response> {
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
type JsonResult = { status: number; json: any };

async function jsonPost(jar: CookieJar, path: string, body?: unknown): Promise<JsonResult> {
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
async function jsonGet(jar: CookieJar, path: string): Promise<JsonResult> {
  const res = await doFetch(jar, path);
  const text = await res.text();
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: text };
  }
}

async function login(jar: CookieJar, email: string, password: string): Promise<void> {
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
const failures: string[] = [];

function step(label: string) {
  stepCount++;
  process.stdout.write(`\n[${String(stepCount).padStart(2, '0')}] ${label}\n`);
}
function pass(msg: string) {
  process.stdout.write(`     \u2713 ${msg}\n`);
}
function fail(msg: string) {
  process.stdout.write(`     \u2717 ${msg}\n`);
  failures.push(msg);
}
function expect(cond: boolean, msg: string) {
  cond ? pass(msg) : fail(msg);
}

// ─── Setup: create test users + session directly via Prisma ────────────────
async function setupUsers() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const users = [
    { email: PD_EMAIL, name: 'W2 PD', role: Role.PROGRAM_DIRECTOR },
    { email: FACULTY_EMAIL, name: 'W2 Faculty', role: Role.FACULTY },
    { email: RESIDENT_EMAIL, name: 'W2 Resident', role: Role.RESIDENT },
    { email: OUTSIDER_EMAIL, name: 'W2 Outsider', role: Role.RESIDENT },
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
}

async function cleanup(sessionId?: string) {
  try {
    if (sessionId) {
      await db.sessionAdmission.deleteMany({ where: { sessionId } });
      await db.sessionInvite.deleteMany({ where: { sessionId } });
      await db.sessionChatMessage.deleteMany({ where: { sessionId } });
      await db.sessionParticipant.deleteMany({ where: { sessionId } });
      await db.sessionApprovalAudit.deleteMany({ where: { sessionId } });
      await db.teachingSession.deleteMany({ where: { id: sessionId } });
    }
    await db.user.deleteMany({
      where: { email: { in: [PD_EMAIL, FACULTY_EMAIL, RESIDENT_EMAIL, OUTSIDER_EMAIL] } },
    });
  } catch (e) {
    process.stdout.write(`  cleanup warning: ${(e as Error).message}\n`);
  }
}

// ─── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  process.stdout.write(`\nVaidix W2 E2E — base: ${BASE}\n`);
  process.stdout.write('─'.repeat(60) + '\n');

  let sessionId: string | undefined;
  try {
    step('Setup test users');
    await setupUsers();
    pass('Created PD, Faculty, Resident, Outsider');

    step('Create APPROVED INVITE_ONLY session (via Prisma)');
    const pd = await db.user.findUniqueOrThrow({ where: { email: PD_EMAIL } });
    const faculty = await db.user.findUniqueOrThrow({ where: { email: FACULTY_EMAIL } });
    const resident = await db.user.findUniqueOrThrow({ where: { email: RESIDENT_EMAIL } });
    const outsider = await db.user.findUniqueOrThrow({ where: { email: OUTSIDER_EMAIL } });

    const now = new Date();
    const s = await db.teachingSession.create({
      data: {
        title: 'E2E W2 Live Session',
        description: 'Automated test',
        sessionType: SessionType.LECTURE,
        hostId: faculty.id,
        proposedBy: pd.id,
        approvedBy: faculty.id,
        approvedAt: new Date(),
        approvalStatus: SessionApprovalStatus.APPROVED,
        visibility: SessionVisibility.INVITE_ONLY,
        scheduledStart: new Date(now.getTime() - 60_000),
        scheduledEnd: new Date(now.getTime() + 60 * 60_000),
        status: SessionStatus.SCHEDULED,
        invites: {
          create: [{ userId: resident.id, invitedBy: pd.id, status: 'ACCEPTED' }],
        },
      },
    });
    sessionId = s.id;
    pass(`Session ${s.id} created, Resident invited, Outsider NOT invited`);

    // ─── 03: Resident joins (invited → JOINED) ──────────────────────────────
    step("Resident's /token → JOINED");
    const residentJar = new CookieJar();
    await login(residentJar, RESIDENT_EMAIL, PASSWORD);
    const r1 = await jsonPost(residentJar, `/api/classroom/sessions/${sessionId}/token`);
    expect(r1.status === 200 && r1.json?.data?.state === 'JOINED', `state=${r1.json?.data?.state}`);
    expect(r1.json?.data?.role === 'PARTICIPANT', `role=${r1.json?.data?.role}`);
    expect(typeof r1.json?.data?.token === 'string' && r1.json.data.token.length > 20, 'token is a string');

    // ─── 04: Outsider with no share link → 403 ──────────────────────────────
    step("Outsider's /token (no share) → 403");
    const outsiderJar = new CookieJar();
    await login(outsiderJar, OUTSIDER_EMAIL, PASSWORD);
    const o1 = await jsonPost(outsiderJar, `/api/classroom/sessions/${sessionId}/token`);
    expect(o1.status === 403, `status=${o1.status}`);
    expect(o1.json?.error?.code === 'NO_ACCESS', `error.code=${o1.json?.error?.code}`);

    // ─── 05: Faculty creates share link ─────────────────────────────────────
    step('Faculty creates share link');
    const facultyJar = new CookieJar();
    await login(facultyJar, FACULTY_EMAIL, PASSWORD);
    const sl = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/share-link`, { ttlHours: 1 });
    expect(sl.status === 200, `status=${sl.status}`);
    const shareToken = sl.json?.data?.token as string | undefined;
    expect(typeof shareToken === 'string' && shareToken.length >= 16, 'token returned');

    // ─── 06: Outsider with share link → WAITING ─────────────────────────────
    step("Outsider's /token?t=<share> → WAITING");
    const o2 = await jsonPost(outsiderJar, `/api/classroom/sessions/${sessionId}/token?t=${shareToken}`);
    expect(o2.status === 200 && o2.json?.data?.state === 'WAITING', `state=${o2.json?.data?.state}`);
    const admissionId = o2.json?.data?.admissionId as string | undefined;
    expect(typeof admissionId === 'string', `admissionId=${admissionId}`);

    // ─── 07: Faculty sees pending in list ───────────────────────────────────
    step('Faculty GETs /admissions — sees outsider pending');
    const pending = await jsonGet(facultyJar, `/api/classroom/sessions/${sessionId}/admissions`);
    expect(pending.status === 200, `status=${pending.status}`);
    const pendingList = pending.json?.data?.pending as Array<{ id: string; userId: string }>;
    expect(
      Array.isArray(pendingList) && pendingList.some((p) => p.userId === outsider.id),
      `outsider present in pending (${pendingList?.length ?? 0} total)`
    );

    // ─── 08: Faculty admits outsider ────────────────────────────────────────
    step('Faculty admits outsider');
    const adm = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/admissions/${admissionId!}/admit`);
    expect(adm.status === 200, `status=${adm.status}`);

    const admissionRow = await db.sessionAdmission.findUnique({ where: { id: admissionId! } });
    expect(admissionRow?.status === AdmissionStatus.ADMITTED, `admission status=${admissionRow?.status}`);
    const invite = await db.sessionInvite.findUnique({
      where: { sessionId_userId: { sessionId, userId: outsider.id } },
    });
    expect(!!invite, 'SessionInvite row auto-created');

    // ─── 09: Outsider retries /token → JOINED ───────────────────────────────
    step("Outsider's /token (retry after admit) → JOINED");
    const o3 = await jsonPost(outsiderJar, `/api/classroom/sessions/${sessionId}/token`);
    expect(o3.json?.data?.state === 'JOINED', `state=${o3.json?.data?.state}`);

    // ─── 10: Resident posts chat; GET returns it ────────────────────────────
    step('Resident posts chat message');
    const msg = await jsonPost(residentJar, `/api/classroom/sessions/${sessionId}/chat`, { content: 'hello from e2e' });
    expect(msg.status === 201, `status=${msg.status}`);
    expect(msg.json?.data?.message?.content === 'hello from e2e', 'content roundtrip');

    const list = await jsonGet(residentJar, `/api/classroom/sessions/${sessionId}/chat?limit=50`);
    expect(
      Array.isArray(list.json?.data?.messages) &&
        list.json.data.messages.some((m: { content: string }) => m.content === 'hello from e2e'),
      'message appears in list'
    );

    // ─── 11: Faculty mutes resident (auth path only — LiveKit may error) ────
    step('Faculty mutes resident (auth path)');
    const muteRes = await jsonPost(
      facultyJar,
      `/api/classroom/sessions/${sessionId}/participants/${resident.id}/mute`,
      { muted: true }
    );
    // LiveKit returns 404 NOT_IN_ROOM since no actual WebRTC session. That's
    // fine — we only test that auth passed and the route reached LiveKit.
    expect(
      muteRes.status === 200 || muteRes.json?.error?.code === 'NOT_IN_ROOM',
      `reached LiveKit layer (status=${muteRes.status}, code=${muteRes.json?.error?.code ?? '-'})`
    );

    // ─── 12: Outsider can't mute (not host/co-host) ─────────────────────────
    step("Outsider can't mute (403)");
    const bad = await jsonPost(
      outsiderJar,
      `/api/classroom/sessions/${sessionId}/participants/${resident.id}/mute`,
      { muted: true }
    );
    expect(bad.status === 403, `status=${bad.status}`);

    // ─── 13: Faculty ends session ───────────────────────────────────────────
    step('Faculty ends session');
    const ended = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/end`);
    expect(ended.status === 200, `status=${ended.status}`);

    const finalSession = await db.teachingSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(finalSession.status === SessionStatus.ENDED, `status=${finalSession.status}`);
    expect(!!finalSession.actualEnd, `actualEnd set=${finalSession.actualEnd?.toISOString() ?? 'null'}`);

    // ─── 14: Resident can't end (not host) ──────────────────────────────────
    step("Resident can't end session (403)");
    const badEnd = await jsonPost(residentJar, `/api/classroom/sessions/${sessionId}/end`);
    expect(badEnd.status === 403 || badEnd.status === 404, `status=${badEnd.status}`);
  } finally {
    process.stdout.write('\n' + '─'.repeat(60) + '\n');
    process.stdout.write('Cleaning up…\n');
    await cleanup(sessionId);
    await db.$disconnect();
  }

  process.stdout.write('\n');
  if (failures.length === 0) {
    process.stdout.write(`\u2705 All ${stepCount} steps passed\n`);
    process.exit(0);
  } else {
    process.stdout.write(`\u274C ${failures.length} failure(s):\n`);
    for (const f of failures) process.stdout.write(`   - ${f}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
