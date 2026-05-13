// ════════════════════════════════════════════════════════════════════════════
// Deepgram — server helpers (Phase 1: live captions, English-only)
// ════════════════════════════════════════════════════════════════════════════
// We never expose `DEEPGRAM_API_KEY` to the browser. The host's browser
// requests a short-lived scoped access token from our server (see
// /api/classroom/sessions/[id]/captions/captions-token), then opens a
// WebSocket directly to Deepgram using that token in the `token` subprotocol.
// Tokens have a 30-second TTL — the browser refreshes if it ever needs to
// reconnect mid-session.
//
// Why scoped tokens over our-server-as-WebSocket-proxy:
//   * Next.js Route Handlers don't natively support long-lived WebSocket
//     proxying without a custom server, which we don't run.
//   * Deepgram's `/v1/auth/grant` is the documented browser pattern.
//   * Direct browser→Deepgram WS keeps round-trip latency ~250ms instead of
//     the ~700ms a relay through our server would add.

import { env } from '@/lib/env';

// User-safe message — every `err.message` here is treated as potentially
// client-visible. The vendor name + upstream response payload live on
// `.detail` for server logs only.
const CAPTIONS_UNAVAILABLE_USER_MESSAGE =
  'Captions are temporarily unavailable. Please try again in a moment.';

export class DeepgramUnavailableError extends Error {
  /** Rich upstream context — server logs only, never sent to clients. */
  public readonly detail: string;
  constructor(detail: string) {
    super(CAPTIONS_UNAVAILABLE_USER_MESSAGE);
    this.name = 'DeepgramUnavailableError';
    this.detail = detail;
  }
}

const DEEPGRAM_API = 'https://api.deepgram.com';
/// Deepgram's hard floor is 1 second; we want the shortest possible window so
/// a leaked token expires before it can be widely distributed. 30s is enough
/// for the browser to receive the token + open the WebSocket.
const TOKEN_TTL_SEC = 30;

export interface DeepgramAccessToken {
  accessToken: string;
  /** Seconds remaining until expiry, as Deepgram reported it. */
  expiresInSec: number;
}

/**
 * Mint a short-lived Deepgram access token for browser-side WebSocket auth.
 * The returned token grants only "live ASR" capability and expires in
 * ~30 seconds. Callers should treat any failure as fatal for captions on
 * this session — there's no fallback path in Phase 1.
 */
export async function mintDeepgramAccessToken(): Promise<DeepgramAccessToken> {
  if (!env.DEEPGRAM_API_KEY) {
    throw new DeepgramUnavailableError('DEEPGRAM_API_KEY is not set');
  }
  const res = await fetch(`${DEEPGRAM_API}/v1/auth/grant`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SEC }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new DeepgramUnavailableError(
      `Deepgram /v1/auth/grant ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new DeepgramUnavailableError('Deepgram /v1/auth/grant returned no access_token');
  }
  return {
    accessToken: data.access_token,
    expiresInSec: data.expires_in ?? TOKEN_TTL_SEC,
  };
}

/**
 * Recommended browser WebSocket URL for live captions. Returned as a plain
 * string so the client component can hand it to `new WebSocket(url, [...])`
 * without re-deriving query params on its own. Model + parameters reflect
 * the Phase-1 English-only scope; Phase 2 (Sarvam) builds a different URL.
 */
export function deepgramListenWsUrl(): string {
  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL, // default 'nova-3'
    language: 'en',
    smart_format: 'true',
    punctuate: 'true',
    interim_results: 'true',
    utterances: 'true',
    /// Send finalized utterances every ~1s of silence — keeps the persisted
    /// segments coarse-grained (one row per utterance, not per word).
    utterance_end_ms: '1000',
    /// Diarization is OFF in Phase 1: the host's mic is the only feed and
    /// speaker attribution comes from `localParticipant.identity`. Phase 2
    /// (room-mix audio) will enable diarize=true.
    diarize: 'false',
    encoding: 'opus',
    sample_rate: '48000',
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}
