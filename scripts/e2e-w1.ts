// ════════════════════════════════════════════════════════════════════════════
// Vaidix W1 End-to-End Test
// ════════════════════════════════════════════════════════════════════════════
// Exercises the full authentication + invitation flow against a running dev
// server at http://localhost:3000 and asserts DB state via Prisma.
//
// Run:  npm run e2e:w1  (starts dev server must already be running)

import { PrismaClient, InvitationStatus, UserStatus } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();

const ADMIN_EMAIL = 'sandeep@vaidix.local';
const ADMIN_PASSWORD = 'Vaidix@2026!';
const TEST_INVITEE_EMAIL = 'e2e.invitee@vaidix.local';
const TEST_INVITEE_NAME = 'E2E Test Invitee';
const INVITEE_PASSWORD = 'E2eTest@2026!';
const NEW_INVITEE_PASSWORD = 'Changed@2026!';

// ─── Minimal cookie jar ─────────────────────────────────────────────────────
class CookieJar {
  private cookies = new Map<string, string>();
  update(setCookieHeader: string | string[] | null) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split(',').filter((s) => s.includes('='));
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
  const res = await fetch(BASE + path, {
    ...init,
    headers,
    redirect: 'manual',
  });
  const setCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookie && setCookie.length) jar.update(setCookie);
  else jar.update(res.headers.get('set-cookie'));
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonResult = { status: number; json: any };

async function jsonPost(jar: CookieJar, path: string, body: unknown): Promise<JsonResult> {
  const res = await doFetch(jar, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

// ─── NextAuth login helper ──────────────────────────────────────────────────
async function nextAuthLogin(jar: CookieJar, email: string, password: string): Promise<boolean> {
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

  // After successful credentials callback, NextAuth sets session cookies.
  // Verify by fetching /api/auth/session.
  const sessionRes = await doFetch(jar, '/api/auth/session');
  const session = (await sessionRes.json()) as { user?: { id?: string } };
  return !!session?.user?.id;
}

// ─── Assertion helpers ──────────────────────────────────────────────────────
let PASSED = 0;
let FAILED = 0;
const FAILURES: string[] = [];

function assert(condition: unknown, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    PASSED++;
  } else {
    console.log(`  ❌ ${label}${detail ? '  →  ' + detail : ''}`);
    FAILED++;
    FAILURES.push(label + (detail ? ': ' + detail : ''));
  }
}

// ─── Cleanup previous run ───────────────────────────────────────────────────
async function cleanup() {
  // Clear rate-limit keys so serial test runs don't collide
  const { redis } = await import('../src/lib/redis');
  const rlKeys = await redis.keys('rl:*');
  if (rlKeys.length > 0) await redis.del(...rlKeys);

  await db.auditEvent.deleteMany({ where: { entityType: 'invitation', entityId: { contains: '' } } }).catch(() => {});
  await db.invitation.deleteMany({ where: { email: TEST_INVITEE_EMAIL } });
  const testUser = await db.user.findUnique({ where: { email: TEST_INVITEE_EMAIL } });
  if (testUser) {
    await db.userModulePermission.deleteMany({ where: { userId: testUser.id } });
    await db.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
    await db.userProfile.deleteMany({ where: { userId: testUser.id } });
    await db.userPreferences.deleteMany({ where: { userId: testUser.id } });
    await db.userStats.deleteMany({ where: { userId: testUser.id } });
    await db.user.delete({ where: { id: testUser.id } });
  }
}

// ─── Main test run ──────────────────────────────────────────────────────────
async function main() {
  console.log('🧪 Vaidix W1 — End-to-End Test\n');
  console.log(`   Base URL:  ${BASE}`);
  console.log(`   Admin:     ${ADMIN_EMAIL}`);
  console.log(`   Invitee:   ${TEST_INVITEE_EMAIL}\n`);

  await cleanup();

  const adminJar = new CookieJar();
  const inviteeJar = new CookieJar();
  let invitationId = '';
  let invitationToken = '';

  // ───────────────────────────────────────────────────────────────
  console.log('📋 Step 1: Admin login');
  // ───────────────────────────────────────────────────────────────
  const ok = await nextAuthLogin(adminJar, ADMIN_EMAIL, ADMIN_PASSWORD);
  assert(ok, 'Admin can sign in with correct credentials');

  const session = await jsonGet(adminJar, '/api/auth/session');
  assert(session.json?.user?.email === ADMIN_EMAIL, 'Session returns correct email');
  assert(session.json?.user?.role === 'ADMIN', 'Session returns ADMIN role');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 2: Admin creates invitation');
  // ───────────────────────────────────────────────────────────────
  const createRes = await jsonPost(adminJar, '/api/invitations', {
    email: TEST_INVITEE_EMAIL,
    fullName: TEST_INVITEE_NAME,
    role: 'RESIDENT',
    subspecialty: 'Vitreoretinal Surgery',
    department: 'Vitreoretinal',
    yearOfResidency: 3,
    moduleOverrides: {
      granted: ['admin.audit-logs'], // grant extra module not in resident defaults
      revoked: ['simulators'],       // remove a default resident module
    },
    expiresInHours: 48,
  });
  assert(createRes.status === 201, `Invitation created (HTTP ${createRes.status})`, JSON.stringify(createRes.json).slice(0, 200));

  invitationId = createRes.json?.data?.invitation?.id ?? '';
  assert(invitationId.length > 0, 'Invitation ID returned');

  // Fetch token from DB (bypassing email delivery for test purposes)
  const invDb = await db.invitation.findUnique({ where: { id: invitationId } });
  invitationToken = invDb?.token ?? '';
  assert(!!invitationToken && invitationToken.length > 30, 'Invitation token minted in DB');
  assert(invDb?.status === InvitationStatus.PENDING, 'Invitation status = PENDING');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 3: Duplicate invitation rejected');
  // ───────────────────────────────────────────────────────────────
  const dupRes = await jsonPost(adminJar, '/api/invitations', {
    email: TEST_INVITEE_EMAIL,
    fullName: 'Different Name',
    role: 'RESIDENT',
    yearOfResidency: 2,
    moduleOverrides: { granted: [], revoked: [] },
    expiresInHours: 48,
  });
  assert(dupRes.status === 409, `Duplicate pending invite rejected (HTTP ${dupRes.status})`);

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 4: Public verify invitation token');
  // ───────────────────────────────────────────────────────────────
  const publicJar = new CookieJar();
  const verifyRes = await jsonGet(publicJar, `/api/invitations/verify/${invitationToken}`);
  assert(verifyRes.status === 200, `Verify returns 200 (HTTP ${verifyRes.status})`);
  assert(verifyRes.json?.data?.invitation?.email === TEST_INVITEE_EMAIL, 'Verify returns correct email');
  assert(verifyRes.json?.data?.invitation?.role === 'RESIDENT', 'Verify returns correct role');

  const badVerify = await jsonGet(publicJar, '/api/invitations/verify/nonexistent_token_1234567890abcdef');
  assert(badVerify.status === 404, `Invalid token → 404 (got ${badVerify.status})`);

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 5: Accept invitation');
  // ───────────────────────────────────────────────────────────────
  const acceptRes = await jsonPost(publicJar, `/api/invitations/accept/${invitationToken}`, {
    token: invitationToken,
    password: INVITEE_PASSWORD,
    confirmPassword: INVITEE_PASSWORD,
    acceptTerms: true,
  });
  assert(acceptRes.status === 201, `Accept returns 201 (HTTP ${acceptRes.status})`, JSON.stringify(acceptRes.json).slice(0, 200));

  const newUserFromApi = acceptRes.json?.data?.user;
  assert(newUserFromApi?.email === TEST_INVITEE_EMAIL, 'Accept response includes new user');
  assert(newUserFromApi?.role === 'RESIDENT', 'New user has RESIDENT role');

  // Verify user exists in DB with correct state
  const dbUser = await db.user.findUnique({
    where: { email: TEST_INVITEE_EMAIL },
    include: { profile: true, preferences: true, stats: true, modulePermissions: true },
  });
  assert(!!dbUser, 'User exists in DB');
  assert(dbUser?.status === UserStatus.ACTIVE, 'New user status = ACTIVE');
  assert(!!dbUser?.profile, 'User profile created');
  assert(dbUser?.profile?.subspecialty === 'Vitreoretinal Surgery', 'Profile subspecialty populated');
  assert(dbUser?.profile?.yearOfResidency === 3, 'Profile year populated');

  // Verify module permissions
  const grants = dbUser?.modulePermissions?.filter((p) => p.granted).map((p) => p.moduleKey) ?? [];
  const revokes = dbUser?.modulePermissions?.filter((p) => !p.granted).map((p) => p.moduleKey) ?? [];
  assert(grants.includes('admin.audit-logs'), 'Extra module granted (admin.audit-logs)');
  assert(revokes.includes('simulators'), 'Default module revoked (simulators)');

  // Invitation should now be ACCEPTED
  const invAfter = await db.invitation.findUnique({ where: { id: invitationId } });
  assert(invAfter?.status === InvitationStatus.ACCEPTED, 'Invitation status = ACCEPTED');
  assert(!!invAfter?.acceptedAt, 'Invitation acceptedAt timestamp set');
  assert(invAfter?.acceptedUserId === dbUser?.id, 'acceptedUserId points to new user');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 6: Cannot accept already-accepted invitation again');
  // ───────────────────────────────────────────────────────────────
  const reacceptRes = await jsonPost(publicJar, `/api/invitations/accept/${invitationToken}`, {
    token: invitationToken,
    password: INVITEE_PASSWORD,
    confirmPassword: INVITEE_PASSWORD,
    acceptTerms: true,
  });
  assert(reacceptRes.status === 410 || reacceptRes.status === 409, `Re-accept blocked (HTTP ${reacceptRes.status})`);

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 7: New user can login');
  // ───────────────────────────────────────────────────────────────
  const newLoginOk = await nextAuthLogin(inviteeJar, TEST_INVITEE_EMAIL, INVITEE_PASSWORD);
  assert(newLoginOk, 'Invited user logs in with chosen password');

  const inviteeSession = await jsonGet(inviteeJar, '/api/auth/session');
  assert(inviteeSession.json?.user?.role === 'RESIDENT', 'Logged-in user has RESIDENT role');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 8: Resident cannot access admin-only routes');
  // ───────────────────────────────────────────────────────────────
  const forbidden = await jsonGet(inviteeJar, '/api/invitations?limit=10');
  assert(forbidden.status === 403, `Resident blocked from /api/invitations GET (HTTP ${forbidden.status})`);

  const createAsResident = await jsonPost(inviteeJar, '/api/invitations', {
    email: 'someone.else@vaidix.local',
    fullName: 'Someone',
    role: 'RESIDENT',
    yearOfResidency: 1,
    moduleOverrides: { granted: [], revoked: [] },
    expiresInHours: 48,
  });
  assert(createAsResident.status === 403, `Resident blocked from POST /api/invitations (HTTP ${createAsResident.status})`);

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 9: Forgot password flow');
  // ───────────────────────────────────────────────────────────────
  const forgotJar = new CookieJar();
  const forgotRes = await jsonPost(forgotJar, '/api/auth/forgot-password', {
    email: TEST_INVITEE_EMAIL,
  });
  assert(forgotRes.status === 200, `Forgot password responds 200 (HTTP ${forgotRes.status})`);

  // Verify reset token in DB
  const resetToken = await db.passwordResetToken.findFirst({
    where: { userId: dbUser?.id, used: false },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!resetToken, 'Reset token created in DB');

  // Need the raw token — which is hashed in DB. We cannot recover it from DB alone.
  // For this test, we directly update the User to set a known password and
  // verify reset-password API separately.
  // Instead, exercise reset-password with a bogus token to confirm rejection.
  const badReset = await jsonPost(forgotJar, '/api/auth/reset-password', {
    token: 'badtoken0000000000000000000000000000000000000000000000000000',
    newPassword: NEW_INVITEE_PASSWORD,
    confirmPassword: NEW_INVITEE_PASSWORD,
  });
  assert(badReset.status === 400, `Invalid reset token rejected (HTTP ${badReset.status})`);

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 10: Forgot password with unknown email — constant response');
  // ───────────────────────────────────────────────────────────────
  // Clear rate-limit bucket for this IP (test helper; production never does this).
  const { redis } = await import('../src/lib/redis');
  const keys = await redis.keys('rl:forgot:*');
  if (keys.length > 0) await redis.del(...keys);

  const forgotKnown = await jsonPost(forgotJar, '/api/auth/forgot-password', {
    email: TEST_INVITEE_EMAIL,
  });
  const forgotUnknown = await jsonPost(forgotJar, '/api/auth/forgot-password', {
    email: 'ghost@nowhere.example',
  });
  assert(forgotUnknown.status === 200, `Unknown email still returns 200 (HTTP ${forgotUnknown.status})`);
  assert(
    forgotKnown.json?.data?.message === forgotUnknown.json?.data?.message,
    'Known and unknown emails get identical response (prevents enumeration)'
  );

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 11: Audit events recorded');
  // ───────────────────────────────────────────────────────────────
  const auditEvents = await db.auditEvent.findMany({
    where: {
      OR: [
        { entityType: 'invitation', entityId: invitationId },
        { actorId: dbUser?.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  const eventTypes = auditEvents.map((e) => e.eventType);
  assert(eventTypes.includes('invitation.created'), 'Audit: invitation.created logged');
  assert(eventTypes.includes('invitation.sent'), 'Audit: invitation.sent logged');
  assert(eventTypes.includes('invitation.accepted'), 'Audit: invitation.accepted logged');
  assert(eventTypes.includes('user.created'), 'Audit: user.created logged');
  assert(eventTypes.includes('auth.password_reset.requested'), 'Audit: password_reset.requested logged');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 12: Create another invitation, revoke it, accept fails');
  // ───────────────────────────────────────────────────────────────
  const SECOND_EMAIL = 'e2e.revoke@vaidix.local';
  await db.invitation.deleteMany({ where: { email: SECOND_EMAIL } });
  const createRes2 = await jsonPost(adminJar, '/api/invitations', {
    email: SECOND_EMAIL,
    fullName: 'Revoke Target',
    role: 'FACULTY',
    moduleOverrides: { granted: [], revoked: [] },
    expiresInHours: 48,
  });
  assert(createRes2.status === 201, 'Second invitation created');
  const id2 = createRes2.json?.data?.invitation?.id as string;
  const inv2 = await db.invitation.findUnique({ where: { id: id2 } });
  const token2 = inv2?.token ?? '';

  const revokeRes = await doFetch(adminJar, `/api/invitations/${id2}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'E2E test revoke' }),
  });
  assert(revokeRes.status === 200, `Revoke returns 200 (HTTP ${revokeRes.status})`);

  const invAfterRevoke = await db.invitation.findUnique({ where: { id: id2 } });
  assert(invAfterRevoke?.status === InvitationStatus.REVOKED, 'Invitation status = REVOKED');

  const acceptRevoked = await jsonPost(publicJar, `/api/invitations/accept/${token2}`, {
    token: token2,
    password: 'Password@2026!',
    confirmPassword: 'Password@2026!',
    acceptTerms: true,
  });
  assert(acceptRevoked.status === 410 || acceptRevoked.status === 404, `Revoked invitation accept blocked (HTTP ${acceptRevoked.status})`);

  // Cleanup second test
  await db.invitation.delete({ where: { id: id2 } }).catch(() => {});

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 13: Delete (hard) invitation');
  // ───────────────────────────────────────────────────────────────
  const DELETE_EMAIL = 'e2e.delete@vaidix.local';
  await db.invitation.deleteMany({ where: { email: DELETE_EMAIL } });
  const createRes3 = await jsonPost(adminJar, '/api/invitations', {
    email: DELETE_EMAIL,
    fullName: 'Delete Target',
    role: 'EXTERNAL_LEARNER',
    moduleOverrides: { granted: [], revoked: [] },
    expiresInHours: 48,
  });
  assert(createRes3.status === 201, 'Third invitation created');
  const id3 = createRes3.json?.data?.invitation?.id as string;

  const hardDel = await doFetch(adminJar, `/api/invitations/${id3}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, reason: 'E2E test hard delete' }),
  });
  assert(hardDel.status === 200, `Hard delete returns 200 (HTTP ${hardDel.status})`);

  const afterHard = await db.invitation.findUnique({ where: { id: id3 } });
  assert(!afterHard, 'Invitation row removed from DB');

  const hardDelAuditRow = await db.auditEvent.findFirst({
    where: { eventType: 'invitation.deleted', entityId: id3 },
  });
  assert(!!hardDelAuditRow, 'Audit: invitation.deleted recorded despite hard delete');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 14: List invitations (admin)');
  // ───────────────────────────────────────────────────────────────
  const listRes = await jsonGet(adminJar, '/api/invitations?limit=20');
  assert(listRes.status === 200, `List returns 200 (HTTP ${listRes.status})`);
  assert(Array.isArray(listRes.json?.data?.invitations), 'Invitations array returned');
  assert(typeof listRes.json?.data?.summary?.total === 'number', 'Summary counters returned');

  // ───────────────────────────────────────────────────────────────
  console.log('\n📋 Step 15: Modules registry endpoint');
  // ───────────────────────────────────────────────────────────────
  const modRes = await jsonGet(adminJar, '/api/modules');
  assert(modRes.status === 200, `/api/modules returns 200 (HTTP ${modRes.status})`);
  assert(Array.isArray(modRes.json?.data?.modules) && modRes.json.data.modules.length >= 30, 'Module registry returns ≥30 modules');

  // ───────────────────────────────────────────────────────────────
  // DONE
  // ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`  PASSED: ${PASSED}    FAILED: ${FAILED}`);
  console.log('═'.repeat(60));
  if (FAILED > 0) {
    console.log('\nFailures:');
    for (const f of FAILURES) console.log('  • ' + f);
  }

  await cleanup();
  await db.$disconnect();
  process.exit(FAILED === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\n💥 E2E crashed:', err);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
