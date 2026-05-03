// ════════════════════════════════════════════════════════════════════════════
// Rate Limiting — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Uses Redis for sliding-window rate limits.
// Buckets: login:<email>, forgot:<ip>, accept-invite:<ip>, api:<userId>.
//
// Two failure modes (set per-bucket via LIMITS):
//   - 'open'   → if Redis is down, allow the request and flag `degraded: true`.
//                Best for high-volume, low-risk paths (engagement signals,
//                read APIs) where blocking everyone hurts the user more than
//                the abuse window does.
//   - 'closed' → if Redis is down, REFUSE the request (allowed: false).
//                Mandatory for credential and outbound-cost paths (login,
//                password reset, invitation send, WhatsApp, coach calls)
//                where unbounded retries are a security/cost incident.
//
// HARDENING-PLAN.md item #11.

import { redis } from '@/lib/redis';

export type RateLimitFailMode = 'open' | 'closed';

export interface RateLimitConfig {
  bucket: string;
  limit: number;
  windowSec: number;
  /** What happens if Redis is unreachable. Defaults to 'open' for back-compat. */
  failMode?: RateLimitFailMode;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** True when Redis was unreachable for this check. */
  degraded?: boolean;
  /** Why the request was denied while degraded — for the UI / logs. */
  reason?: 'limit' | 'redis_down_fail_closed';
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
  const failMode: RateLimitFailMode = config.failMode ?? 'open';
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
      reason: count <= config.limit ? undefined : 'limit',
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (failMode === 'closed') {
      // Sensitive bucket — refuse rather than allow unbounded retries.
      console.error(
        `[rate-limit] redis unavailable, FAIL-CLOSED for bucket=${config.bucket}: ${msg}`
      );
      return {
        allowed: false,
        remaining: 0,
        // Short retry window — operator should be reviving Redis quickly.
        resetAt: new Date(Date.now() + 5_000),
        degraded: true,
        reason: 'redis_down_fail_closed',
      };
    }
    // Redis unreachable — fail open with a clear log line so SREs notice.
    console.warn(
      `[rate-limit] redis unavailable, failing open for bucket=${config.bucket}: ${msg}`
    );
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSec * 1000),
      degraded: true,
    };
  }
}

// Sensitive buckets MUST set failMode: 'closed'. Anything that issues
// credentials, sends mail/SMS/WhatsApp, or calls a billable upstream goes here.
export const LIMITS = {
  // ─── Auth / identity (fail-closed: protects against credential attacks) ──
  LOGIN: { limit: 5, windowSec: 15 * 60, failMode: 'closed' as const },
  FORGOT_PASSWORD: { limit: 3, windowSec: 60 * 60, failMode: 'closed' as const },
  ACCEPT_INVITE: { limit: 10, windowSec: 15 * 60, failMode: 'closed' as const },
  INVITATION_CREATE: { limit: 30, windowSec: 60 * 60, failMode: 'closed' as const },

  // General API — fail-open (read-heavy, low-risk).
  API_GENERAL: { limit: 300, windowSec: 60, failMode: 'open' as const },

  // ─── W4-Sprint ───────────────────────────────────────────────────────────
  DOCUMENT_UPLOAD: { limit: 30, windowSec: 60 * 60, failMode: 'open' as const },
  DOCUMENT_ANALYZE: { limit: 60, windowSec: 60 * 60, failMode: 'closed' as const }, // billable upstream
  HOOK_CREATE: { limit: 60, windowSec: 60 * 60, failMode: 'open' as const },
  HOOK_RESPOND: { limit: 200, windowSec: 60 * 60, failMode: 'open' as const },
  WHATSAPP_SEND: { limit: 100, windowSec: 60 * 60, failMode: 'closed' as const }, // billable + abuse vector
  WHATSAPP_SCHEDULE: { limit: 30, windowSec: 60 * 60, failMode: 'closed' as const },
  COACH_ASK: { limit: 60, windowSec: 60 * 60, failMode: 'closed' as const }, // billable Gemini call
  KIRKPATRICK_WRITE: { limit: 60, windowSec: 60 * 60, failMode: 'open' as const },
  ENGAGEMENT_SIGNAL_WRITE: { limit: 600, windowSec: 60, failMode: 'open' as const },
} as const;
