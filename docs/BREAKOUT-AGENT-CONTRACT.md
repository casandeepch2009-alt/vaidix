# LiveKit Agent — Contract for Vaidix Breakout Co-Facilitator (W5 #6)

The Vaidix Next.js app does not run Python. The Breakout Co-Facilitator Agent is a separate process — typically a Docker container co-located with the LiveKit server — that joins each active Breakout child room as an invisible participant. It listens to participant audio, summarizes the discussion, prompts silent participants, asks probing questions, and detects unanswered questions. Each intervention is posted to the Vaidix internal ingest endpoint as a `BreakoutAgentLog` row.

This document defines the wire contract. The Python implementation is out of scope for this repo; treat it as a separate deliverable assigned to the LiveKit Agents engineer (the same engineer who owns `LIVEKIT-AGENT-CONTRACT.md`'s Live Captions agent).

> **W5 deliverable scope:** schema (`Breakout`, `BreakoutParticipant`, `BreakoutAgentLog`) + ingest endpoint + read API. The Python sidecar and the SSE consumer for live in-breakout intervention prompts are deferred. The post-session `agent-log` viewer in the UI reads via the standard authenticated GET endpoint.

## Overview

```
                ┌─────────────────────┐
                │ LiveKit Server      │
                │ (existing W2 setup) │
                └──────────┬──────────┘
                           │ subscribes to room audio for each
                           │ session-<sessionId>-bk-<breakoutId>
                           ▼
                ┌─────────────────────┐
                │ Breakout Agent      │
                │ (Python, separate   │
                │  Docker container)  │
                │                     │
                │  Faster-Whisper     │
                │  + LLM (Vaidix Core │
                │    or fallback)     │
                │  + silence detector │
                └──────────┬──────────┘
                           │ POST log entries (HTTP, internal)
                           ▼
        ┌────────────────────────────────────────┐
        │ POST /api/classroom/sessions/[id]/     │
        │      breakouts/[breakoutId]/           │
        │      agent-log/ingest                  │
        │ (this Next.js app)                     │
        └──────────┬─────────────────────────────┘
                           │ persists to BreakoutAgentLog
                           ▼
        ┌────────────────────────────────────────┐
        │ GET /api/classroom/sessions/[id]/      │
        │     breakouts/[breakoutId]/agent-log   │
        │  consumed by post-session viewer       │
        └────────────────────────────────────────┘
```

## Authentication

All ingest requests must include a shared bearer secret:

```
Authorization: Bearer <BREAKOUT_AGENT_INGEST_SECRET>
```

Set on both the Next.js side (`.env.local` → `BREAKOUT_AGENT_INGEST_SECRET=...`) and the agent side (its own env var). Use a 32+ char hex secret — `openssl rand -hex 32`.

The route does a constant-time-ish length+xor compare. Mismatched secrets return `401 UNAUTHORIZED` with no detail.

## Discovery

The agent learns about active breakouts by polling LiveKit room metadata or via a webhook. The room-name format is deterministic:

```
session-<sessionId>-bk-<breakoutId>
```

When LiveKit fires `room_started` for a name matching that pattern, the agent should join the room and begin listening. When LiveKit fires `room_finished`, the agent disconnects (the Vaidix backend has already marked the breakout as `ENDED` and stamped `endedAt`).

The agent **must not** join rooms whose breakout is in status `ENDED` — the Vaidix `ingestAgentLog` service rejects those with HTTP 409.

## Endpoint

`POST /api/classroom/sessions/{sessionId}/breakouts/{breakoutId}/agent-log/ingest`

### Request

```http
POST /api/classroom/sessions/abc123/breakouts/bk_xyz/agent-log/ingest HTTP/1.1
Authorization: Bearer <BREAKOUT_AGENT_INGEST_SECRET>
Content-Type: application/json

{
  "kind": "PROBE_QUESTION",
  "content": "Has anyone considered the differential of tractional retinal detachment here?",
  "metadata": {
    "triggerReason": "silence_detected",
    "silenceDurationSec": 47,
    "lastSpeakerUserId": "u_91823"
  }
}
```

### `kind` values (from `BreakoutAgentLogKind` enum)

| Kind | Meaning |
|---|---|
| `SUMMARY` | Periodic rolling summary of the discussion (e.g. every 3 min). |
| `PROBE_QUESTION` | Agent asked a probing question to deepen reasoning. |
| `SILENCE_NUDGE` | Agent prompted a silent participant by name. |
| `UNANSWERED_QUESTION` | A learner asked something nobody answered for >N sec. |
| `INTERVENTION` | Catch-all for direct facilitation moves. |

### `content`

Plain-text English (post-translation if the agent translated the discussion). Keep ≤ 4000 characters. Longer text should be summarized client-side before posting.

### `metadata` (optional)

Free-form JSON. Suggested keys:

| Key | Purpose |
|---|---|
| `triggerReason` | Why the agent fired this log (silence, question detected, etc.) |
| `silenceDurationSec` | For SILENCE_NUDGE |
| `lastSpeakerUserId` | LiveKit identity of the last speaker |
| `referencedConcepts` | Array of clinical concepts the agent recognized |
| `confidence` | 0.0–1.0 — agent's confidence in its summary/intervention |

### Response

| Status | Body | Meaning |
|---|---|---|
| `201` | `{ "ok": true, "data": { "id": "..." } }` | Log persisted |
| `401` | `{ "ok": false, "error": { "code": "UNAUTHORIZED" } }` | Bearer mismatch |
| `404` | `{ "ok": false, "error": { "code": "NOT_FOUND" } }` | Breakout id not found |
| `409` | `{ "ok": false, "error": { "code": "BREAKOUT_ENDED" } }` | Breakout is `ENDED`; stop posting |
| `422` | `{ "ok": false, "error": { "code": "VALIDATION_ERROR", "details": {...} } }` | Schema fail |

## Reading the log

Authenticated Vaidix users can fetch the log for a breakout:

```http
GET /api/classroom/sessions/{sessionId}/breakouts/{breakoutId}/agent-log
Cookie: next-auth.session-token=...
```

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "bal_...",
        "kind": "SUMMARY",
        "content": "Group discussed PDR management...",
        "metadata": { "confidence": 0.84 },
        "createdAt": "2026-04-25T10:42:11.000Z"
      }
    ]
  }
}
```

The post-session UI uses this for the "Discussion summary" tab on a finished breakout. Live in-breakout intervention prompts (a participant-facing Coach Panel that surfaces SILENCE_NUDGE / PROBE_QUESTION in real time) is **deferred** — it requires SSE infrastructure that is W5 Phase 2 / W11 work.

## Operational notes

- **No PHI redaction at this layer.** The agent must apply PHI redaction (same library used by Stream B's transcribe-worker) before posting. The Vaidix backend trusts this layer.
- **Rate limiting.** Reasonable upper bound: 1 ingest call per agent every 10 seconds per breakout. Bursts of summary + probe within 1s are fine — no hard throttle, but log spam should be suppressed at the agent.
- **Idempotency.** Not required. Each call creates a new row. If the agent retries a failed POST, expect duplicates — that's acceptable for log data.
- **Retention.** Logs are retained with the parent `Breakout`, which cascades from `TeachingSession`. Standard DPDPA expunge applies.

## Privacy & ethics

1. The agent listens to **breakout audio only**. It never joins the parent session room.
2. Participants are notified via a banner on `breakout-room-view.tsx` that an AI co-facilitator is in the room.
3. Posted logs are visible to faculty/PD/admin and to the breakout's own participants (post-session). The host can purge logs via standard recording expunge.
4. Privacy review for facial-emotion analytics (Feeddback #7) does **not** gate this contract — text-based intervention is judged lower-risk than camera analytics. Document the distinction if pushback comes from the LVPEI ethics committee.
