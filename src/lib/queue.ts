// ════════════════════════════════════════════════════════════════════════════
// BullMQ Queues + Worker Factory
// ════════════════════════════════════════════════════════════════════════════
// Queues handle async work: recording pipeline, transcription, email sends,
// Deck Forge jobs, expunge cascades, safety escalation notifications.

import { Queue, Worker, QueueEvents, type Processor } from 'bullmq';
import { makeRedisConnection } from './redis';

export const QUEUES = {
  RECORDING: 'recording-pipeline',
  TRANSCRIBE: 'transcription',
  AI_PROCESS: 'ai-processing',
  DECK_FORGE: 'deck-forge',
  EMAIL: 'email',
  EXPUNGE: 'expunge',
  RAG_INDEX: 'rag-index',
  SAFETY: 'safety-escalation',
  WEBHOOK: 'webhook-delivery',
  REMINDER: 'session-reminder',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

const queueCache = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queueCache.get(name);
  if (existing) return existing;
  const queue = new Queue(name, {
    connection: makeRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  queueCache.set(name, queue);
  return queue;
}

export function createWorker<T = unknown, R = unknown>(
  name: QueueName,
  processor: Processor<T, R>,
  opts: { concurrency?: number } = {}
): Worker<T, R> {
  return new Worker<T, R>(name, processor, {
    connection: makeRedisConnection(),
    concurrency: opts.concurrency ?? 1,
  });
}

export function getQueueEvents(name: QueueName): QueueEvents {
  return new QueueEvents(name, { connection: makeRedisConnection() });
}
