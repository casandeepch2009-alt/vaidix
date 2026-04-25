// ════════════════════════════════════════════════════════════════════════════
// W4 Stream C e2e — Documents + Classify + Approve + Tag + Analyze
// ════════════════════════════════════════════════════════════════════════════
// Run: npm run e2e:w4:c

import { db, ensureUsers, createApprovedSession, cleanupTestSessions, login, jsonGet, jsonPost, jsonDelete, CookieJar, step, expect, summarize, BASE } from './e2e-w4-helpers';
import { DocumentRoute } from '@prisma/client';

const PREFIX = 'e2e.w4c';
const PASSWORD = 'E2eTest@2026!';

async function run() {
  const users = await ensureUsers(PREFIX, PASSWORD);
  await cleanupTestSessions('w4c:');
  const sessionId = await createApprovedSession({
    prefix: PREFIX,
    facultyEmail: users.facultyEmail,
    pdEmail: users.pdEmail,
    title: 'w4c: Stream C docs test',
  });

  step('Server reachable');
  const health = await fetch(BASE + '/api/auth/csrf');
  expect(health.ok, `csrf endpoint ok (status ${health.status})`);

  const facultyJar = new CookieJar();
  await login(facultyJar, users.facultyEmail, PASSWORD);

  // ─── Faculty creates a draft document ────────────────────────────────
  step('Faculty: create document draft (PPT) returns presigned upload URL');
  const draftRes = await jsonPost(facultyJar, '/api/documents', {
    title: 'PDR Management Algorithm',
    description: 'Anti-VEGF decision framework',
    filename: 'pdr.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    sizeBytes: 1_500_000,
  });
  expect(draftRes.status === 201, `draft status=${draftRes.status}`);
  const documentId = draftRes.json?.data?.document?.id as string | undefined;
  const presignedUrl = draftRes.json?.data?.presignedUploadUrl as string | undefined;
  expect(typeof documentId === 'string', 'documentId returned');
  expect(typeof presignedUrl === 'string' && presignedUrl.startsWith('http'), 'presignedUploadUrl returned');

  // ─── Resident cannot upload (faculty-only) ───────────────────────────
  const residentJar = new CookieJar();
  await login(residentJar, users.residentEmail, PASSWORD);

  step('Resident: cannot create document draft (faculty-only)');
  const residentDraft = await jsonPost(residentJar, '/api/documents', {
    title: 'X',
    filename: 'x.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  expect(residentDraft.status === 403, `resident upload status=${residentDraft.status}`);

  // ─── Faculty: classify ───────────────────────────────────────────────
  step('Faculty: classify the document');
  const classifyRes = await jsonPost(facultyJar, `/api/documents/${documentId}/classify`);
  expect(classifyRes.status === 200, `classify status=${classifyRes.status}`);
  const suggestedRoute = classifyRes.json?.data?.classification?.suggestedRoute;
  expect(suggestedRoute === DocumentRoute.DECK_FORGE, `suggested=${suggestedRoute} (expected DECK_FORGE for PPT)`);

  // ─── Faculty: approve override route ─────────────────────────────────
  step('Faculty: approve route=REFERENCE');
  const approveRes = await jsonPost(facultyJar, `/api/documents/${documentId}/approve`, {
    route: DocumentRoute.REFERENCE,
  });
  expect(approveRes.status === 200, `approve status=${approveRes.status}`);
  const finalRoute = (await db.document.findUnique({ where: { id: documentId }, select: { route: true } }))?.route;
  expect(finalRoute === DocumentRoute.REFERENCE, `DB route=${finalRoute}`);

  // ─── Faculty: tag to session ─────────────────────────────────────────
  step('Faculty: tag document to session');
  const tagRes = await jsonPost(facultyJar, `/api/documents/${documentId}/tag-session`, { sessionId });
  expect(tagRes.status === 200, `tag status=${tagRes.status}`);
  const link = await db.documentSessionLink.findFirst({ where: { documentId, sessionId } });
  expect(!!link, 'DocumentSessionLink row created');

  // ─── Faculty: analyze ────────────────────────────────────────────────
  step('Faculty: analyze document (heuristic OR Gemini)');
  const analyzeRes = await jsonPost(facultyJar, `/api/documents/${documentId}/analyze`);
  expect(analyzeRes.status === 200, `analyze status=${analyzeRes.status}`);
  const analysis = analyzeRes.json?.data?.analysis;
  expect(typeof analysis?.readabilityScore === 'number', 'readabilityScore numeric');
  expect(typeof analysis?.slideDensityScore === 'number', 'slideDensityScore numeric');
  expect(['heuristic', 'gemini'].includes(analysis?.source), `source=${analysis?.source}`);

  // ─── Faculty: list documents shows the new doc ───────────────────────
  step('Faculty: list documents includes the new draft');
  const listRes = await jsonGet(facultyJar, '/api/documents');
  expect(listRes.status === 200, `list status=${listRes.status}`);
  const docs = (listRes.json?.data?.documents ?? []) as Array<{ id: string }>;
  expect(docs.some((d) => d.id === documentId), 'document listed');

  // ─── Faculty: get detail with downloadUrl ────────────────────────────
  step('Faculty: get detail returns signed download URL');
  const detailRes = await jsonGet(facultyJar, `/api/documents/${documentId}`);
  expect(detailRes.status === 200, `detail status=${detailRes.status}`);
  expect(typeof detailRes.json?.data?.document?.downloadUrl === 'string', 'downloadUrl present');

  // ─── Faculty: delete (soft) ──────────────────────────────────────────
  step('Faculty: delete document (soft)');
  const delRes = await jsonDelete(facultyJar, `/api/documents/${documentId}`);
  expect(delRes.status === 200, `delete status=${delRes.status}`);
  const deleted = await db.document.findUnique({ where: { id: documentId }, select: { deletedAt: true } });
  expect(deleted?.deletedAt != null, 'deletedAt set');

  // ─── Cleanup ─────────────────────────────────────────────────────────
  if (documentId) {
    await db.documentSessionLink.deleteMany({ where: { documentId } });
    await db.deckForgeJob.deleteMany({ where: { documentId } });
    await db.document.delete({ where: { id: documentId } }).catch(() => {});
  }
  await cleanupTestSessions('w4c:');

  summarize('Stream C e2e');
}

run().catch((err) => {
  console.error('e2e-w4-stream-c failed:', err);
  process.exit(1);
});
