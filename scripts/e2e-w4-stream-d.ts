// ════════════════════════════════════════════════════════════════════════════
// W4 Stream D e2e — Engagement signals + Hooks + Leaderboard + Coach +
//                   Kirkpatrick + WhatsApp consent gating
// ════════════════════════════════════════════════════════════════════════════
// Run: npm run e2e:w4:d

import { db, ensureUsers, createApprovedSession, cleanupTestSessions, login, jsonGet, jsonPost, CookieJar, step, expect, summarize } from './e2e-w4-helpers';
import { ConsentType, KirkpatrickLevel, EngagementSignalKind } from '@prisma/client';

const PREFIX = 'e2e.w4d';
const PASSWORD = 'E2eTest@2026!';

async function run() {
  const users = await ensureUsers(PREFIX, PASSWORD);
  await cleanupTestSessions('w4d:');
  const sessionId = await createApprovedSession({
    prefix: PREFIX,
    facultyEmail: users.facultyEmail,
    pdEmail: users.pdEmail,
    title: 'w4d: Stream D engagement test',
  });

  // Mark resident as a session participant so leaderboard sees them
  const residentUser = await db.user.findUnique({ where: { email: users.residentEmail }, select: { id: true } });
  if (!residentUser) throw new Error('resident user missing');
  await db.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId, userId: residentUser.id } },
    create: { sessionId, userId: residentUser.id, role: 'PARTICIPANT', joinedAt: new Date() },
    update: { joinedAt: new Date(), leftAt: null },
  });

  const facultyJar = new CookieJar();
  await login(facultyJar, users.facultyEmail, PASSWORD);
  const residentJar = new CookieJar();
  await login(residentJar, users.residentEmail, PASSWORD);

  // ─── Hooks ────────────────────────────────────────────────────────────
  step('Faculty: create T/F hook');
  const createHookRes = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/hooks`, {
    kind: 'TRUE_FALSE',
    prompt: 'Anti-VEGF is safe in all PDR cases',
    correctOption: 'False',
  });
  expect(createHookRes.status === 201, `create hook status=${createHookRes.status}`);
  const hookId = createHookRes.json?.data?.hook?.id as string | undefined;
  expect(typeof hookId === 'string', 'hookId returned');

  step('Resident: cannot create hook (host-only)');
  const residentCreate = await jsonPost(residentJar, `/api/classroom/sessions/${sessionId}/hooks`, {
    kind: 'TRUE_FALSE',
    prompt: 'X',
  });
  expect(residentCreate.status === 403, `resident create status=${residentCreate.status}`);

  step('Faculty: fire the hook');
  const fireRes = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/hooks/${hookId}/fire`);
  expect(fireRes.status === 200, `fire status=${fireRes.status}`);

  step('Resident: respond to hook (correct = "False")');
  const respondRes = await jsonPost(
    residentJar,
    `/api/classroom/sessions/${sessionId}/hooks/${hookId}/respond`,
    { response: 'False', latencyMs: 1200 }
  );
  expect(respondRes.status === 200, `respond status=${respondRes.status}`);
  expect(respondRes.json?.data?.isCorrect === true, 'response marked correct');

  step('Verify HOOK_RESPONSE engagement signal recorded');
  const signal = await db.engagementSignal.findFirst({
    where: { sessionId, userId: residentUser.id, kind: EngagementSignalKind.HOOK_RESPONSE },
  });
  expect(!!signal, 'EngagementSignal row exists');

  // ─── Engagement signals POST + aggregate ─────────────────────────────
  step('Resident: post a CHAT_MESSAGE engagement signal');
  const sigRes = await jsonPost(
    residentJar,
    `/api/classroom/sessions/${sessionId}/engagement-signals`,
    { kind: 'CHAT_MESSAGE' }
  );
  expect(sigRes.status === 200, `signal status=${sigRes.status}`);

  step('Resident: cannot read aggregates (host-only)');
  const aggResident = await jsonGet(residentJar, `/api/classroom/sessions/${sessionId}/engagement-signals`);
  expect(aggResident.status === 403, `resident aggregate status=${aggResident.status}`);

  step('Faculty (host): can read aggregates');
  const aggFaculty = await jsonGet(facultyJar, `/api/classroom/sessions/${sessionId}/engagement-signals`);
  expect(aggFaculty.status === 200, `faculty aggregate status=${aggFaculty.status}`);
  expect(typeof aggFaculty.json?.data?.engagementScore === 'number', 'engagementScore numeric');

  // ─── Leaderboard ─────────────────────────────────────────────────────
  step('Leaderboard returns resident with points');
  const lbRes = await jsonGet(residentJar, `/api/classroom/sessions/${sessionId}/leaderboard`);
  expect(lbRes.status === 200, `leaderboard status=${lbRes.status}`);
  const board = (lbRes.json?.data?.leaderboard ?? []) as Array<{ userId: string; points: number }>;
  expect(board.some((e) => e.userId === residentUser.id && e.points > 0), 'resident has points');

  step('Leaderboard anonymous mode hides resident name');
  const lbAnon = await jsonGet(residentJar, `/api/classroom/sessions/${sessionId}/leaderboard?anonymous=true`);
  expect(lbAnon.status === 200, `anon status=${lbAnon.status}`);
  const anonRows = (lbAnon.json?.data?.leaderboard ?? []) as Array<{ name: string | null }>;
  expect(anonRows.every((r) => !r.name || r.name.startsWith('Resident #')), 'resident names anonymized');

  // ─── Coach ────────────────────────────────────────────────────────────
  step('Resident: coach replies with answer + quiz + case');
  const coachRes = await jsonPost(residentJar, `/api/learners/${residentUser.id}/coach`, {
    question: 'Explain DR briefly',
  });
  expect(coachRes.status === 200, `coach status=${coachRes.status}`);
  const reply = coachRes.json?.data?.reply;
  expect(typeof reply?.answer === 'string', 'answer present');
  expect(typeof reply?.followUpQuiz === 'string', 'quiz present');
  expect(typeof reply?.caseExample === 'string', 'case present');

  step('Resident: cannot coach another user');
  const otherCoach = await jsonPost(residentJar, `/api/learners/${(await db.user.findUnique({ where: { email: users.facultyEmail }, select: { id: true } }))!.id}/coach`, {
    question: 'X',
  });
  expect(otherCoach.status === 403, `cross-coach status=${otherCoach.status}`);

  // ─── Kirkpatrick ──────────────────────────────────────────────────────
  step('Resident: submit L1 reaction survey for self');
  const l1Res = await jsonPost(residentJar, `/api/learners/${residentUser.id}/kirkpatrick`, {
    level: KirkpatrickLevel.L1_REACTION,
    sessionId,
    score: 85,
    surveyData: { engagement: 5, clarity: 4 },
  });
  expect(l1Res.status === 201, `L1 status=${l1Res.status}`);

  step('Resident: cannot submit L2 (faculty-only)');
  const l2Res = await jsonPost(residentJar, `/api/learners/${residentUser.id}/kirkpatrick`, {
    level: KirkpatrickLevel.L2_LEARNING,
    score: 70,
  });
  expect(l2Res.status === 403, `L2 status=${l2Res.status}`);

  step('Faculty: submit L2 for resident');
  const l2Fac = await jsonPost(facultyJar, `/api/learners/${residentUser.id}/kirkpatrick`, {
    level: KirkpatrickLevel.L2_LEARNING,
    sessionId,
    score: 78,
  });
  expect(l2Fac.status === 201, `L2 faculty status=${l2Fac.status}`);

  step('Resident: GET kirkpatrick rollup includes L1 + L2');
  const rollup = await jsonGet(residentJar, `/api/learners/${residentUser.id}/kirkpatrick`);
  expect(rollup.status === 200, `rollup status=${rollup.status}`);
  const summary = (rollup.json?.data?.summary ?? []) as Array<{ level: string; latestScore: number | null }>;
  expect(summary.find((s) => s.level === 'L1_REACTION')?.latestScore === 85, 'L1=85');
  expect(summary.find((s) => s.level === 'L2_LEARNING')?.latestScore === 78, 'L2=78');

  // ─── WhatsApp consent gating ─────────────────────────────────────────
  step('Faculty: send WA pearl with no consent → blocked');
  // Need a pearl
  const pearl = await db.pearl.upsert({
    where: { id: 'e2e-w4d-pearl' },
    create: {
      id: 'e2e-w4d-pearl',
      title: 'PDR test pearl',
      body: 'Anti-VEGF caution in tractional cases.',
      sourceType: 'manual',
    },
    update: {},
  });
  const sendNoConsent = await jsonPost(facultyJar, '/api/notifications/whatsapp/send', {
    userId: residentUser.id,
    pearlId: pearl.id,
  });
  expect(sendNoConsent.status === 200, `send status=${sendNoConsent.status}`);
  expect(sendNoConsent.json?.data?.delivered === false, 'delivered=false (no consent)');
  expect(sendNoConsent.json?.data?.reason === 'NO_CONSENT', 'reason=NO_CONSENT');

  step('Grant WhatsApp consent for resident');
  await db.consentRecord.create({
    data: {
      userId: residentUser.id,
      consentType: ConsentType.WHATSAPP_NOTIFICATIONS,
      granted: true,
      version: 'v1',
      grantedAt: new Date(),
    },
  });

  step('Faculty: send WA pearl with consent → delivered (dry-run in dev)');
  const sendWith = await jsonPost(facultyJar, '/api/notifications/whatsapp/send', {
    userId: residentUser.id,
    pearlId: pearl.id,
  });
  expect(sendWith.status === 200, `send status=${sendWith.status}`);
  expect(sendWith.json?.data?.delivered === true, 'delivered=true');

  step('Faculty: schedule pearl spaced delivery (24h/72h/7d)');
  const scheduleRes = await jsonPost(facultyJar, '/api/notifications/whatsapp/schedule-pearls', {
    userIds: [residentUser.id],
    pearlIds: [pearl.id],
  });
  expect(scheduleRes.status === 200, `schedule status=${scheduleRes.status}`);
  expect(scheduleRes.json?.data?.scheduledCount === 3, '3 jobs scheduled');

  // ─── Journal prompted ────────────────────────────────────────────────
  step('Resident: GET prompted reflection prompt');
  const prompt = await jsonGet(residentJar, '/api/journal/prompted');
  expect(prompt.status === 200, `prompt status=${prompt.status}`);
  expect(typeof prompt.json?.data?.prompt?.text === 'string', 'prompt.text present');

  step('Resident: POST a prompted journal entry');
  const journalRes = await jsonPost(residentJar, '/api/journal/prompted', {
    promptType: 'WHAT_LEARNED',
    body: 'Learned about anti-VEGF risk in tractional PDR.',
  });
  expect(journalRes.status === 201, `journal status=${journalRes.status}`);
  const entryId = journalRes.json?.data?.entry?.id as string | undefined;
  expect(typeof entryId === 'string', 'entryId returned');
  if (entryId) {
    const entry = await db.journalEntry.findUnique({ where: { id: entryId } });
    expect(entry?.prompted === true, 'prompted=true');
    expect(entry?.promptType === 'WHAT_LEARNED', 'promptType set');
  }

  // ─── Bloom's progression ─────────────────────────────────────────────
  step('Resident: GET blooms-progression returns 6 buckets');
  const blooms = await jsonGet(residentJar, `/api/learners/${residentUser.id}/blooms-progression`);
  expect(blooms.status === 200, `blooms status=${blooms.status}`);
  const buckets = (blooms.json?.data?.buckets ?? []) as Array<{ level: number }>;
  expect(buckets.length === 6, `6 buckets (got ${buckets.length})`);

  // ─── Cleanup ─────────────────────────────────────────────────────────
  await db.journalEntry.deleteMany({ where: { userId: residentUser.id, promptType: { not: null } } });
  await db.kirkpatrickEvaluation.deleteMany({ where: { userId: residentUser.id } });
  await db.engagementSignal.deleteMany({ where: { sessionId } });
  await db.liveHookResponse.deleteMany({ where: { hookId } });
  await db.liveHook.deleteMany({ where: { sessionId } });
  await db.consentRecord.deleteMany({
    where: { userId: residentUser.id, consentType: ConsentType.WHATSAPP_NOTIFICATIONS },
  });
  await db.notification.deleteMany({ where: { userId: residentUser.id, kind: 'pearl.spaced' } });
  await db.pearl.deleteMany({ where: { id: 'e2e-w4d-pearl' } });
  await cleanupTestSessions('w4d:');

  summarize('Stream D e2e');
}

run().catch((err) => {
  console.error('e2e-w4-stream-d failed:', err);
  process.exit(1);
});
