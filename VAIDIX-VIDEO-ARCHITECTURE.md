# Vaidix Video — Architecture & Decision Record

| Field | Value |
|---|---|
| **Document status** | v2.0 — fully self-hosted architecture, Mux removed, 3-reviewer feedback incorporated |
| **Date** | 2026-04-12 |
| **Owner** | Humanoid Digital |
| **Client / Pilot site** | L V Prasad Eye Institute (LVPEI), Hyderabad |
| **Scope** | Live video conferencing, async video platform, AI-powered post-processing for medical education |
| **Hosting** | AWS or Google Cloud (owned account) — **no third-party SaaS for any data flow** |
| **Companion docs** | [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md), [Vaidix-LXS-CTO-Features-Brief.html](../Vaidix-LXS-CTO-Features-Brief.html), [Feeddback.md](../Feeddback.md) (external review) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Requirements — what the video platform must do](#2-requirements--what-the-video-platform-must-do)
3. [Architecture Overview — three-layer model](#3-architecture-overview--three-layer-model)
4. [Technology Decision — why LiveKit](#4-technology-decision--why-livekit)
5. [Async Video Layer — fully self-hosted pipeline](#5-async-video-layer--fully-self-hosted-pipeline)
6. [Transcription & Language Pipeline](#6-transcription--language-pipeline)
7. [AI Post-Processing — Pearl Extraction & Summaries](#7-ai-post-processing--pearl-extraction--summaries)
8. [Workflow Orchestration — recording lifecycle](#8-workflow-orchestration--recording-lifecycle)
9. [Timestamped Q&A, Engagement & Sharing](#9-timestamped-qa-engagement--sharing)
10. [Stack Diagram — the full picture](#10-stack-diagram--the-full-picture)
11. [Component-by-Component Specification](#11-component-by-component-specification)
12. [Integration with Existing Vaidix Codebase](#12-integration-with-existing-vaidix-codebase)
13. [Infrastructure & Cost Estimation](#13-infrastructure--cost-estimation)
14. [Deployment Strategy](#14-deployment-strategy)
15. [Faculty Controls & Moderation](#15-faculty-controls--moderation)
16. [Monitoring, SLOs & Reliability](#16-monitoring-slos--reliability)
17. [Security & Compliance](#17-security--compliance)
18. [Open Decisions Pending](#18-open-decisions-pending)
19. [External Review — accepted, rejected, deferred](#19-external-review--accepted-rejected-deferred)
20. [References](#20-references)
21. [Change Log](#21-change-log)

---

## 1. Executive Summary

Vaidix needs a **full educational video platform** — not just a video call button. The requirements span three distinct layers: live conferencing (real-time lectures, case discussions, mentoring), async video (recordings, clips, playback, Q&A), and AI post-processing (multi-language transcription, pearl extraction, automated summaries). No single product covers all three. Zoom covers ~30% of this scope.

**The hard constraint:** All infrastructure must be hosted on cloud accounts owned by LVPEI or Humanoid (AWS or Google Cloud). No data — video, audio, transcripts, or metadata — is sent to third-party SaaS services (no Mux, no Sarvam API, no Deepgram, no external transcription APIs). Everything runs within owned infrastructure.

The selected architecture is **LiveKit (live) + AWS/GCP media pipeline (async) + Vaidix SLM pipeline (AI)**, chosen because:

- **LiveKit** is open-source (Apache 2.0), self-hostable, has a first-class React SDK (`@livekit/components-react`) that drops into the existing Next.js app as composable components (not iframes), and costs $0 when self-hosted. It handles 1-on-1 mentoring and 450-person grand rounds on the same SFU architecture. For large lectures (>100 participants), LiveKit's HLS Egress streams via CloudFront/Cloud CDN, reducing client-side load.
- **The async video pipeline** is fully self-hosted: S3/GCS for storage, FFmpeg or AWS MediaConvert/GCP Transcoder API for HLS transcoding, CloudFront/Cloud CDN for delivery, and **Vidstack** (MIT, React-native) for playback. Clip generation uses FFmpeg. No third-party video SaaS.
- **The Vaidix SLM pipeline** (Faster-Whisper + AI4Bharat IndicConformer + Vaidix Core) — already designed in [VAIDIX-SLM-ARCHITECTURE.md §4.3 Layer 2c](VAIDIX-SLM-ARCHITECTURE.md) — handles multi-language transcription and pearl extraction. All models run on GPU instances within the owned cloud. No external transcription APIs.

**Operational scale:** 15 sessions/day, 50–450 participants per session, 1 hour average. All sessions recorded by default. ~15 hours of new video per day, ~450 hours/month.

---

## 2. Requirements — what the video platform must do

Derived from faculty workflow observations at LVPEI, the existing classroom UI shell at [src/app/(platform)/classroom/page.tsx](src/app/(platform)/classroom/page.tsx), and the session types already defined in [src/lib/types.ts](src/lib/types.ts) (`TeachingSession` interface, line 185).

### 2.1 Live conferencing (real-time)

| Requirement | Detail | Priority |
|---|---|---|
| **1-on-1 mentoring** | Faculty–resident private sessions (case discussion, DOPS assessment, feedback) | Must-have |
| **Group lectures** | Grand rounds, journal clubs — 50–450 participants, 1–3 presenters | Must-have |
| **Breakout rooms** | Random assignment, user-initiated choice. No recording of breakout rooms. Faculty reconvenes to main room. | Must-have |
| **Screen sharing** | Faculty shares slides, fundus images, OCT scans, slit-lamp photos during live sessions | Must-have |
| **Live chat** | Text chat alongside video — for questions, links, and real-time discussion | Must-have |
| **Hand raise / reactions** | Residents signal questions or agreement without unmuting | Must-have |
| **Recording** | All sessions recorded by default. Faculty can opt out per session. | Must-have |
| **Participant roles** | Faculty (host/presenter), resident (participant), observer (view-only) | Must-have |
| **Bandwidth adaptation** | Simulcast for WebRTC (small groups). HLS broadcast for large lectures (>100 participants). Graceful degradation on 4G. | Must-have |
| **Real-time English captions** | Live transcription overlay during sessions (lower quality, English-only). Full multi-language pipeline runs post-session. | Should-have |
| **Faculty controls** | Mute all, disable chat, stop recording mid-session, remove participant | Must-have |

### 2.2 Async video (post-session)

| Requirement | Detail | Priority |
|---|---|---|
| **Video playback** | Watch recorded lectures in-app with a modern player (Vidstack, MIT) | Must-have |
| **Clip generation** | Faculty or AI extracts 2–5 minute clips from a 60-minute lecture (key teaching moments). AI uses semantic boundary detection, not fixed time windows. | Must-have |
| **Multi-language transcription** | Full transcript in the language spoken + translation to English. Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Urdu, and code-switched mixtures. All self-hosted. | Must-have |
| **Subtitle/caption display** | Synced captions on the video player in the transcribed language + English translation | Must-have |
| **Timestamped Q&A** | Residents post questions at specific video timestamps; faculty and peers reply. V1: sidebar list with timestamp links. V2: timeline markers. | Must-have |
| **Likes / reactions** | Residents can like a lecture, a clip, or a Q&A answer. | Must-have |
| **Sharing** | Share a clip or full recording via a secure, time-limited, audited link | Must-have |
| **Chapter markers** | Auto-generated from transcript topic segmentation (Vaidix Core) or manually placed by faculty | Should-have |
| **Playback speed** | 0.5x to 2x playback speed control | Should-have |
| **Offline viewing** | Download encrypted lecture for offline watching (residents on train/flight) | Should-have (Phase 2) |
| **Search-to-scene** | Global search across all transcripts — takes the user to the exact second a keyword was spoken | Should-have |

### 2.3 AI post-processing

| Requirement | Detail | Priority |
|---|---|---|
| **Pearl extraction** | AI identifies and extracts clinical teaching pearls from the lecture transcript. Output matches the existing pearl schema in [src/mock-data/pearls.json](src/mock-data/pearls.json). | Must-have |
| **Session summary** | AI generates a structured summary. Replaces the placeholder `aiSummary` field in the classroom mock data. | Must-have |
| **Transcript cleanup** | Two-pass pipeline: raw noisy transcript → Vaidix Core distillation → clean clinical content. Already designed in [VAIDIX-SLM-ARCHITECTURE.md §5.3](VAIDIX-SLM-ARCHITECTURE.md). | Must-have |
| **Semantic clip suggestion** | AI identifies topic boundaries in the transcript and suggests clip start/end timestamps based on semantic shifts, not fixed windows. Faculty approves before clip generation. | Must-have |
| **Keyword/topic tagging** | Auto-tag each lecture by subspecialty, Bloom's level, and clinical topics for search and filtering | Should-have |

### 2.4 Non-functional requirements

| Requirement | Rationale |
|---|---|
| **All infrastructure on owned cloud** | AWS or GCP account owned by LVPEI/Humanoid. No third-party SaaS for any data flow. |
| **No external APIs for transcription** | All STT, translation, and AI processing runs on GPU instances within the owned cloud. |
| **All sessions recorded by default** | 15 sessions/day, 50–450 participants, 1 hour each. ~450 hours/month of new recordings. |
| **Mobile-first** | Residents watch recordings on phones between cases. Vidstack player is responsive and bandwidth-adaptive. |
| **Linear/Notion aesthetic** | Video UI must match the existing Vaidix design system — Tailwind + shadcn/ui + Framer Motion. |
| **React-native integration** | Composable React components (not iframes) that accept Tailwind classes and work with the existing shadcn theme. |
| **Apache 2.0 or MIT licensed** | For all self-hosted components. Clean for hospital procurement. |
| **Simulcast + HLS hybrid** | WebRTC simulcast for small groups (≤100). HLS broadcast for large lectures (>100). |
| **Max 450 concurrent participants** | Grand rounds at LVPEI rarely exceed 450. |

### 2.5 Operational volumes (confirmed)

| Metric | Value |
|---|---|
| Sessions per day | ~15 |
| Participants per session | 50–450 |
| Average session length | 1 hour |
| New video per day | ~15 hours |
| New video per month | ~450 hours |
| Storage per hour (HLS, multiple bitrates) | ~2–4 GB |
| Monthly storage growth | ~900 GB – 1.8 TB |
| Retention policy | TBD (see §18.1) |

---

## 3. Architecture Overview — three-layer model

The video platform is three independent layers with clean boundaries. All three run entirely within owned infrastructure (AWS/GCP).

```
┌───────────────────────────────────────────────────────────────┐
│                                                                 │
│   LAYER 1: LIVE LAYER (real-time)         ← LiveKit             │
│   WebRTC SFU (small groups) + HLS broadcast (large lectures)    │
│   Screen share, breakout rooms, live chat, real-time captions   │
│   React components via @livekit/components-react                │
│                                                                 │
├───────────────────────────────────────────────────────────────┤
│                         │ MP4 via Egress → S3/GCS               │
│                         ▼                                       │
│   LAYER 2: ASYNC LAYER (post-session)     ← Self-hosted         │
│   FFmpeg / MediaConvert / Transcoder API → HLS                  │
│   S3/GCS storage, CloudFront/Cloud CDN delivery                 │
│   Vidstack player (MIT, React-native) with captions + Q&A      │
│   Clip generation via FFmpeg                                    │
│                                                                 │
├───────────────────────────────────────────────────────────────┤
│                         │ Audio file from S3/GCS                │
│                         ▼                                       │
│   LAYER 3: AI LAYER (post-processing)     ← Vaidix SLM Pipeline │
│   Faster-Whisper + IndicConformer (self-hosted on GPU)          │
│   Vaidix Core pearl extraction + summary + clip suggestion      │
│   Already designed in VAIDIX-SLM-ARCHITECTURE.md §4.3 / §5.3   │
│                                                                 │
└───────────────────────────────────────────────────────────────┘
```

**Why three layers, not one product:**

| Concern | Why separation matters |
|---|---|
| **Independent scaling** | Live needs low-latency SFU (CPU-bound). Async needs CDN + storage (bandwidth-bound). AI needs GPU. Different instance types. |
| **Failure isolation** | If transcription fails, recordings are safe. If live has issues, async library is unaffected. |
| **Existing infrastructure reuse** | The AI layer already exists in the SLM architecture — zero new AI components to build. |

---

## 4. Technology Decision — why LiveKit

### 4.1 Candidates evaluated

| Platform | Open Source | Self-Host | React SDK | Breakout Rooms | Recording | License | Notes |
|---|---|---|---|---|---|---|---|
| **LiveKit** | Yes | Yes | `@livekit/components-react` (excellent, composable) | Via multi-room API | Egress service → MP4/WebM + HLS | Apache 2.0 | **Selected** |
| **Jitsi Meet** | Yes | Yes | `jitsi-meet-react-sdk` (iframe wrapper) | Built-in | Jibri (recording bot, heavy) | Apache 2.0 | Runner-up |
| **BigBlueButton** | Yes | Yes | None (iframe only) | Built-in (native) | Built-in (custom format, not MP4) | LGPL 3.0 | Education-native but monolithic |
| **OpenVidu** | Yes | Yes | `openvidu-react` | No native support | Built-in | Apache 2.0 | Simpler but fewer features |
| **Mediasoup** | Yes | Yes | Community wrappers only | No (raw SFU) | No (build your own) | ISC | Too low-level |
| **100ms** | No | No | Excellent | Built-in | Built-in | Proprietary | **Rejected — cloud-only, data leaves owned infra** |
| **Daily.co** | No | No | Good | Built-in | Built-in | Proprietary | Rejected — cloud-only |
| **Agora** | No | No | Yes | Via channel mgmt | Cloud recording | Proprietary | Rejected — cloud-only, Chinese-origin |

**All cloud-only platforms (100ms, Daily, Agora, Twilio, Whereby, Dyte) are rejected.** They require sending video/audio data to third-party servers, violating the core constraint that all data must stay within owned infrastructure.

### 4.2 Why LiveKit won

**Reason 1 — First-class, composable React SDK.**
`@livekit/components-react` provides pre-built `<LiveKitRoom>`, `<VideoConference>`, `<Chat>`, `<ScreenShareButton>`, `<ParticipantTile>` components that accept custom CSS classes. They drop into the existing Next.js app alongside shadcn/ui components and can be styled with Tailwind. Jitsi/BBB require an iframe — an iframe cannot be themed, cannot share state with Zustand, cannot participate in Framer Motion transitions.

**Reason 2 — Open source, Apache 2.0.**
Same license posture as the SLM stack ([VAIDIX-SLM-ARCHITECTURE.md §3.2](VAIDIX-SLM-ARCHITECTURE.md)). Clean for LVPEI procurement, self-hosting, white-labeling.

**Reason 3 — Self-hostable as a single Go binary + Redis.**
LiveKit server is a lightweight Go binary. Deployment: Docker Compose with two containers (livekit-server + redis). Runs on a 4-core, 8GB instance for 50–100 concurrent WebRTC participants.

**Reason 4 — Dual-mode: WebRTC + HLS broadcast.**
For small groups (≤100): full WebRTC SFU with simulcast — each participant sends one stream, the server forwards selectively. For large lectures (>100): LiveKit's **HLS Egress** streams a low-latency HLS feed via CloudFront/Cloud CDN. View-only participants consume HLS (no WebRTC connection, no SFU CPU load, handles 4G bandwidth fluctuations better, lower battery drain on mobile). Only presenters and active speakers use WebRTC.

**Reason 5 — Egress service for server-side recording.**
LiveKit Egress records sessions to S3/GCS as MP4/WebM. Supports composite recording (all participants in one file) or individual track recording (each participant separate — useful for downstream speaker diarization). The MP4 output feeds into the async pipeline.

**Reason 6 — Agents framework for real-time transcription.**
LiveKit's [Agents framework](https://docs.livekit.io/agents/) allows a server-side Python agent to join a room, process audio in real-time, and push results back. This enables **live English captions during sessions** (lower quality, near-real-time) while the full multi-language pipeline runs post-session. Future path: real-time compliance alerts if patient names are spoken.

**Reason 7 — Built-in TURN relay.**
LiveKit includes a built-in TURN server for participants behind strict firewalls (common in hospital networks). For production, deploy a dedicated `coturn` instance alongside LiveKit for better reliability under high load.

### 4.3 Why the alternatives were rejected

| Platform | Rejected because |
|---|---|
| **Jitsi Meet** | React integration is an iframe wrapper, not composable components. Cannot theme to match Vaidix design system. Recording via Jibri launches a headless Chrome per recording — resource-heavy. |
| **BigBlueButton** | Purpose-built for education (whiteboard, polls, breakout rooms) — strongest feature set. But: monolithic Java/Scala server requiring 8+ cores, 16GB RAM minimum. No React SDK — iframe only. Recording format is custom HTML5 playback, not MP4. LGPL is more restrictive than Apache 2.0. |
| **OpenVidu** | Decent React SDK but no native breakout rooms, smaller community than LiveKit, less active development. LiveKit is strictly better on every axis except initial simplicity. |
| **Mediasoup** | Raw SFU library — no signaling, no recording, no chat, no React components. Building on Mediasoup means building LiveKit from scratch. |
| **All cloud-only platforms** | 100ms, Daily, Agora, Dyte, Twilio, Whereby — all require sending data to third-party servers. Violates the owned-infrastructure constraint. |

### 4.4 Breakout room design (simplified)

Three reviewers flagged that LiveKit breakout rooms require custom orchestration. The user confirmed a simplified model:

| Attribute | Decision |
|---|---|
| **Assignment** | Random — system distributes participants into N groups. Users can also self-select a group. |
| **Recording** | No — breakout rooms are NOT recorded. Only the main room is recorded. |
| **Implementation** | Create N child rooms via LiveKit Server SDK, issue new tokens, move participants. On reconvene, move all participants back to the main room. |
| **Chat** | Each breakout room has its own chat. Chat history is preserved when participants return to the main room. |
| **Scope** | Phase 2 feature — not blocking V1 launch. V1 launches with main room only. |

This is explicitly labeled as custom orchestration, not a native LiveKit feature. The simplified model (random assignment, no recording) avoids the complexity traps flagged by reviewers.

### 4.5 HLS broadcast for large sessions

| Attribute | Detail |
|---|---|
| **Threshold** | Sessions with >100 registered participants automatically use HLS broadcast mode |
| **How it works** | LiveKit HLS Egress generates an HLS stream in real-time. The stream URL is served via CloudFront/Cloud CDN. View-only participants consume HLS (~10-15 second latency). Presenters and active speakers remain on WebRTC. |
| **Why** | 450 participants on WebRTC requires significant SFU CPU (multiple livekit-server nodes + Redis cluster). HLS offloads view-only participants to the CDN — cheaper, more reliable on 4G, lower battery drain on mobile. |
| **Interaction** | HLS viewers can still participate in text chat and Q&A. Hand-raise promotes a participant to WebRTC for speaking. |
| **Recording** | Same — LiveKit Egress records the composite session regardless of HLS vs WebRTC. |

---

## 5. Async Video Layer — fully self-hosted pipeline

### 5.1 Why not Mux

Mux was selected in v1.0 for its clip API, CDN, and React player. **Mux is removed in v2.0** because:

1. Mux is a US-based SaaS — video data leaves owned infrastructure.
2. LVPEI/Humanoid requires all data to stay within their own AWS/GCP account.
3. Even "educational" content may contain de-identified patient images or case details that fall under DPDPA.
4. Mux has no Indian data center — a dealbreaker for Indian hospital compliance.

### 5.2 Self-hosted async pipeline

The entire async video pipeline runs within owned AWS or GCP infrastructure:

```
LiveKit Egress → S3 / GCS (raw MP4)
                      │
                      ▼
              ┌──────────────────────────┐
              │ TRANSCODING              │
              │                          │
              │ AWS: MediaConvert        │
              │  or                      │
              │ GCP: Transcoder API      │
              │  or                      │
              │ Self-hosted: FFmpeg      │
              │                          │
              │ Output: HLS segments     │
              │ (multiple bitrates:      │
              │  1080p, 720p, 480p, 360p,│
              │  240p for mobile)        │
              └──────────────────────────┘
                      │
                      ▼
              S3 / GCS (HLS segments + manifest)
                      │
                      ▼
              CloudFront / Cloud CDN
                      │
                      ▼
              Vidstack player (React, in-app)
              + VTT captions from transcription pipeline
              + Q&A sidebar overlay
```

### 5.3 Transcoding options

| Option | Service | Cost | Effort | Best for |
|---|---|---|---|---|
| **AWS MediaConvert** | Managed, within AWS account | ~$0.024/min (on-demand) | Low — API call, job template | AWS hosting |
| **GCP Transcoder API** | Managed, within GCP account | ~$0.015/min (standard) | Low — API call, job template | GCP hosting |
| **FFmpeg (self-hosted)** | Runs on a dedicated instance | Instance cost only (~$50-100/mo for a 4-core) | Medium — build pipeline, manage queue | Maximum control, lowest cost at scale |

**Decision:** Use the cloud provider's managed transcoder (MediaConvert or Transcoder API) for V1. Both run entirely within the owned account — no data leaves. Migrate to self-hosted FFmpeg only if volume exceeds cost expectations.

**For 450 hours/month:**
- AWS MediaConvert: ~$648/mo (at $0.024/min × 27,000 min)
- GCP Transcoder API: ~$405/mo (at $0.015/min × 27,000 min)
- Self-hosted FFmpeg: ~$100-200/mo (dedicated instance) — but requires pipeline engineering

### 5.4 Clip generation

No Mux Clips API. Clips are generated via FFmpeg:

```bash
# Fast clip extraction (stream copy, no re-encoding, instant)
ffmpeg -i input.mp4 -ss 00:22:00 -to 00:26:00 -c copy clip.mp4

# Then transcode clip to HLS via MediaConvert/Transcoder API/FFmpeg
```

**Semantic clip boundaries** (from reviewer feedback): The AI pipeline identifies topic shifts in the transcript and suggests clip start/end timestamps based on semantic boundaries, not fixed ±2 minute windows. Faculty reviews and adjusts before generation.

### 5.5 Video player — Vidstack

| Attribute | Value |
|---|---|
| **Library** | [Vidstack](https://www.vidstack.io/) |
| **License** | MIT |
| **React support** | Native React components, TypeScript, composable |
| **HLS playback** | Built-in via hls.js |
| **Captions** | VTT/SRT support, multi-language toggle |
| **Chapters** | Chapter markers from transcript topic segmentation |
| **Playback speed** | 0.5x to 2x built-in |
| **Custom overlays** | Full support — used for Q&A sidebar interaction with `currentTime` |
| **Theming** | CSS custom properties + Tailwind compatible — matches Vaidix design system |
| **Keyboard shortcuts** | Built-in (space for play/pause, arrow keys for seek, etc.) |

### 5.6 Storage architecture

```
S3 / GCS bucket structure:

vaidix-video/
├── raw/                           # Raw MP4 from LiveKit Egress
│   └── {session-id}/
│       └── recording.mp4
├── hls/                           # Transcoded HLS segments
│   └── {session-id}/
│       ├── master.m3u8
│       ├── 1080p/
│       ├── 720p/
│       ├── 480p/
│       └── 360p/
├── clips/                         # Generated clips
│   └── {clip-id}/
│       ├── source.mp4
│       └── hls/
├── captions/                      # VTT caption files
│   └── {session-id}/
│       ├── original.vtt           # Original language
│       └── en.vtt                 # English translation
└── transcripts/                   # Full JSON transcripts
    └── {session-id}/
        └── transcript.json
```

### 5.7 CDN configuration

| Setting | Value |
|---|---|
| **AWS** | CloudFront distribution pointing to the `hls/` prefix in S3 |
| **GCP** | Cloud CDN with backend bucket pointing to `hls/` prefix in GCS |
| **Cache policy** | HLS segments: cache 1 year (immutable). Manifests: cache 10 seconds. |
| **Origin access** | Bucket is private. CDN uses signed URLs or Origin Access Identity/signed cookies. |
| **Geographic restriction** | None (residents may be posted across India or internationally) |

---

## 6. Transcription & Language Pipeline

### 6.1 Two providers, one cutover

Transcription has **two implementations behind one interface**, selected at runtime via `TRANSCRIPTION_PROVIDER` env var:

| Phase | Provider | When | Where it runs |
|---|---|---|---|
| **Testing / showcase** | `sarvam` — Sarvam Saaras API | Now, until on-prem GPU is provisioned at LVPEI | External SaaS (data leaves the box) |
| **Production (LVPEI)** | `self_hosted` — Faster-Whisper + IndicConformer | From the day the on-prem GPU server is live | LVPEI's own data center |

**Hard cutover, not graceful fallback.** The end state is no Sarvam dependency at all in production. Once the self-hosted stack is live at LVPEI:
1. `TRANSCRIPTION_PROVIDER=self_hosted` is set in the prod env
2. `SARVAM_API_KEY` is removed from the prod env
3. **A startup assertion in [src/lib/env.ts](src/lib/env.ts) refuses to boot** if `NODE_ENV=production` AND any external transcription credential is present. This is a hard gate, not a warning.
4. Sarvam adapter code is kept in the repo (still useful for dev laptops without GPU) but cannot execute when the prod gate is armed.

**Why dual-provider, not "build self-hosted from day one":** the on-prem GPU is a procurement-blocked dependency. Blocking the showcase on it stalls 3–6 months. Sarvam unblocks testing. The kill-switch ensures the testing convenience cannot leak into production.

### 6.2 Self-hosted transcription stack (production target)

The pipeline reuses [VAIDIX-SLM-ARCHITECTURE.md §4.3 Layer 2c](VAIDIX-SLM-ARCHITECTURE.md) and [§4.4 Indic Multilingual Rewrite Pipeline](VAIDIX-SLM-ARCHITECTURE.md). All models run on GPU instances within LVPEI's on-prem server (or owned AWS/GCP account during cloud-staging).

| Component | Model | License | VRAM | Role |
|---|---|---|---|---|
| **English STT** | Faster-Whisper large-v3 (CTranslate2) | MIT | ~6 GB | English transcription, 4x faster than vanilla Whisper |
| **Indic STT** | AI4Bharat IndicConformer | MIT | ~4 GB | Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Urdu, + 14 more scheduled languages |
| **Speaker diarization** | pyannote.audio | MIT | ~2 GB | Identifies who spoke when — faculty vs resident |
| **Language detection** | fastText lid.176 | MIT | CPU only | Per-segment language identification |
| **Translation** | IndicTrans2 (AI4Bharat) | MIT | ~1 GB | Indic → English translation, on-prem |
| **Medical term normalization** | Vaidix Core "medical-translator" persona | Apache 2.0 (Qwen base) | Shared with vLLM | Vernacular English → precise clinical terminology |
| **Keyword biasing** | [src/lib/medical-keywords.ts](src/lib/medical-keywords.ts) | Vaidix proprietary | — | Biases Whisper toward medical vocabulary |

### 6.3 Full transcription pipeline

```
Session recording (MP4) from S3/GCS
        │
        ▼
  ┌──────────────────────────────────────────┐
  │ AUDIO EXTRACTION                         │
  │ FFmpeg strips audio from MP4 → WAV       │
  └──────────────────────────────────────────┘
        │
        ▼
  ┌──────────────────────────────────────────┐
  │ SPEAKER DIARIZATION                      │
  │ pyannote.audio identifies who spoke when │
  │ → segments tagged: faculty / resident    │
  └──────────────────────────────────────────┘
        │
        ▼
  ┌──────────────────────────────────────────┐
  │ LANGUAGE DETECTION (per segment)         │
  │ fastText lid.176                         │
  │ Identifies: English, Hindi, Telugu, etc. │
  └──────────────────────────────────────────┘
        │
        ├── English segments ───→ Faster-Whisper large-v3
        │                         (medical keyword biasing)
        │
        ├── Indic segments ────→ AI4Bharat IndicConformer
        │                         + IndicTrans2 → English
        │
        └── Both paths ────────→ Vaidix Core "medical-translator"
                                  persona for clinical term
                                  normalization
                                          │
                                          ▼
                           ┌──────────────────────────┐
                           │ OUTPUT ARTIFACTS          │
                           │                          │
                           │ 1. transcript.json       │
                           │    [{speaker, start, end,│
                           │      text, lang, text_en}]│
                           │ 2. original.vtt (captions)│
                           │ 3. en.vtt (English caps) │
                           │ 4. Clean text → AI Layer │
                           └──────────────────────────┘
```

### 6.4 Transcription latency — realistic expectations

Reviewer 3 correctly flagged that post-session processing takes time. For a 1-hour lecture:

| Stage | Duration | Cumulative |
|---|---|---|
| Audio extraction (FFmpeg) | ~2 minutes | 2 min |
| Speaker diarization (pyannote) | ~10–15 minutes | 17 min |
| Language detection | ~1 minute | 18 min |
| STT: Faster-Whisper (English segments) | ~15–20 minutes | 38 min |
| STT: IndicConformer (Indic segments) | ~20–30 minutes | 68 min |
| Clinical term normalization | ~5 minutes | 73 min |
| Pearl extraction + summary (Vaidix Core) | ~7–10 minutes | 83 min |
| **Total for a 1-hour lecture** | **~60–90 minutes** | |

**User experience strategy:**

1. **During live session:** LiveKit Agent provides real-time English captions (~10 second delay, lower quality). Residents see immediate captions.
2. **Immediately after session:** Recording is available for playback within 5 minutes (transcoding starts instantly).
3. **Processing banner:** UI shows *"AI summary and pearls will be ready in ~2 hours"* with a progress indicator.
4. **Notification:** When transcription + pearl extraction completes, notify residents who attended.
5. **Priority queue:** If a faculty member requests immediate transcription of a specific session, it jumps the queue.

### 6.5 GPU instance for transcription

| Requirement | Specification |
|---|---|
| **Instance type (AWS)** | g5.xlarge (1× A10G 24GB, 4 vCPU, 16GB RAM) — ~$1.01/hr on-demand, ~$0.30/hr spot |
| **Instance type (GCP)** | g2-standard-4 (1× L4 24GB, 4 vCPU, 16GB RAM) — ~$0.74/hr on-demand, ~$0.22/hr preemptible |
| **VRAM usage** | Faster-Whisper (~6 GB) + IndicConformer (~4 GB) + pyannote (~2 GB) = ~12 GB. Fits on a single 24GB GPU. |
| **Scaling** | For 15 sessions/day (15 hours of audio), a single GPU instance processing ~1x real-time needs ~15 hours/day. Fits within 24 hours with headroom. Spike handling: use spot/preemptible instances to scale horizontally. |
| **Separation from SLM serving** | **Dedicated GPU instance for transcription.** Does NOT share with vLLM serving. Reviewer 3 correctly flagged that a single GPU cannot simultaneously serve Vaidix Core and run transcription without severe contention. |

### 6.6 Provider abstraction (code shape)

A single `TranscriptionProvider` interface, two implementations, one selector:

```
src/server/services/transcription/
├── transcription-provider.ts     # interface: transcribe(audioUrl, lang) → segments[]
├── sarvam-provider.ts            # POSTs to Sarvam Saaras API
├── self-hosted-provider.ts       # enqueues a Python worker job (Faster-Whisper / IndicConformer)
└── index.ts                      # picks provider from env, asserts prod gate
```

The `transcribe` BullMQ worker calls `getTranscriptionProvider().transcribe(...)` and never knows which one ran. Switching providers in production = one env var flip + a restart, no code change.

The prod gate (in `src/lib/env.ts`):

```ts
if (process.env.NODE_ENV === 'production' && process.env.SARVAM_API_KEY) {
  throw new Error('Production refuses to boot with SARVAM_API_KEY set — remove it from prod env')
}
```

This makes the cutover irreversible-by-accident: deploying with the wrong env doesn't degrade silently to Sarvam, it fails to start.

---

## 7. AI Post-Processing — Pearl Extraction & Summaries

### 7.1 Pearl extraction from lectures

This is the **existing two-pass grand rounds distillation pipeline** from [VAIDIX-SLM-ARCHITECTURE.md §5.3](VAIDIX-SLM-ARCHITECTURE.md), now triggered automatically by video session completion.

```
Cleaned transcript (from §6)
        │
        ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ VAIDIX CORE — "pearl-extractor" persona                      │
  │                                                                │
  │ System prompt:                                                 │
  │ "Extract clinical teaching pearls from this transcript.        │
  │  Ignore slide navigation, coughing, and filler.                │
  │  For each pearl, identify the SEMANTIC BOUNDARIES —            │
  │  the exact timestamp where the teaching topic starts and ends. │
  │  Output JSON matching the pearl schema."                       │
  └──────────────────────────────────────────────────────────────┘
        │
        ▼
  Extracted pearls → faculty review queue
        │
        ├── Approved → pearl library + `approved-pearls` RAG collection
        └── Rejected → discarded or kept as "common-trap"
```

**Output pearl schema** (matches existing [src/mock-data/pearls.json](src/mock-data/pearls.json)):

```json
{
  "id": "pearl-auto-042",
  "question": "Tell me why you should be cautious about anti-VEGF in proliferative diabetic retinopathy with tractional component",
  "answer": "Anti-VEGF can cause rapid fibrosis and contraction of fibrovascular membranes, worsening tractional retinal detachment.",
  "mechanism": "VEGF inhibition accelerates fibrotic conversion of neovascular tissue...",
  "condition": "Proliferative Diabetic Retinopathy",
  "subspecialty": "Retina",
  "bloomsLevel": 5,
  "difficulty": "advanced",
  "tags": ["PDR", "anti-VEGF", "TRD", "tractional", "fibrosis"],
  "topic": "retina",
  "citation": {
    "sourceType": "video",
    "videoId": "session-2026-04-12-grand-rounds",
    "timestamp": "23:45",
    "clipSuggestion": { "start": "22:10", "end": "26:30" },
    "faculty": "Dr. Avinash Pathengay"
  }
}
```

### 7.2 Semantic clip suggestion

Reviewer 1 correctly flagged that fixed ±2 minute windows are wrong for clinical discussions. The pearl extractor now identifies **semantic boundaries** — the actual start and end of a teaching topic in the transcript. These become `clipSuggestion.start` and `clipSuggestion.end` in the pearl citation. Faculty reviews suggested boundaries before clip generation.

### 7.3 Session summary generation

After pearl extraction, a second Vaidix Core call generates a structured summary:

```json
{
  "sessionId": "session-2026-04-12-grand-rounds",
  "title": "Grand Rounds: Anti-VEGF in Complex Retinal Cases",
  "summary": "Faculty discussed three complex PDR cases where anti-VEGF timing was critical...",
  "topicsCovered": ["PDR management", "Anti-VEGF timing", "Tractional RD risk"],
  "subspecialties": ["Retina"],
  "keyDecisions": [
    "Always assess tractional component before anti-VEGF in PDR",
    "Consider vitrectomy first if significant fibrovascular proliferation"
  ],
  "chapters": [
    { "title": "Introduction & Case 1", "start": "00:00", "end": "12:30" },
    { "title": "Anti-VEGF Decision Framework", "start": "12:30", "end": "28:45" },
    { "title": "Tractional RD Case Discussion", "start": "28:45", "end": "45:20" },
    { "title": "Q&A and Summary", "start": "45:20", "end": "52:00" }
  ],
  "pearlCount": 7,
  "duration": "52 minutes",
  "speakers": ["Dr. Pathengay", "Dr. Sharma"]
}
```

The `chapters` array is auto-generated from transcript topic segmentation and feeds into Vidstack's chapter markers.

---

## 8. Workflow Orchestration — recording lifecycle

Reviewers 1 and 2 both flagged that the pipeline between recording → transcoding → transcription → pearl extraction needs a proper state machine, not ad-hoc webhooks.

### 8.1 Recording artifact states

```
┌───────────┐     ┌────────────┐     ┌──────────────┐     ┌────────────────┐
│ RECORDING │────▶│ TRANSCODING│────▶│ TRANSCRIBING │────▶│ AI_PROCESSING  │
│           │     │            │     │              │     │                │
│ LiveKit   │     │ FFmpeg /   │     │ Whisper +    │     │ Pearl extract  │
│ Egress    │     │ MediaConv  │     │ IndicConf    │     │ + Summary      │
│ writing   │     │ → HLS      │     │ + Translation│     │ + Clip suggest │
└───────────┘     └────────────┘     └──────────────┘     └────────────────┘
                                                                  │
                                                                  ▼
                                                          ┌────────────────┐
                                                          │ READY          │
                                                          │                │
                                                          │ Playback +     │
                                                          │ captions +     │
                                                          │ pearls +       │
                                                          │ summary        │
                                                          └────────────────┘
```

Each transition can fail independently. The orchestrator must:
- Retry failed stages without re-running completed stages
- Handle partial success (e.g., transcoding succeeds but transcription fails — video is playable without captions)
- Track state per recording in the database
- Expose state to the UI ("Playable, captions processing...")

### 8.2 Implementation — BullMQ job queue

| Attribute | Value |
|---|---|
| **Queue engine** | [BullMQ](https://github.com/taskforcesh/bullmq) (MIT, Node.js, Redis-backed) |
| **Why BullMQ** | Lightweight, fits the Node.js/Next.js stack, handles retries/backoff/concurrency natively. 15 sessions/day does not justify Temporal or a heavier orchestrator. |
| **Queues** | `transcode`, `transcribe`, `ai-process` — each with independent concurrency and retry policies |
| **Retry policy** | 3 retries with exponential backoff. On final failure: mark as `FAILED`, alert engineering, allow manual retry from admin UI. |
| **Trigger** | LiveKit Egress webhook → creates a `transcode` job. `transcode` completion → creates `transcribe` job. `transcribe` completion → creates `ai-process` job. |
| **Idempotency** | Each job is keyed by `{sessionId}_{stage}`. Duplicate webhook deliveries are deduplicated. |
| **Dashboard** | BullMQ Board (open-source UI) for monitoring queue health — accessible at `/admin/jobs`. |

---

## 9. Timestamped Q&A, Engagement & Sharing

### 9.1 V1 design — sidebar list (simplified)

Reviewer 3 correctly flagged that implementing SoundCloud-style timeline markers on a custom player is non-trivial. **V1 implements Q&A as a sidebar list.** Timeline markers are deferred to V2.

```
┌─────────────────────────────┬──────────────────────────────┐
│                             │  Q&A                         │
│  ▶ Grand Rounds: DR        │                              │
│  ══════════════════ 52:18  │  📍 12:34 — Dr. Sharma       │
│                             │  "Threshold for PRP vs       │
│                             │   anti-VEGF?"                │
│  [Vidstack Player]          │  ↳ Dr. Pathengay:            │
│                             │    "In our protocol..."      │
│                             │    ❤ 14  · Reply             │
│                             │                              │
│                             │  📍 23:45 — Priya R.         │
│                             │  "Tractional risk with       │
│                             │   ranibizumab?"              │
│                             │  ↳ 3 replies          ❤ 7   │
│                             │                              │
│                             │  [+ Add Q at current time]   │
└─────────────────────────────┴──────────────────────────────┘
```

- **Click timestamp** → Vidstack player seeks to that position (`player.currentTime = timestamp`)
- **"Add Q"** → captures `player.currentTime` as the `timestamp_sec`
- **No timeline markers in V1** — avoids complex progress bar overlay engineering
- **Threaded replies** — single level of nesting (reply to a question, not reply to a reply)

### 9.2 Data model

```sql
CREATE TABLE video_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    user_role       TEXT NOT NULL,       -- 'resident' | 'faculty' | 'program_director'
    timestamp_sec   INTEGER NOT NULL,
    content         TEXT NOT NULL,
    parent_id       UUID REFERENCES video_comments(id),
    likes_count     INTEGER DEFAULT 0,
    is_pinned       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_likes (
    user_id         TEXT NOT NULL,
    target_type     TEXT NOT NULL,       -- 'video' | 'clip' | 'comment'
    target_id       TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, target_type, target_id)
);
```

### 9.3 Sharing — signed URLs with audit trail

| Share type | Mechanism |
|---|---|
| **Full recording** | S3/GCS presigned URL (default 7 days expiry, configurable by faculty). CDN signed cookie for HLS. |
| **Clip** | Same — presigned URL for the clip's HLS manifest. |
| **External share** | Copy-to-clipboard link with optional password (hashed, stored in DB). |
| **Audit** | Every share link creation, access (play/download), and revocation is logged: `{link_id, creator_id, accessor_ip, user_agent, timestamp}`. |
| **Revocation** | Faculty can revoke a shared link before expiry. Implemented by deleting the CloudFront signed cookie key or invalidating the presigned URL mapping. |

---

## 10. Stack Diagram — the full picture

```
┌───────────────────────────────────────────────────────────────────────┐
│  VAIDIX NEXT.JS UI (existing + new video pages)                       │
│                                                                        │
│  /classroom          → session list, join, watch                       │
│  /classroom/[id]     → live session (LiveKit components)         [NEW] │
│  /classroom/[id]/    → recorded lecture (Vidstack + Q&A)         [NEW] │
│    recording                                                           │
│  /pearls             → pearl library (now fed by video AI)            │
│                                                                        │
│  Components:                                                           │
│    @livekit/components-react   → live video UI                         │
│    vidstack                    → recorded video playback               │
│    custom Q&A sidebar          → timestamped comments                  │
│    custom clip browser         → clips per session                     │
└───────────────────────────────────────────────────────────────────────┘
                                  ▲
┌─────────────────────────────────┴─────────────────────────────────────┐
│  VAIDIX API ROUTES (under /api/classroom/*)                            │
│                                                                        │
│  /api/classroom/sessions/[id]/token        → LiveKit token             │
│  /api/classroom/sessions/[id]/admissions   → waiting-room admit        │
│  /api/classroom/sessions/[id]/participants → mute / remove             │
│  /api/classroom/sessions/[id]/chat         → in-session chat           │
│  /api/classroom/sessions/[id]/recordings   → playback URLs (W4)        │
│  /api/classroom/sessions/[id]/qa           → timestamped Q&A (W5)      │
│  /api/classroom/sessions/[id]/clips        → FFmpeg clip gen (W5)      │
│  /api/classroom/webhooks/livekit           → room + Egress events      │
│  /api/documents + /[id]/{classify,approve} → faculty docs (W4)         │
└───────────────────────────────────────────────────────────────────────┘
                                  ▲
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐   ┌──────────────────┐   ┌────────────────────┐
│  LIVE LAYER      │   │  ASYNC LAYER     │   │  AI LAYER          │
│  (LiveKit)       │   │  (Self-hosted)   │   │  (Vaidix SLM)      │
│                  │   │                  │   │                    │
│  LiveKit SFU     │   │  S3 / GCS       │   │  Faster-Whisper    │
│  (self-hosted    │   │  (raw MP4 +     │   │  IndicConformer    │
│   on owned cloud)│   │   HLS segments) │   │  pyannote.audio    │
│                  │   │                  │   │  IndicTrans2       │
│  • WebRTC (≤100) │   │  MediaConvert / │   │  Vaidix Core:      │
│  • HLS (>100)    │   │  Transcoder API │   │   pearl-extractor  │
│  • Screen share  │   │  (HLS transcode)│   │   summarizer       │
│  • Data channels │   │                  │   │   medical-translator│
│  • Multi-room    │   │  CloudFront /   │   │   clip-suggester   │
│    (breakouts)   │   │  Cloud CDN      │   │                    │
│  • Egress →      │──▶│  (delivery)     │   │  All on dedicated  │
│    S3/GCS        │   │                  │   │  GPU instance      │
│                  │   │  Vidstack player │   │  within owned cloud│
│  LiveKit Agent   │   │  (React, MIT)   │   │                    │
│  (real-time      │   │                  │──▶│  Transcription +   │
│   English caps)  │   │  FFmpeg (clips) │   │  pearls + summary  │
└──────────────────┘   └──────────────────┘   └────────────────────┘
         │                                              │
         │            ┌──────────────────┐              │
         │            │  ORCHESTRATION   │              │
         └───────────▶│  BullMQ + Redis  │◀─────────────┘
                      │  Job queue for   │
                      │  transcode →     │
                      │  transcribe →    │
                      │  AI process      │
                      └──────────────────┘
```

---

## 11. Component-by-Component Specification

### 11.1 LiveKit — live video SFU

| Attribute | Value |
|---|---|
| **Server** | [LiveKit Server](https://github.com/livekit/livekit) — Go binary, self-hosted on AWS/GCP |
| **License** | Apache 2.0 |
| **Deployment** | Docker Compose: `livekit-server` + `redis` + `livekit-egress` + `coturn` (TURN) |
| **React SDK** | `@livekit/components-react` |
| **Server SDK (token gen)** | `livekit-server-sdk` (Node.js) |
| **Client SDK** | `livekit-client` |
| **Egress** | Records to S3/GCS as MP4. Also provides HLS Egress for live broadcast. |
| **TURN** | Built-in TURN + dedicated `coturn` instance for hospital firewalls |
| **Roles** | Encoded in participant metadata: `{ role: 'faculty' | 'resident' | 'observer' }` |
| **Simulcast** | Enabled by default — 3 quality layers, SFU selects per subscriber |
| **Instance** | 4-core, 8GB (handles ~100 WebRTC participants). For larger sessions, HLS offloads view-only participants. |

### 11.2 Vidstack — video player

| Attribute | Value |
|---|---|
| **Library** | [Vidstack](https://www.vidstack.io/) |
| **License** | MIT |
| **React support** | Native React components, TypeScript |
| **HLS playback** | Built-in (hls.js) |
| **Captions** | VTT/SRT, multi-language toggle |
| **Chapters** | From AI-generated topic segmentation |
| **Playback speed** | 0.5x–2x |
| **Custom overlays** | Q&A sidebar interacts with `currentTime` |
| **Theming** | Tailwind-compatible CSS custom properties |

### 11.3 Transcription stack (self-hosted on dedicated GPU)

| Component | Role | License |
|---|---|---|
| **Faster-Whisper** (CTranslate2) | English STT | MIT |
| **AI4Bharat IndicConformer** | Indic language STT (22 languages) | MIT |
| **pyannote.audio** | Speaker diarization | MIT |
| **IndicTrans2** (AI4Bharat) | Indic → English translation | MIT |
| **fastText lid.176** | Language detection | MIT |
| **Vaidix Core** | Medical term normalization, pearl extraction, summaries | Apache 2.0 (Qwen base) |

### 11.4 Infrastructure services (AWS/GCP)

| Service | AWS | GCP | Purpose |
|---|---|---|---|
| **Object storage** | S3 | Cloud Storage | Raw MP4, HLS segments, clips, captions |
| **Transcoding** | MediaConvert | Transcoder API | MP4 → multi-bitrate HLS |
| **CDN** | CloudFront | Cloud CDN | HLS delivery to residents |
| **GPU instances** | g5.xlarge (A10G 24GB) | g2-standard-4 (L4 24GB) | Transcription + AI processing |
| **Compute** | EC2 (LiveKit, Next.js) | Compute Engine | Application hosting |
| **Queue backend** | ElastiCache Redis | Memorystore Redis | BullMQ + LiveKit |
| **Database** | RDS PostgreSQL | Cloud SQL PostgreSQL | Comments, likes, session metadata |

---

## 12. Integration with Existing Vaidix Codebase

### 12.1 Existing code that connects

| Existing code | How video integrates |
|---|---|
| [src/app/(platform)/classroom/page.tsx](src/app/(platform)/classroom/page.tsx) | "Join Session" → `/classroom/[id]`. "Watch Recording" → `/classroom/[id]/recording`. |
| [src/lib/types.ts](src/lib/types.ts) `TeachingSession` (line 185) | Extended with: `livekitRoomId`, `recordingId`, `recordingState`, `transcriptUrl`, `captionUrls`, `clipIds`, `pearlIds` |
| [src/mock-data/pearls.json](src/mock-data/pearls.json) | Video-extracted pearls use the same schema with `citation.sourceType: 'video'` |
| [src/lib/training-queue.ts](src/lib/training-queue.ts) | Approved video pearls feed into the training queue for LoRA refinement |
| [src/app/(platform)/pearls/page.tsx](src/app/(platform)/pearls/page.tsx) | Pearl cards with `citation.sourceType: 'video'` show a "Jump to video" link |
| [src/lib/medical-keywords.ts](src/lib/medical-keywords.ts) | Keyword biasing for Faster-Whisper |
| [src/stores/](src/stores/) (Zustand) | New `useVideoStore` for live room state, playback, Q&A |

### 12.2 New pages

| Route | Purpose |
|---|---|
| `/classroom/[id]` | Live session room (LiveKit components) |
| `/classroom/[id]/recording` | Recorded lecture player (Vidstack + Q&A sidebar + clips) |

### 12.3 API routes

All video-related endpoints live under `/api/classroom/*` (chosen during W2 build to keep "classroom" as the user-facing concept; "video" is an implementation detail). Earlier draft of this doc said `/api/video/*` — current code uses `/api/classroom/*`. Below: shipped (W1–W3) vs remaining (W4–W5):

| Route | Method | Status | Purpose |
|---|---|---|---|
| `/api/classroom/sessions` | POST/GET | ✅ shipped (W2/W3) | CRUD sessions |
| `/api/classroom/sessions/[id]` | GET/PATCH/DELETE | ✅ shipped | Session detail, update, cancel |
| `/api/classroom/sessions/[id]/token` | POST | ✅ shipped | LiveKit room token, role-based |
| `/api/classroom/sessions/[id]/admissions` + `/[admissionId]` | POST/GET/PATCH | ✅ shipped | Waiting-room admit/deny |
| `/api/classroom/sessions/[id]/participants` | GET/PATCH | ✅ shipped | Faculty mute/remove |
| `/api/classroom/sessions/[id]/chat` | POST/GET | ✅ shipped | In-session chat persistence |
| `/api/classroom/sessions/[id]/end` | POST | ✅ shipped | End session, set `actualEnd` |
| `/api/classroom/sessions/[id]/share-link` | POST | ✅ shipped | Tokenized join link for outsiders |
| `/api/classroom/sessions/[id]/{approve,reject,reschedule}` | POST | ✅ shipped (W3) | PD→Faculty approval workflow |
| `/api/classroom/sessions/[id]/invites` | POST/DELETE | ✅ shipped (W3) | Invite-only attendees |
| `/api/classroom/sessions/[id]/ics` | GET | ✅ shipped (W3) | Per-session `.ics` download |
| `/api/calendar/{events,ics,subscribe}` + `/ics/user/[id]` | GET | ✅ shipped (W3) | Calendar feed + subscribable iCal |
| `/api/classroom/webhooks/livekit` | POST | ✅ shipped | LiveKit room events (W2); will also receive Egress events in W4 |
| `/api/classroom/sessions/[id]/recordings` | GET | ❌ W4 | List recordings + signed playback URLs |
| `/api/classroom/sessions/[id]/transcripts` | GET | ❌ W4 | Transcript + VTT captions |
| `/api/classroom/sessions/[id]/qa` + `/[id]/{like,pin,reply}` | POST/GET/PUT/DELETE | ❌ W5 | Timestamped Q&A CRUD + engagement |
| `/api/classroom/sessions/[id]/clips` | POST/GET | ❌ W5 | FFmpeg clip generation |
| `/api/classroom/sessions/[id]/recording-share` | POST | ❌ W5 | Signed recording share + audit |
| `/api/documents` + `/api/documents/[id]/{classify,approve,tag-session}` | POST/GET/PATCH | ❌ W4 | Faculty document upload + AI classification |

### 12.4 npm packages

```json
{
  "dependencies": {
    "livekit-server-sdk": "^2.x",
    "@livekit/components-react": "^2.x",
    "livekit-client": "^2.x",
    "vidstack": "^1.x",
    "bullmq": "^5.x"
  }
}
```

---

## 13. Infrastructure & Cost Estimation

### 13.1 Assumptions

| Assumption | Value |
|---|---|
| Sessions per day | 15 |
| Average session length | 1 hour |
| Average participants per session | 150 (range 50–450) |
| New video per month | ~450 hours |
| Storage per hour (raw MP4 + HLS multi-bitrate) | ~4 GB |
| Monthly new storage | ~1.8 TB |
| Retention | 12 months (TBD, see §18.1) |
| Cloud provider | AWS (Mumbai region) or GCP (Mumbai region) |
| GPU sharing | **No** — dedicated transcription GPU, separate from Vaidix Core serving |

### 13.2 Monthly cost estimate (AWS Mumbai)

| Component | Instance / Service | Monthly Cost (USD) |
|---|---|---|
| **LiveKit server** | c5.xlarge (4 vCPU, 8GB) + Egress | ~$125 |
| **TURN server** | t3.medium (coturn) | ~$30 |
| **Transcription GPU** | g5.xlarge (A10G 24GB) — spot instances, ~15 hrs/day active | ~$140 (spot) – $460 (on-demand) |
| **Vaidix Core GPU** (shared with SLM, already budgeted in SLM doc) | g5.xlarge or p3.2xlarge | Already budgeted |
| **Transcoding** | MediaConvert (450 hrs/mo × $0.024/min) | ~$650 |
| **S3 storage** | ~1.8 TB new/mo, ~10 TB after 6 months | ~$230 (at $0.023/GB) |
| **CloudFront** | ~5 TB transfer/mo (estimated playback) | ~$425 (at $0.085/GB India) |
| **Redis** (ElastiCache) | cache.t3.small | ~$25 |
| **RDS PostgreSQL** | db.t3.medium | ~$65 |
| **Total** | | **~$1,690 – $2,010/mo** |

### 13.3 Cost optimization levers

| Optimization | Savings |
|---|---|
| **Spot/preemptible GPU instances** for transcription (interruptible is fine — BullMQ retries) | ~70% on GPU cost |
| **Self-hosted FFmpeg** instead of MediaConvert (dedicated 4-core instance) | ~$550/mo saved, but requires pipeline engineering |
| **S3 Intelligent-Tiering** for recordings older than 30 days | ~40% on storage after month 6 |
| **Reduce HLS bitrate ladder** (skip 1080p for mobile-first audience) | ~30% on storage + CDN |
| **Reserved instances** for always-on components (LiveKit, Redis, RDS) | ~30% on compute |

### 13.4 GCP alternative estimate

GCP Transcoder API is cheaper ($0.015/min vs $0.024/min for MediaConvert), and GCS Mumbai pricing is competitive. Estimated total: **~$1,400 – $1,700/mo** on GCP.

### 13.5 Comparison with rejected alternatives

| Approach | Monthly cost | Self-hosted | Indian languages | Clip generation |
|---|---|---|---|---|
| **LiveKit + AWS/GCP (selected)** | $1,690–2,010 | Yes, fully owned | Yes (self-hosted models) | FFmpeg, self-hosted |
| LiveKit + Mux (v1.0, rejected) | $1,200–1,500 | Live: yes. Async: no (Mux US) | Yes | Mux Clips API |
| Zoom SDK | $2,000–3,500 | No | English only | No |
| 100ms + Mux | $1,500–2,500 | No | No | Mux Clips API |

---

## 14. Deployment Strategy

### 14.1 Phase timeline

```
Phase 1 — V1 Launch (weeks 1–8):
├── LiveKit on AWS/GCP (WebRTC for all sessions, HLS deferred)
├── LiveKit Egress → S3/GCS → MediaConvert/Transcoder → HLS
├── Vidstack player with basic playback + captions
├── Transcription: Faster-Whisper (English) + IndicConformer (Indic)
├── Pearl extraction pipeline connected
├── Q&A sidebar (list with timestamp links, no timeline markers)
├── BullMQ orchestration for recording lifecycle
├── No breakout rooms in V1
└── Goal: working live sessions + recording + playback + Q&A + pearls

Phase 2 — Enhancements (weeks 9–16):
├── HLS broadcast for large sessions (>100 participants)
├── LiveKit Agent for real-time English captions
├── Breakout rooms (random assignment, no recording)
├── Clip generation (FFmpeg + faculty approval)
├── Search-to-scene (transcript search → video seek)
├── Share links with audit trail
├── Faculty controls (mute all, stop recording, expunge)
└── Goal: full feature set, production-ready

Phase 3 — Optimization (month 5+):
├── Timeline markers on Q&A (V2 upgrade from sidebar)
├── Offline viewing (encrypted download)
├── Educational heatmap (re-watch analytics → auto pearl suggestion)
├── Self-hosted FFmpeg transcoding (replace MediaConvert if cost-justified)
├── Storage tiering (Intelligent-Tiering / Nearline for old recordings)
└── Goal: cost optimization, advanced features
```

---

## 15. Faculty Controls & Moderation

Reviewer 3 correctly flagged missing faculty controls. These are critical for a medical education platform:

| Control | Implementation |
|---|---|
| **Mute all participants** | LiveKit Server SDK: update room permissions to disable audio publishing for all non-faculty |
| **Disable chat** | LiveKit data channel permission toggle |
| **Stop recording mid-session** | API call to LiveKit Egress to stop the recording. Use case: patient identity accidentally revealed. |
| **Expunge recording** | Permanently delete raw MP4, HLS segments, transcripts, captions, and all derived artifacts (clips, pearls) for a session. Logged as audit event. Implements DPDPA right to erasure. |
| **Remove participant** | LiveKit Server SDK: remove participant from room |
| **Pin Q&A answer** | Faculty can pin important answers to appear first at each timestamp |
| **Approve clips** | AI suggests clips. Faculty must approve before clips are playable by residents. |
| **Manual clip override** | Faculty can adjust AI-suggested clip boundaries or create clips from scratch |
| **Session classification override** | Faculty can mark any session as "restricted" (no sharing, no clip generation, auto-delete after N days) |

---

## 16. Monitoring, SLOs & Reliability

### 16.1 Service Level Objectives

| Metric | Target | Alert threshold |
|---|---|---|
| **Video join success rate** | ≥99% | Alert if <98% over 1 hour |
| **Recording success rate** | ≥99.5% (all sessions recorded by default) | Alert on any recording failure |
| **Time to playback** (recording available after session ends) | <10 minutes | Alert if >20 minutes |
| **Transcription completion** (full pipeline) | <2 hours after session end | Alert if >3 hours |
| **Video playback start time** | <3 seconds (p95) | Alert if p95 >5 seconds |
| **HLS segment availability** | 99.9% (CDN) | Alert on CDN errors |

### 16.2 Observability stack

| Component | Tool | What it monitors |
|---|---|---|
| **LiveKit server** | Prometheus + Grafana | SFU CPU, memory, participant count, packet loss, WebRTC quality |
| **Recording pipeline** | BullMQ Board + custom Langfuse events | Job state, retries, failures, processing time per stage |
| **Transcription** | Langfuse (already in SLM stack) | Transcription duration, word error rate samples, language distribution |
| **Video playback** | Vidstack analytics events → custom dashboard | Buffering ratio, playback start time, drop-off points |
| **Storage** | CloudWatch / Cloud Monitoring | S3/GCS usage, egress, cost |
| **Application** | OpenTelemetry → Langfuse or Grafana Tempo | End-to-end request tracing across LiveKit, BullMQ, transcription, CDN |

### 16.3 Failure handling

| Failure | Recovery |
|---|---|
| **LiveKit Egress recording fails** | Automatic retry (3x). If all retries fail, alert engineering + mark session as "recording failed" in UI. Manual fallback: re-record or upload faculty's local recording. |
| **Transcoding fails** | BullMQ retry with exponential backoff. Raw MP4 is safe in S3/GCS. Manual fallback: serve raw MP4 via Vidstack (no HLS, degraded experience but functional). |
| **Transcription fails** | BullMQ retry. Video is still playable without captions. UI shows "Captions processing..." indefinitely until manual intervention. |
| **LiveKit server crashes** | Docker restart policy: `unless-stopped`. Health check every 30s. Standby instance (cold spare) promoted if primary is down >2 minutes. |
| **GPU instance terminated** (spot/preemptible) | BullMQ job returns to queue. New spot instance claims it. No data loss. |

---

## 17. Security & Compliance

### 17.1 Data residency

**Production target:** all data stays within owned infrastructure (LVPEI on-prem, with AWS/GCP Mumbai as cloud-staging fallback). The production env gate (§6.1, §6.6) prevents accidental external-API leakage at boot.

**Testing / showcase exception:** while the LVPEI on-prem GPU is being procured, audio is sent to Sarvam Saaras for transcription. **Synthetic / consented demo data only — no real LVPEI patient audio.** This is documented as a time-bounded exception that closes the moment the on-prem stack is live (see §6.1 cutover checklist).

| Data type | Storage location | Encryption |
|---|---|---|
| Raw recordings (MP4) | S3/GCS or LVPEI MinIO | SSE-S3 / server-side AES-256 |
| HLS segments | S3/GCS or LVPEI MinIO | SSE-S3 / server-side AES-256 |
| Transcripts | S3/GCS or MinIO + PostgreSQL | SSE-S3 + TDE |
| Captions (VTT) | S3/GCS or MinIO | SSE-S3 / server-side AES-256 |
| Q&A comments | PostgreSQL | TDE |
| Audio sent to Sarvam (testing only) | Sarvam servers, transient | TLS in-flight; **disabled in production by env gate** |

### 17.2 Access control

| Mechanism | Implementation |
|---|---|
| **LiveKit room tokens** | Short-lived (6 hours), scoped to specific room, role encoded in metadata |
| **CDN signed URLs/cookies** | CloudFront signed cookies (per-session, 24-hour expiry) or GCS signed URLs |
| **Share link security** | Presigned URL + optional password + audit trail + revocability |
| **PHI in transcripts** | Transcripts pass through the PHI/PII Sanitizer ([VAIDIX-SLM-ARCHITECTURE.md §12.5](VAIDIX-SLM-ARCHITECTURE.md)). Tier 1 (regex, Indian-context) is shipped in W4 (`src/server/services/phi/phi-scanner.ts` — Aadhaar + Verhoeff, PAN, mobile, MRN, DOB, age-name, email, Luhn cards). Tier 2 (Microsoft Presidio Python sidecar) layers on top in Phase B for ML-based PERSON/LOCATION redaction. The transcribe worker (W4 Stream B) is the integration point — currently writes raw transcripts; the Presidio sidecar deploy at LVPEI will flip the worker to call sanitize-first before persisting. Document uploads already gate through Tier 1 (W4 Stream C C5). |
| **Audit logging** | Every room join, recording start/stop, clip creation, share link generation, share link access — logged with user ID, IP, timestamp |

### 17.3 DPDPA compliance

| Requirement | How addressed |
|---|---|
| Data minimization | Recordings auto-deleted after retention period (TBD). PHI sanitized from transcripts. |
| Right to erasure | Faculty can expunge any recording and all derived artifacts (§15). |
| Purpose limitation | Recordings used only for education and AI training (with faculty approval). |
| Data localization | All infrastructure in Mumbai region, owned accounts only. |

---

## 18. Open Decisions Pending

### 18.1 Recording retention policy

- How long are recordings retained? 6 months? 12 months? Indefinitely?
- At ~1.8 TB/month, 12-month retention = ~22 TB. Storage cost: ~$500/mo on S3 standard, ~$200/mo with Intelligent-Tiering.
- **Owner:** LVPEI administration + HUmanoid
- **Blocking:** Storage cost planning

### 18.2 Cloud provider selection — AWS or GCP

- Both are viable. GCP is slightly cheaper for transcoding. AWS has more mature MediaConvert.
- **Owner:** LVPEI IT + Humanoid engineering
- **Blocking:** Infrastructure provisioning

### 18.3 Shared microphone in lecture halls

Reviewer 1 asked: How does speaker diarization handle multiple residents sharing a single physical microphone in a lecture hall? pyannote.audio relies on speaker embeddings — if all audio comes from one microphone with multiple speakers, diarization accuracy drops.
- **Mitigation:** For lecture-hall sessions, skip per-resident diarization. Tag all audio as "audience." Faculty audio (separate mic) is still diarized correctly.
- **Owner:** Engineering (test with real LVPEI lecture-hall audio)

---

## 19. External Review — accepted, rejected, deferred

Three external AI reviewers evaluated v1.0. This section documents what was accepted, rejected, and why.

### 19.1 Accepted and incorporated in v2.0

| Feedback | Source | What changed |
|---|---|---|
| **Remove Mux — data residency risk** | Reviewer 3 | Mux replaced with fully self-hosted AWS/GCP pipeline (§5) |
| **Workflow orchestration / state machine** | Reviewers 1 & 2 | Added BullMQ-based recording lifecycle orchestration (§8) |
| **Semantic clip boundaries (not fixed windows)** | Reviewer 1 | Pearl extractor now identifies semantic topic boundaries (§7.2) |
| **HLS broadcast for large sessions** | Reviewer 1 | Added WebRTC/HLS hybrid: WebRTC ≤100, HLS >100 (§4.5) |
| **Real-time English captions during live sessions** | Reviewer 3 | Added LiveKit Agent for real-time STT (§2.1, §6.4) |
| **Transcription latency — realistic expectations + UX** | Reviewer 3 | Added latency table, processing banner, notification flow (§6.4) |
| **Dedicated GPU for transcription** | Reviewer 3 | Separate GPU instance, not shared with vLLM serving (§6.5) |
| **Faculty controls (mute all, stop recording, expunge)** | Reviewer 3 | New section §15 |
| **Simplified Q&A V1 (sidebar list, no timeline markers)** | Reviewer 3 | Timeline markers deferred to V2 (§9.1) |
| **TURN server for hospital firewalls** | Reviewer 3 | Added coturn deployment alongside LiveKit (§11.1) |
| **Monitoring / SLOs** | Reviewers 2 & 3 | New section §16 with SLOs, observability, failure handling |
| **Share link audit trail + revocation** | Reviewer 3 | Added audit logging and revocation to sharing (§9.3) |
| **Artifact lifecycle states** | Reviewer 2 | Recording states: RECORDING → TRANSCODING → TRANSCRIBING → AI_PROCESSING → READY (§8.1) |
| **Cost assumption hygiene** | Reviewer 2 | Explicit assumptions table, estimate bands, optimization levers (§13) |
| **Search-to-scene** | Reviewer 1 | Global transcript search → video seek. Deferred to Phase 2. |
| **Educational heatmap** | Reviewer 1 | Re-watch analytics → auto pearl suggestion. Deferred to Phase 3. |
| **Offline viewing** | Reviewer 3 | Encrypted download for offline watching. Deferred to Phase 2. |
| **Auto-chapter detection** | Reviewer 1 | Vaidix Core generates chapter markers from transcript. Added to §7.3. |

### 19.2 Rejected — overthinking or not applicable

| Feedback | Source | Why rejected |
|---|---|---|
| **Temporal for orchestration** | Reviewer 1 | Temporal is enterprise-grade orchestration for thousands of concurrent workflows. BullMQ handles 15 sessions/day comfortably. Temporal adds operational complexity (Java/Go server, separate DB) without proportional benefit at this scale. |
| **"Policy engine" for data classification** | Reviewer 2 | v1.0 had a patient-adjacent vs educational split requiring a classification engine. v2.0 eliminates this: ALL data stays in owned infrastructure. No classification needed — there is no "send to external service" path. |
| **Cloudflare Stream as Mux alternative** | Reviewer 3 | Still a third-party SaaS. User constraint: no third-party services for any data. |
| **Amazon IVS for broadcast** | Reviewer 1 | Adds another managed service (Twitch infrastructure). LiveKit HLS Egress + CloudFront achieves the same result within owned infrastructure. |
| **Mediasoup/Pion/Janus as LiveKit alternatives** | Reviewer 1 | LiveKit decision is made and validated by all three reviewers. Mediasoup/Pion are too low-level. Janus has no React SDK. Reopening this adds decision fatigue without benefit. |
| **100ms/Dyte/Daily as alternatives** | Reviewer 1 | All cloud-only. Rejected by the owned-infrastructure constraint. |
| **Azure AI Speech Medical model** | Reviewer 1 | External API. Violates the no-external-APIs constraint. |
| **Bhashini (Govt of India API)** | Reviewer 1 | External API. Also, quality is inconsistent compared to IndicConformer for medical terminology. |
| **Video.js instead of Vidstack** | Reviewer 3 | Video.js has a mature markers plugin, but Vidstack is newer, React-native (not a wrapper), TypeScript-first, and MIT licensed. Vidstack is the better long-term choice. Timeline markers can be implemented as custom overlays on Vidstack in V2. |
| **Typesense/Algolia for transcript search** | Reviewer 1 | Adding a dedicated search engine for 450 hours/month of transcripts is premature. PostgreSQL full-text search handles this volume. Revisit if search becomes a bottleneck at >5,000 hours. |
| **"Watch together" synced playback** | Reviewer 1 | Nice feature but not a requirement. Adds WebRTC data channel complexity for synchronized playback. Not in scope. |
| **Multi-agent orchestration for video AI** | — | Current persona-based prompting handles pearl extraction, summarization, and clip suggestion. Separate agents add architectural complexity without clear benefit at current scale. |

### 19.3 Deferred — valid but not V1

| Feedback | Target phase | Rationale |
|---|---|---|
| **Timeline markers on Q&A** | Phase 2 | Requires custom progress bar overlay. V1 sidebar list is functional. |
| **Breakout rooms** | Phase 2 | Custom orchestration needs dedicated engineering. V1 launches without. |
| **Offline viewing (encrypted download)** | Phase 2 | DRM/encryption adds complexity. Focus on online playback first. |
| **Search-to-scene** | Phase 2 | Requires transcript indexing. Build after transcription pipeline is stable. |
| **Real-time compliance alerts (LiveKit Agent)** | Phase 3 | Agent detects patient names spoken live. Requires NER integration into LiveKit Agent. |
| **Educational heatmap** | Phase 3 | Re-watch analytics needs months of data to be meaningful. |
| **Self-hosted FFmpeg transcoding** | Phase 3 | Only worth the engineering if MediaConvert costs exceed $500/mo consistently. |

---

## 20. References

### 20.1 Project documents

- [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md) — SLM architecture, transcription pipeline, pearl extraction, safety
- [Vaidix-LXS-CTO-Features-Brief.html](../Vaidix-LXS-CTO-Features-Brief.html) — Product features brief
- [Feeddback.md](../Feeddback.md) — External AI reviewer feedback (3 reviewers)

### 20.2 Technology documentation

| Technology | Documentation |
|---|---|
| LiveKit Server | [docs.livekit.io](https://docs.livekit.io/) |
| LiveKit React SDK | [docs.livekit.io/realtime/quickstarts/react](https://docs.livekit.io/realtime/quickstarts/react/) |
| LiveKit Egress | [docs.livekit.io/home/egress/overview](https://docs.livekit.io/home/egress/overview/) |
| LiveKit Agents | [docs.livekit.io/agents](https://docs.livekit.io/agents/) |
| Vidstack | [vidstack.io/docs](https://www.vidstack.io/docs/player/getting-started/installation/react) |
| Faster-Whisper | [github.com/SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) |
| AI4Bharat IndicConformer | [github.com/AI4Bharat/IndicConformer](https://github.com/AI4Bharat/IndicConformer) |
| AI4Bharat IndicTrans2 | [github.com/AI4Bharat/IndicTrans2](https://github.com/AI4Bharat/IndicTrans2) |
| pyannote.audio | [github.com/pyannote/pyannote-audio](https://github.com/pyannote/pyannote-audio) |
| BullMQ | [docs.bullmq.io](https://docs.bullmq.io/) |
| AWS MediaConvert | [docs.aws.amazon.com/mediaconvert](https://docs.aws.amazon.com/mediaconvert/) |
| GCP Transcoder API | [cloud.google.com/transcoder/docs](https://cloud.google.com/transcoder/docs) |

### 20.3 Alternatives evaluated (for audit trail)

| Platform | Why not selected (see §4.3) |
|---|---|
| Jitsi Meet | Iframe-only React integration |
| BigBlueButton | Monolithic, no React SDK, custom recording format, LGPL |
| OpenVidu | Fewer features than LiveKit, smaller community |
| Mediasoup | Too low-level, no signaling/recording/chat/React SDK |
| 100ms | Cloud-only — data leaves owned infrastructure |
| Daily.co | Cloud-only |
| Agora | Cloud-only, Chinese-origin |
| Twilio Video | Being sunset |
| Whereby | Too simple |
| Dyte | Cloud-only |
| Mux | US-based SaaS, no Indian data center, data leaves owned infrastructure |
| Cloudflare Stream | Third-party SaaS |
| Zoom SDK | Iframe-only, cloud-only, no clip generation, no Indic transcription |

---

## 21. Change Log

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-04-12 | Initial architecture — LiveKit + Mux + Vaidix SLM pipeline |
| v2.0 | 2026-04-12 | **Major revision:** Mux removed (data residency). Fully self-hosted async pipeline (S3/GCS + MediaConvert/Transcoder + CloudFront/CDN + Vidstack). BullMQ orchestration added. HLS broadcast for large sessions. Real-time English captions. Faculty controls. Monitoring/SLOs. Simplified Q&A V1. Breakout rooms simplified (random, no recording, Phase 2). Dedicated transcription GPU. 3-reviewer feedback incorporated with accept/reject rationale (§19). |
| v2.1 | 2026-04-24 | **Doc-realignment pass with code reality.** §6.1 rewritten: dual transcription provider (Sarvam for testing, Faster-Whisper/IndicConformer self-hosted for production) behind a single interface, with hard env-gate cutover that refuses to boot in production with `SARVAM_API_KEY` set. §6.6 added: provider abstraction (code shape). §12.3 + §10 stack diagram: API namespace corrected from `/api/video/*` to `/api/classroom/*` to match shipped W1–W3 code; W1–W3 routes marked ✅ shipped, W4–W5 routes marked ❌ pending. §17.1: data-residency table acknowledges Sarvam testing exception (synthetic data only, hard-disabled in production). No reversal of v2.0 architectural decisions — only reconciliation with a procurement reality (on-prem GPU lead time) and shipped code. |
| v2.2 | 2026-04-25 | **PHI scanner shipped (Tier 1).** §17 access control table updated: PHI sanitiser is no longer "documented but unimplemented." Tier 1 regex scanner with Indian-context detectors (Aadhaar+Verhoeff / PAN / mobile / MRN / DOB / age-name / email / Luhn cards) is shipped + unit-tested 8/8 (W4 review-feedback fix v1.3, see [VAIDIX-BUILD-PLAN-NOW.md §17](VAIDIX-BUILD-PLAN-NOW.md)). Document uploads now auto-scan via BullMQ `phi-scan` worker; high-severity findings block tag-to-session unless admin/PD overrides. Tier 2 (Microsoft Presidio Python sidecar) remains the Phase B upgrade for ML-based PERSON/LOCATION redaction; the transcribe worker integration (sanitise-before-persist) ships then. |
