// ════════════════════════════════════════════════════════════════════════════
// Smoke Test — verifies all external services respond
// ════════════════════════════════════════════════════════════════════════════
// Run: npx tsx src/lib/smoke-test.ts
// Exits 0 on full pass, 1 on any failure.

import { db } from './db';
import { redis } from './redis';
import { ensureBucket, BUCKET, presignUpload } from './storage';
import { listRooms } from './livekit';
import { verifyTransport } from './email';

type Result = { name: string; ok: boolean; detail: string };

async function runAll(): Promise<Result[]> {
  const results: Result[] = [];

  // ─── 1. PostgreSQL ─────────────────────────────────────────────────────
  try {
    const userCount = await db.user.count();
    results.push({ name: 'PostgreSQL', ok: true, detail: `${userCount} users in DB` });
  } catch (err) {
    results.push({ name: 'PostgreSQL', ok: false, detail: (err as Error).message });
  }

  // ─── 2. Redis ──────────────────────────────────────────────────────────
  try {
    const pong = await redis.ping();
    results.push({ name: 'Redis', ok: pong === 'PONG', detail: `PING → ${pong}` });
  } catch (err) {
    results.push({ name: 'Redis', ok: false, detail: (err as Error).message });
  }

  // ─── 3. MinIO / S3 ─────────────────────────────────────────────────────
  try {
    await ensureBucket();
    await presignUpload('smoketest/hello.txt', 'text/plain', 60);
    results.push({ name: 'MinIO / S3', ok: true, detail: `bucket "${BUCKET}" ready, presign OK` });
  } catch (err) {
    results.push({ name: 'MinIO / S3', ok: false, detail: (err as Error).message });
  }

  // ─── 4. LiveKit ────────────────────────────────────────────────────────
  try {
    const rooms = await listRooms();
    results.push({ name: 'LiveKit', ok: true, detail: `${rooms.length} active rooms` });
  } catch (err) {
    results.push({ name: 'LiveKit', ok: false, detail: (err as Error).message });
  }

  // ─── 5. Email SMTP ─────────────────────────────────────────────────────
  try {
    const ok = await verifyTransport();
    results.push({ name: 'Email SMTP', ok, detail: ok ? 'transport verified' : 'verify returned false' });
  } catch (err) {
    results.push({ name: 'Email SMTP', ok: false, detail: (err as Error).message });
  }

  return results;
}

async function main() {
  console.log('🔍 Vaidix Smoke Test\n');
  const results = await runAll();

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(14)} ${r.detail}`);
  }

  const allOk = results.every((r) => r.ok);
  console.log(allOk ? '\n🎉 All services responding.' : '\n⚠️  Some services failed — fix before moving to W1.');

  await redis.quit();
  await db.$disconnect();
  process.exit(allOk ? 0 : 1);
}

main();
