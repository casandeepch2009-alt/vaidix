# LiveKit Agent — Contract for Vaidix Live Captions (Stream B9)

The Vaidix Next.js app does not run Python. The LiveKit Agent is a separate process — typically a Docker container co-located with the LiveKit server — that joins each room as an invisible participant, transcribes audio in real-time using Faster-Whisper / IndicConformer (the same models used by the post-session transcribe worker), and posts caption segments to the Vaidix internal ingest endpoint.

This document defines the wire contract. The Python implementation is out of scope for this repo; treat it as a separate deliverable assigned to the LiveKit Agents engineer.

## Overview

```
                ┌─────────────────────┐
                │ LiveKit Server      │
                │ (existing W2 setup) │
                └──────────┬──────────┘
                           │ subscribes to room audio
                           ▼
                ┌─────────────────────┐
                │ LiveKit Agent       │
                │ (Python, separate   │
                │  Docker container)  │
                │                     │
                │  Faster-Whisper     │
                │  + IndicConformer   │
                │  + pyannote (opt.)  │
                └──────────┬──────────┘
                           │ POST segments (HTTP, internal)
                           ▼
        ┌────────────────────────────────────────┐
        │ POST /api/classroom/sessions/[id]/     │
        │      live-captions/ingest              │
        │ (this Next.js app)                     │
        └──────────┬─────────────────────────────┘
                           │ Redis pub/sub
                           ▼
        ┌────────────────────────────────────────┐
        │ GET /api/classroom/sessions/[id]/      │
        │     live-captions   (SSE)              │
        │  consumed by LiveCaptionsOverlay       │
        └────────────────────────────────────────┘
```

## Authentication

All ingest requests must include a shared bearer secret:

```
Authorization: Bearer <LIVE_CAPTIONS_INGEST_SECRET>
```

Set on both the Next.js side (`.env.local` → `LIVE_CAPTIONS_INGEST_SECRET=...`) and the agent side (its own env var). Use a 32+ char hex secret — `openssl rand -hex 32`.

## Room → Session ID

LiveKit room names follow the convention `session-<sessionId>`. The agent extracts `sessionId` by stripping the `session-` prefix and uses it in the ingest URL path.

## Ingest endpoint

```
POST /api/classroom/sessions/<sessionId>/live-captions/ingest
Authorization: Bearer <secret>
Content-Type: application/json
```

Body:

```json
{
  "segments": [
    {
      "startMs": 12340,
      "endMs": 14580,
      "text": "tractional retinal detachment is more likely with",
      "lang": "en",
      "speaker": "SPEAKER_00",
      "partial": true
    },
    {
      "startMs": 14600,
      "endMs": 16720,
      "text": "tractional retinal detachment is more likely with active fibrovascular proliferation.",
      "lang": "en",
      "speaker": "SPEAKER_00",
      "partial": false
    }
  ]
}
```

Field semantics:

| Field | Type | Required | Notes |
|---|---|---|---|
| `startMs` | int ≥ 0 | yes | Milliseconds since the agent started (or session start, agent's choice — must be monotonic) |
| `endMs` | int ≥ 0 | yes | End of this segment's timing |
| `text` | string 1–5000 | yes | The transcribed text |
| `lang` | enum | yes | `en`, `hi`, `te`, `ta`, `kn`, `ml`, `mr`, `bn`, `ur` |
| `speaker` | string ≤ 60 | no | Diarization label like `SPEAKER_00` |
| `partial` | bool | no | `true` for streaming partials (replaced by next emission); `false`/missing for finalized segments |

The endpoint validates with Zod, accepts up to 50 segments per request (batch them if needed for chatty agents), and returns:

```json
{ "ok": true, "data": { "published": 2 } }
```

## Cadence + behavior

- **Partial cadence:** every 250–500 ms during active speech. Each partial replaces the previous on-screen partial in the client overlay.
- **Final cadence:** when Whisper signals a stable boundary (typically 1–3 seconds after the speaker pauses). Finals append; the client keeps the most recent 2 lines.
- **Backpressure:** if a POST takes >2 s, drop the in-flight partial and try again on the next stable boundary. Don't block transcription on HTTP.
- **Reconnect:** if the ingest endpoint returns 5xx or times out, retry with exponential backoff (1s, 2s, 5s, 10s, 30s) and continue transcribing in memory. The agent must never crash on transient HTTP failures.

## Provider fallback

The agent should respect the same `TRANSCRIPTION_PROVIDER` env-var convention as the post-session worker:

- `self_hosted`: Faster-Whisper + IndicConformer (production target)
- `sarvam`: Sarvam Saaras streaming API (testing only — same prod env-gate enforcement applies)

Production env-gate (Next.js side, in `src/lib/env.ts`) refuses to boot with `SARVAM_API_KEY` set + `NODE_ENV=production`. The agent must mirror this discipline on its side.

## Client side — for reference

The client component is `src/components/engagement/live-captions-overlay.tsx`. It opens an `EventSource` against the SSE endpoint, listens for `caption` events, and renders partial + last 2 finals as a captioned overlay over the video. Toggleable on/off; preference persists in `localStorage`.

## Testing the contract without the agent

`scripts/e2e-w4-stream-b.ts` exercises the ingest path directly with curl-style requests to verify SSE delivery. To smoke-test by hand:

```bash
# Subscribe (in one terminal)
curl -N \
  -H "Cookie: <your auth cookie>" \
  http://localhost:3000/api/classroom/sessions/<sessionId>/live-captions

# Publish (in another terminal)
curl -X POST \
  -H "Authorization: Bearer $LIVE_CAPTIONS_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"segments":[{"startMs":0,"endMs":1500,"text":"hello world","lang":"en"}]}' \
  http://localhost:3000/api/classroom/sessions/<sessionId>/live-captions/ingest
```

The subscriber should receive a `caption` SSE event within ~50 ms of publish.

## Out of scope for this contract

- Real-time noise suppression (agent's responsibility if needed)
- Speaker name resolution against participant identities (agent receives LiveKit identity strings and may map them; client just shows whatever the agent sends)
- Multilingual code-switching detection (the agent decides when to flip `lang`)
- Caption persistence — these are transient overlays. The post-session transcribe worker writes the durable `Transcript` rows, separately.
