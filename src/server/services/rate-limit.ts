// ════════════════════════════════════════════════════════════════════════════
// Rate Limiting — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Uses Redis for sliding-window rate limits.
// Buckets: login:<email>, forgot:<ip>, accept-invite:<ip>, api:<userId>.
//
// FAIL-OPEN: if Redis is unavailable, the limiter logs a warning and returns
// `allowed: true`. Justification: blocking every API request when the cache
// is down is a worse user experience than allowing a brief burst. Audit
// logs still capture activity. Stricter modes (fail-closed) can be added
// later behind a flag if a security team requires it.

import { redis } from '@/lib/redis';

export interface RateLimitConfig {
  bucket: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** True when Redis is unreachable and the limiter failed open. */
  degraded?: boolean;
}

const REDIS_OP_TIMEOUT_MS = 750;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('rate-limit redis timeout')), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const key = `rl:${config.bucket}`;
  try {
    const count = await withTimeout(redis.incr(key), REDIS_OP_TIMEOUT_MS);
    if (count === 1) {
      // expire is fire-and-forget — if it fails the next incr resets it
      withTimeout(redis.expire(key, config.windowSec), REDIS_OP_TIMEOUT_MS).catch(() => {});
    }
    const ttl = await withTimeout(redis.ttl(key), REDIS_OP_TIMEOUT_MS);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowSec * 1000));

    return {
      allowed: count <= config.limit,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    };
  } catch (err) {
    // Redis unreachable — fail open with a clear log line so SREs notice.
    console.warn(`[rate-limit] redis unavailable, failing open for bucket=${config.bucket}:`, (err as Error).message);
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSec * 1000),
      degraded: true,
    };
  }
}

export const LIMITS = {
  LOGIN: { limit: 5, windowSec: 15 * 60 },        // 5 attempts per 15 min per email
  FORGOT_PASSWORD: { limit: 3, windowSec: 60 * 60 }, // 3 per hour per IP
  ACCEPT_INVITE: { limit: 10, windowSec: 15 * 60 },  // 10 per 15 min per IP (prevent brute-force)
  INVITATION_CREATE: { limit: 30, windowSec: 60 * 60 }, // admin rate limit
  API_GENERAL: { limit: 300, windowSec: 60 },       // 5 rps sustained per user

  // W4-Sprint
  DOCUMENT_UPLOAD: { limit: 30, windowSec: 60 * 60 },     // 30 uploads / hour / faculty
  DOCUMENT_ANALYZE: { limit: 60, windowSec: 60 * 60 },    // analysis re-runs
  HOOK_CREATE: { limit: 60, windowSec: 60 * 60 },         // per-faculty
  HOOK_RESPOND: { limit: 200, windowSec: 60 * 60 },       // per-learner
  WHATSAPP_SEND: { limit: 100, windowSec: 60 * 60 },      // immediate sends
  WHATSAPP_SCHEDULE: { limit: 30, windowSec: 60 * 60 },   // batch scheduling calls
  COACH_ASK: { limit: 60, windowSec: 60 * 60 },           // 60 coach questions / hour / learner
  KIRKPATRICK_WRITE: { limit: 60, windowSec: 60 * 60 },
  ENGAGEMENT_SIGNAL_WRITE: { limit: 600, windowSec: 60 }, // 10 rps per user during live session
} as const;
