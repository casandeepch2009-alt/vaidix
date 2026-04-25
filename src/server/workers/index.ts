// ════════════════════════════════════════════════════════════════════════════
// Worker entrypoint — run separately from Next.js
// ════════════════════════════════════════════════════════════════════════════
// Usage: npm run workers
// Each worker owns a BullMQ queue. Adding a new worker: import + register here.

import { startReminderWorker } from './reminder-worker';
import { startTranscodeWorker } from './transcode-worker';
import { startTranscribeWorker } from './transcribe-worker';
import { startWhatsappWorker } from './whatsapp-worker';
import { startReelRenderWorker } from './reel-render-worker';

const workers = [
  startReminderWorker(),
  startTranscodeWorker(),
  startTranscribeWorker(),
  startWhatsappWorker(),
  startReelRenderWorker(),
];

console.log(`[workers] started ${workers.length} worker(s):`, workers.map((w) => w.name));

async function shutdown(signal: string) {
  console.log(`[workers] ${signal} received, closing ${workers.length} worker(s)...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
