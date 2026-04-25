// ════════════════════════════════════════════════════════════════════════════
// W4 Stream A e2e — Recording API + Reels + Promo
// ════════════════════════════════════════════════════════════════════════════
// Run: npm run e2e:w4:a  (dev server must be running at :3000)
// Exercises:
//   1. Recordings list permission (faculty/host vs outsider)
//   2. Reel creation (validation: length, range, role)
//   3. Promo asset generation (3 templates, document rows linked to session)

import { db, ensureUsers, createApprovedSession, cleanupTestSessions, login, jsonGet, jsonPost, CookieJar, step, expect, summarize, BASE } from './e2e-w4-helpers';
import { ClipKind, RecordingStatus } from '@prisma/client';

const PREFIX = 'e2e.w4a';
const PASSWORD = 'E2eTest@2026!';

async function run() {
  const users = await ensureUsers(PREFIX, PASSWORD);

  await cleanupTestSessions('w4a:');
  const sessionId = await createApprovedSession({
    prefix: PREFIX,
    facultyEmail: users.facultyEmail,
    pdEmail: users.pdEmail,
    title: 'w4a: Stream A test session',
  });

  // Seed a fake completed recording so listRecordings + reel creation can find it.
  const recording = await db.recording.create({
    data: {
      sessionId,
      status: RecordingStatus.READY,
      pipelineStage: RecordingStatus.READY,
      rawS3Key: `documents/raw/${users.facultyEmail}/fake-source.mp4`,
      hlsPath: `hls/${sessionId}/master.m3u8`,
      durationSec: 600, // 10 min
    },
    select: { id: true },
  });

  // ─── Health check: server reachable ────────────────────────────────────
  step('Server reachable');
  const health = await fetch(BASE + '/api/auth/csrf');
  expect(health.ok, `GET /api/auth/csrf returned ${health.status}`);

  // ─── Faculty path ─────────────────────────────────────────────────────
  const facultyJar = new CookieJar();
  await login(facultyJar, users.facultyEmail, PASSWORD);

  step('Faculty: list recordings for own session');
  const recList = await jsonGet(facultyJar, `/api/classroom/sessions/${sessionId}/recordings`);
  expect(recList.status === 200, `GET recordings status=${recList.status}`);
  expect(Array.isArray(recList.json?.data?.recordings), 'recordings array present');
  expect((recList.json?.data?.recordings ?? []).length === 1, 'one recording returned');

  step('Faculty: list transcripts (empty initially)');
  const transcripts = await jsonGet(facultyJar, `/api/classroom/sessions/${sessionId}/transcripts`);
  // 200 with empty tracks OR 404 if transcribe hasn't run — both acceptable for fixture
  expect([200, 404].includes(transcripts.status), `transcripts status ${transcripts.status} acceptable`);

  step('Faculty: reel creation rejects too-short range');
  const reelShort = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/reels`, {
    startSec: 10,
    endSec: 12,
  });
  expect(reelShort.status === 400, `short reel status=${reelShort.status}`);
  expect(reelShort.json?.error?.code === 'INVALID', 'rejected as INVALID');

  step('Faculty: reel creation rejects too-long range');
  const reelLong = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/reels`, {
    startSec: 0,
    endSec: 60,
  });
  expect(reelLong.status === 400, `long reel status=${reelLong.status}`);

  step('Faculty: reel creation rejects out-of-bounds endSec');
  const reelOob = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/reels`, {
    startSec: 0,
    endSec: 1500, // > duration 600
  });
  expect(reelOob.status === 400, `oob reel status=${reelOob.status}`);

  step('Faculty: reel creation succeeds with 25s window');
  const reelOk = await jsonPost(facultyJar, `/api/classroom/sessions/${sessionId}/reels`, {
    startSec: 60,
    endSec: 85,
    title: 'PDR teaching moment',
  });
  expect(reelOk.status === 201, `create reel status=${reelOk.status}`);
  const clipId = reelOk.json?.data?.clipId as string | undefined;
  expect(typeof clipId === 'string', 'clipId returned');

  step('Faculty: reel appears in list');
  const reelsList = await jsonGet(facultyJar, `/api/classroom/sessions/${sessionId}/reels`);
  expect(reelsList.status === 200, `list reels status=${reelsList.status}`);
  const reels = (reelsList.json?.data?.reels ?? []) as Array<{ id: string; status: string }>;
  expect(reels.some((r) => r.id === clipId), 'created reel listed');

  step('Verify Clip row created with kind=REEL');
  if (clipId) {
    const clip = await db.clip.findUnique({ where: { id: clipId }, select: { kind: true, startSec: true, endSec: true } });
    expect(clip?.kind === ClipKind.REEL, `Clip.kind=${clip?.kind}`);
    expect(clip?.startSec === 60 && clip?.endSec === 85, 'startSec/endSec match');
  }

  step('Faculty: promo generate creates 3 assets');
  const promoOut = await jsonPost(facultyJar, '/api/promo/generate', { sessionId });
  expect(promoOut.status === 201, `promo status=${promoOut.status}`);
  const docs = (promoOut.json?.data?.documents ?? []) as Array<{ template: string; documentId: string }>;
  expect(docs.length === 3, `3 promo docs returned (got ${docs.length})`);
  expect(docs.some((d) => d.template === 'flyer'), 'flyer present');
  expect(docs.some((d) => d.template === 'whatsapp_banner'), 'whatsapp_banner present');
  expect(docs.some((d) => d.template === 'instagram_card'), 'instagram_card present');

  step('Faculty: promo list returns same 3 with download URLs');
  const promoList = await jsonGet(facultyJar, `/api/promo/list?sessionId=${sessionId}`);
  expect(promoList.status === 200, `promo list status=${promoList.status}`);
  const assets = (promoList.json?.data?.assets ?? []) as Array<{ downloadUrl: string }>;
  expect(assets.length >= 3, '3+ assets returned');
  expect(assets.every((a) => typeof a.downloadUrl === 'string' && a.downloadUrl.length > 0), 'all have downloadUrl');

  // ─── Resident path ────────────────────────────────────────────────────
  const residentJar = new CookieJar();
  await login(residentJar, users.residentEmail, PASSWORD);

  step('Resident: cannot generate promo (faculty-only)');
  const residentPromo = await jsonPost(residentJar, '/api/promo/generate', { sessionId });
  expect(residentPromo.status === 403, `resident promo status=${residentPromo.status}`);

  step('Resident: cannot create reel (faculty-only)');
  const residentReel = await jsonPost(residentJar, `/api/classroom/sessions/${sessionId}/reels`, {
    startSec: 0,
    endSec: 20,
  });
  expect(residentReel.status === 403, `resident reel status=${residentReel.status}`);

  step('Resident: can list session recordings (OPEN_TO_ALL session)');
  const residentRecs = await jsonGet(residentJar, `/api/classroom/sessions/${sessionId}/recordings`);
  expect(residentRecs.status === 200, `resident list recordings status=${residentRecs.status}`);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  await db.clip.deleteMany({ where: { recordingId: recording.id } });
  await db.documentSessionLink.deleteMany({ where: { sessionId } });
  await db.document.deleteMany({ where: { sessionLinks: { some: { sessionId } } } });
  await cleanupTestSessions('w4a:');

  summarize('Stream A e2e');
}

run().catch((err) => {
  console.error('e2e-w4-stream-a failed:', err);
  process.exit(1);
});
