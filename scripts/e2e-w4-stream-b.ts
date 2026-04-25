// ════════════════════════════════════════════════════════════════════════════
// W4 Stream B e2e — Live captions ingest + SSE
// ════════════════════════════════════════════════════════════════════════════
// Run: npm run e2e:w4:b
// Exercises:
//   1. Ingest endpoint requires bearer secret (401 without)
//   2. Ingest with valid secret publishes to Redis pub/sub
//   3. SSE consumer (authenticated) receives 'caption' events

import { ensureUsers, createApprovedSession, cleanupTestSessions, login, CookieJar, doFetch, step, expect, summarize, BASE } from './e2e-w4-helpers';

const PREFIX = 'e2e.w4b';
const PASSWORD = 'E2eTest@2026!';
const SECRET = process.env.LIVE_CAPTIONS_INGEST_SECRET ?? '';

async function run() {
  if (!SECRET) {
    console.warn('[e2e-w4-b] LIVE_CAPTIONS_INGEST_SECRET not set — skipping (set it to run B9 e2e).');
    process.exit(0);
  }

  const users = await ensureUsers(PREFIX, PASSWORD);
  await cleanupTestSessions('w4b:');
  const sessionId = await createApprovedSession({
    prefix: PREFIX,
    facultyEmail: users.facultyEmail,
    pdEmail: users.pdEmail,
    title: 'w4b: Stream B captions test',
  });

  // ─── Test 1: ingest unauthorized ──────────────────────────────────────
  step('Ingest without bearer returns 401');
  const noAuth = await fetch(
    `${BASE}/api/classroom/sessions/${sessionId}/live-captions/ingest`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments: [{ startMs: 0, endMs: 1000, text: 'hi', lang: 'en' }] }),
    }
  );
  expect(noAuth.status === 401, `unauth status=${noAuth.status}`);

  // ─── Test 2: SSE subscribe + ingest publishes ────────────────────────
  const residentJar = new CookieJar();
  await login(residentJar, users.residentEmail, PASSWORD);

  step('Open SSE subscriber as resident');
  const ac = new AbortController();
  const sseRes = await doFetch(residentJar, `/api/classroom/sessions/${sessionId}/live-captions`, {
    signal: ac.signal,
  });
  expect(sseRes.ok && sseRes.headers.get('content-type')?.includes('text/event-stream') === true, 'SSE response is event-stream');

  // Read stream in background, collecting first caption event.
  const reader = sseRes.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let captionPayload: { text: string } | null = null;
  const captionPromise = (async () => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const ev of events) {
        if (ev.includes('event: caption')) {
          const dataLine = ev.split('\n').find((l) => l.startsWith('data: '));
          if (dataLine) {
            captionPayload = JSON.parse(dataLine.slice(6));
            return;
          }
        }
      }
    }
  })();

  // Brief wait so SSE handler has subscribed before we publish.
  await new Promise((r) => setTimeout(r, 500));

  step('Ingest with valid bearer publishes a caption');
  const ingestRes = await fetch(
    `${BASE}/api/classroom/sessions/${sessionId}/live-captions/ingest`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        segments: [{ startMs: 0, endMs: 1500, text: 'hello captions', lang: 'en' }],
      }),
    }
  );
  expect(ingestRes.status === 200, `ingest status=${ingestRes.status}`);

  step('SSE subscriber receives caption event within 5s');
  await captionPromise;
  ac.abort();
  const received = captionPayload as { text: string } | null;
  expect(received !== null, 'caption event received');
  expect(received?.text === 'hello captions', `payload.text=${received?.text}`);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  await cleanupTestSessions('w4b:');
  summarize('Stream B e2e');
}

run().catch((err) => {
  console.error('e2e-w4-stream-b failed:', err);
  process.exit(1);
});
