# Vaidix — Build Plan (NOW)

## Phase 1 Execution Plan — All 22 Features, Production-Ready by W15

| Field | Value |
|---|---|
| **Document status** | v1.2 — 19-week Phase 1 plan with W4-Sprint expansion (was 6-week showcase in v1.0/v1.1) |
| **Date** | 2026-04-13 (v1.0); 2026-04-24 (v1.1 status update + v1.2 Phase 1 expansion) |
| **Owner** | Symbiosys Technologies |
| **Goal** | **Phase 1 production-ready delivery: all 22 features from [Feeddback.md](../Feeddback.md), no prototypes.** W15 ends with a 30-min demo covering every feature live. |
| **Environment** | Local dev (E: drive) → LVPEI on-prem (production) — see §16. Cloud (AWS/GCP Mumbai) is the staging fallback only. |
| **Parent doc** | [Vaidix-Build-Approach.md](../Vaidix-Build-Approach.md) (full 42-domain plan), [Feeddback.md](../Feeddback.md) (CTO brief — source of the 22 Phase-1 features) |
| **Related docs** | [VAIDIX-VIDEO-ARCHITECTURE.md](VAIDIX-VIDEO-ARCHITECTURE.md), [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md) |

## Status as of 2026-04-24

| Week | Calendar | Team | Scope | Status |
|---|---|---|---|---|
| W0 — Schema lock + env | done | 1 dev | ~94 tables, 5 migrations, Docker compose (LiveKit + Redis + coturn + MinIO) | ✅ done |
| W1 — Real auth | done | 1 dev | NextAuth + invitations + Gmail SMTP, password reset, role middleware, admin user mgmt, e2e-w1 | ✅ done |
| W2 — LiveKit live video | done | 1 dev | Tokens, sessions, screen share, chat, hand raise, faculty controls, admissions/waiting room, share-link, e2e-w2 | ✅ done |
| W3 — Scheduling & calendar | done | 1 dev | Cohorts, PD→Faculty approval, RRULE, react-big-calendar, .ics, subscribable iCal feed, 24h/15min reminder worker | ✅ done |
| **W4-Sprint** — Recording + Transcription + Documents + Live Engagement Foundation | **4 calendar weeks** | **11 devs in 4 parallel streams** | Egress → MinIO HLS → Vidstack; `TranscriptionProvider` (Sarvam + self-hosted, hard env gate); document upload + AI classification + presentation enhancement; promo + reels generators; live captions agent; engagement signals foundation; live hooks + presenter alerts; WhatsApp pearl delivery; live leaderboards; coach + reflection bots; Bloom's analytics; Kirkpatrick L1+L2 — **15 of the 22 Phase-1 features land here, production-ready** | ❌ not started |
| W5 — Q&A + Breakouts + Resources + Polish | 1 week | 3 devs | Timestamped Q&A, resources section, breakout rooms, AI breakout grouping, breakout co-facilitator, recording-share with audit, mobile polish | ❌ not started |
| W6 — Core Learner: Cases + Conversations + Topics | 1 week | 3 devs | Cases full chat engine + Conversations + Topics + Pre-Conference Q&A engine wired live | ❌ not started |
| W7 — Reviews + Journal + Challenges + Knowledge Atoms | 1 week | 3 devs | In-app spaced repetition, journal, challenges, knowledge atoms | ❌ not started |
| W8 — Assessment & Analytics | 1 week | 3 devs | Scoring historical log + DOPS/Mini-CEX/EPA + Progress + Kirkpatrick L3 (uses DOPS data) | ❌ not started |
| W9 — Knowledge Library | 1 week | 3 devs | Pearls library, Atlas, Medical Reference | ❌ not started |
| W10 — Practice Tools + Simulators | 1 week | 3 devs | Simulators with branching + adaptive baseline + live in-session sim launch | ❌ not started |
| W11 — Pathways + Recommendations | 1 week | 3 devs | Competency Courses + Recommendations Engine + Readiness Predictor wired with engagement signals | ❌ not started |
| W12 — Infrastructure | 1 week | 3 devs | Notifications full + global Search + Reports & Exports + CME credits | ❌ not started |
| W13 — AI Pipeline | 1 week | 3 devs | Content Ingestion + RAG + Training Queue + live in-session AI clinical assistant | ❌ not started |
| W14 — Whiteboard + Admin | 1 week | 3 devs | Whiteboard sync + PDF export + Audit fill-gaps + VCCE + Gamification + Webhooks + User Preferences | ❌ not started |
| W15 — Polish, Demo Prep, Rehearsal | 1 week | 3 devs | Seed Phase-1 demo data, e2e rehearsal, backup recording, performance testing | ❌ not started |
| W16+ — Ethics-blocked deferred | TBD | — | Emotion & Attention Analytics (#7) — ships only after LVPEI ethics committee sign-off | ⏸ blocked on ethics, not engineering |

**Phase 1 totals: 19 calendar weeks (W4-Sprint takes 4, others take 1 each), 22 Phase-1 features delivered production-ready, all on the 94-table locked schema with additive-only migrations.**

**Production-ready bar throughout:** every feature includes DB migration, API routes, UI, role-based auth, audit hooks, rate limiting where applicable, error paths, integration tests in `scripts/e2e-w*.ts`, security review pass. **No prototypes, no UI-only stubs.**

---

## Table of Contents

1. [What We're Building Now](#1-what-were-building-now)
2. [What We're NOT Building Yet](#2-what-were-not-building-yet)
3. [The 6-Week Timeline](#3-the-6-week-timeline)
4. [Week 0 — Schema Lock + Environment Setup](#4-week-0--schema-lock--environment-setup)
5. [Week 1 — Real Auth + User Management](#5-week-1--real-auth--user-management)
6. [Week 2 — LiveKit Live Video](#6-week-2--livekit-live-video)
7. [Week 3 — Session Scheduling & Calendar](#7-week-3--session-scheduling--calendar)
8. [Week 4 — Recording + Transcription + Document Upload](#8-week-4--recording--transcription--document-upload)
9. [Week 5 — Q&A + Resources + Polish](#9-week-5--qa--resources--polish)
10. [Week 6 — Demo Ready](#10-week-6--demo-ready)
11. [Prerequisites (Before Week 0)](#11-prerequisites-before-week-0)
12. [Tech Stack Summary](#12-tech-stack-summary)
13. [Success Criteria](#13-success-criteria)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [After the Showcase](#15-after-the-showcase)

---

## 1. What We're Building Now (Phase 1 — all 22 features)

The Phase 1 scope is the **full feature set from the original CTO brief** ([Feeddback.md](../Feeddback.md)) — three stages (Pre-Conference / Live Conference / Post-Conference), 22 features total. **All ship production-ready** by end of Week 15. No prototypes, no UI-only stubs, no "demoware."

### Existing pillars (W0–W3, ✅ shipped)

| Pillar | Where |
|---|---|
| Real Authentication | W1 |
| Live Video Conferencing (LiveKit, up to 100 WebRTC) | W2 |
| Session Scheduling + Cohorts + Calendar + .ics + Reminders | W3 |

### W4-Sprint pillars (15 features in 4 weeks, 11 devs)

| Stream | Features |
|---|---|
| A — Recording & Media | Recording → HLS playback (Vidstack), multi-lang caption toggle, chapters, **#10 Reels**, **#1 Promo** |
| B — Transcription & Live Captions | `TranscriptionProvider` (Sarvam + self-hosted), env gate, **#14 Real-time live captions** |
| C — Documents & Presentation AI | Upload, AI classify, PHI sanitize, library, session tagging, Resources tab, **#15 Smart Presentation Studio** |
| D — Engagement & Out-of-band | **#22 Engagement signals**, **#4 Hooks**, **#5 Presenter alerts**, **#9 WhatsApp pearls**, **#17 Live leaderboards**, **#19 Coach**, **#20 Reflection bot**, **#21 Bloom's analytics**, **#11 Kirkpatrick L1+L2** |

### W5–W14 pillars (7 features as their prerequisites land)

| Week | Phase-1 features added |
|---|---|
| W5 | Q&A + Resources + breakouts + **#6 Co-facilitator** + **#13 AI grouping** |
| W6 | Cases + Conversations + Topics + **#2 Pre-Conference Q&A engine** |
| W7 | Reviews + Journal + Challenges + Knowledge Atoms |
| W8 | Scoring + DOPS/Mini-CEX/EPA + Progress + **#11 Kirkpatrick L3** |
| W9 | Pearls + Atlas + Reference |
| W10 | Simulators + **#16 Branching/Adaptive** + **#8 Live in-session sim launch** |
| W11 | Courses + Recommendations + **#3 Readiness Predictor UI** |
| W12 | Notifications + Search + Reports + CME |
| W13 | Content Ingestion + RAG + Training Queue + **#18 Live AI Clinical Assistant** |
| W14 | **#12 Whiteboard sync + PDF export** + Audit + VCCE + Gamification + Webhooks + Prefs |
| W15 | Polish + Phase-1 production demo |

### Deferred to W16+ (1 feature, calendar dependency)

| Feature | Reason |
|---|---|
| **#7 Emotion & Attention Analytics** (camera attention drop, facial fatigue) | Privacy-loaded — needs LVPEI ethics committee sign-off first. Engineering scope is small (~1 week) once approved. |

---

## 2. What's NOT in Phase 1

The 22 features above cover everything in the original CTO brief. Out of Phase 1 (= Phase 2):

| Phase 2 item | Why later |
|---|---|
| Vaidix Core SLM activation (replaces Gemini) | Needs ~3 months of accumulated training-queue corrections before LoRA training is meaningful. Phase A uses Gemini through W15. |
| EMR integration (HL7 FHIR) | Requires LVPEI EMR vendor coordination — not blocking Phase 1 demo |
| SSO/SAML, SCIM provisioning, 2FA | Standard enterprise integrations, can land after first LVPEI cohort proves the platform |
| Offline sync (encrypted recording download) | Nice-to-have; LVPEI's reliable on-prem network reduces urgency |
| Multi-region failover | Only meaningful if LVPEI expands beyond Hyderabad |
| Cross-specialty replication (cardiology, neurology, etc.) | Phase 2 by client decision — ophthalmology pilot first |

**Key change from earlier doc versions:** the previous "36 deferred domains" list (cases, pearls, atlas, scoring, simulators, etc.) is no longer deferred — every one of those domains is now built in W6–W14 inline. This document used to defer them "after showcase"; the v1.2 update absorbs them into Phase 1.

---

## 3. The Phase 1 Timeline (full delivery, not just showcase)

```
┌──────────┬─────────┬─────────────────────────────────────────────────────┐
│ Week 0   │ ✅ done │ Schema lock (all 42 domains) + Docker compose       │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 1   │ ✅ done │ Real auth: NextAuth + invitations + Gmail SMTP      │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 2   │ ✅ done │ LiveKit live video + screen share + chat + admit    │
│          │         │ ★ MILESTONE 1: 2 users can have a live video call  │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 3   │ ✅ done │ Session Scheduling + Calendar + .ics + reminders   │
│          │         │ ★ MILESTONE 2: PD schedules → faculty approves →   │
│          │         │ residents see on calendar + .ics in Gmail           │
╠══════════╪═════════╪═════════════════════════════════════════════════════╣
║ Week 4   │ 4 weeks │ W4-SPRINT — 11 devs in 4 parallel streams           ║
║ -SPRINT  │ 11 devs │ Stream A: Recording (Egress → HLS → Vidstack) +     ║
║          │         │   Reels generator + Promo content generator         ║
║          │         │ Stream B: Transcription (dual provider, env gate) + ║
║          │         │   real-time live captions (LiveKit Agent)           ║
║          │         │ Stream C: Documents + AI classify + Smart           ║
║          │         │   Presentation Enhancement Studio                   ║
║          │         │ Stream D: Engagement signals foundation +           ║
║          │         │   Live Hooks + Presenter Alerts +                   ║
║          │         │   WhatsApp pearls + Live Leaderboards +             ║
║          │         │   Coach + Reflection bots + Bloom's analytics +     ║
║          │         │   Kirkpatrick L1+L2                                 ║
║          │         │ ★ MILESTONE 3: record + transcribe + playback +     ║
║          │         │ live captions + 15 of 22 Phase-1 features live      ║
╠══════════╪═════════╪═════════════════════════════════════════════════════╣
│ Week 5   │ 1 week  │ Q&A sidebar + Resources + Breakout rooms +          │
│          │ 3 devs  │ AI breakout grouping + Co-facilitator +             │
│          │         │ recording-share with audit + mobile polish          │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 6   │ 1 week  │ Cases + Conversations + Topics +                    │
│          │         │ Pre-Conference Question Submission Engine           │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 7   │ 1 week  │ Reviews + Journal + Challenges + Knowledge Atoms    │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 8   │ 1 week  │ Scoring + DOPS + Mini-CEX + EPA + Progress +        │
│          │         │ Kirkpatrick L3 (uses DOPS evidence)                 │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 9   │ 1 week  │ Pearls library + Atlas + Medical Reference          │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 10  │ 1 week  │ Simulators + Branching + Adaptive Baseline +        │
│          │         │ Live in-session simulation launch                   │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 11  │ 1 week  │ Competency Courses + Recommendations +              │
│          │         │ Readiness Predictor wired with engagement signals   │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 12  │ 1 week  │ Notifications full + global Search + Reports + CME  │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 13  │ 1 week  │ Content Ingestion + RAG + Training Queue +          │
│          │         │ Live in-session AI clinical assistant               │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 14  │ 1 week  │ Whiteboard sync + PDF export + Audit fill-gaps +    │
│          │         │ VCCE + Gamification + Webhooks + User Preferences   │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 15  │ 1 week  │ Polish, Phase-1 demo data seed, e2e rehearsal,      │
│          │         │ performance test, backup recording                  │
│          │         │ ★ SHOWCASE: Phase-1 production-ready demo           │
├──────────┼─────────┼─────────────────────────────────────────────────────┤
│ Week 16+ │ TBD     │ #7 Emotion Analytics — ships ONLY after LVPEI       │
│          │         │ ethics committee sign-off (calendar, not eng.)      │
└──────────┴─────────┴─────────────────────────────────────────────────────┘
```

**Total Phase 1: 19 calendar weeks** (W0–W3 done = 4 weeks elapsed; W4-Sprint = 4 weeks; W5–W15 = 11 weeks; W16+ = ethics-blocked).

**All 22 Phase-1 features (from [Feeddback.md](../Feeddback.md)) ship production-ready, not as prototypes.** The 36 mock-JSON stubs from the original Build Plan have been absorbed into specific weeks (W6–W14) — no domain stays mock-only at end of Phase 1.

**Change from v1.1:** Original plan ended at W6 with a 5-pillar showcase and 36 deferred domains. Client decision (2026-04-24) is to deliver **all 22 features from the original [Feeddback.md](../Feeddback.md) brief** as Phase 1, production-ready. W4 expanded to a 4-week sprint with 11 devs in 4 parallel streams to absorb 15 of 22 features. The remaining 7 features (which depend on infra that doesn't exist yet — breakouts, scoring data, simulators, RAG corpus, ethics approval) ship in W5–W14 as their prerequisites land. W15 = polish + Phase-1 production-ready showcase.

---

## 4. Week 0 — Schema Lock + Environment Setup

### Goal

Full `schema.prisma` with all 42 domains designed. One initial migration creates all tables (empty). Local environment fully running.

### Decision: Schema Lock Approach (approved)

Three approaches were evaluated. **Approach C was chosen.**

| Approach | Time | Risk | Benefit | Chosen? |
|---|---|---|---|---|
| **A. Lock nothing** — design tables ad-hoc per week as features are built | 0 upfront | **High** — refactoring when cross-domain FKs emerge; migration history becomes messy; inconsistent patterns across domains | Fastest start | ❌ |
| **B. Lock only video + auth tables** — design ~10 tables for showcase, rest later | 2 days | **Medium** — schema inconsistencies when other domains added; second migration creates design drift | Quick demo | ❌ |
| **C. Lock ALL 42 domains upfront** — full `schema.prisma` designed in Week 0, one initial migration | 5-7 days | **Low** — holistic design, clean migration history, no refactoring, no surprises | Foundation for entire Phase 1 build | ✅ |

### Why Approach C

1. **Cross-domain relationships need holistic design.** `scoring_events` has FK to `recordings`. `recommendations` references `courses`, `cases`, AND `pearls`. `audit_log` touches every domain. `documents` connect video, files, RAG, Deck Forge. Designing piecemeal creates inconsistencies that require painful refactoring.

2. **One clean migration = production-grade foundation.** Future developers read one `schema.prisma` file and understand the entire data model. Migration history stays clean (one initial migration vs dozens of ad-hoc ones). Rollback is simpler.

3. **Empty tables cost nothing.** PostgreSQL doesn't care if a table has 0 rows. Creating all 42 domains' tables now costs a few KB of metadata. Unused tables fill up as features are built — no migrations needed.

4. **Parallel work unblocks after Week 0.** Once schema is locked, multiple features can be built in parallel without schema conflicts. No one blocks on "can I add this column?"

5. **Documentation is automatic.** `schema.prisma` becomes the source of truth. Prisma auto-generates TypeScript types → zero documentation drift.

### What "Lock" Means (practical)

| What IS locked | What is NOT locked |
|---|---|
| Table names | Business logic in API handlers |
| Column names + types | Which tables have data |
| Primary keys + foreign keys | Seed data |
| Indexes (critical query paths) | Workflow states (can add enum values later) |
| Enum definitions | UI components |
| Relationship cardinalities (1:N, M:N) | API route paths |

If a genuine schema change is needed later (e.g., adding a column to `users`), it's a **normal Prisma migration** — not a refactor. "Lock" means **designed thoroughly, not frozen forever.**

### Schema Scope — Approximate Table Count

Developer produces **one file**: `prisma/schema.prisma` containing ~90 tables across all 42 domains.

| Tier | Tables (approx.) |
|---|---|
| Tier 0 (Auth + RBAC) | 8 |
| Tier 1 (Core Learner) | 12 |
| Tier 2 (Knowledge Library) | 8 |
| Tier 3 (Practice Tools) | 3 |
| Tier 4 (Assessment & Analytics) | 6 |
| Tier 5 (Teaching & Cohort + Documents) | 12 |
| Tier 6 (AI Pipeline) | 8 |
| Tier 7 (Pathways — Courses + Recommendations) | 7 |
| Tier 8 (User Profile) | 4 |
| Tier 9 (Cross-Cutting Infrastructure) | 10 |
| Tier 10 (Admin & Compliance) | 12 |
| Tier 11 (Phase 2 stubs) | 4 |
| **Total** | **~94 tables** |

### Schema Review Gate (before migration runs)

| Day | Step |
|---|---|
| 1-3 | Developer designs schema tier by tier |
| 4 | Developer self-review + lint (`prisma format` + `prisma validate`) |
| 5 | **Your walkthrough** — developer explains each tier's tables to you in plain English |
| 5 | Cross-reference against Approach / SLM / Video docs |
| 6 | Run migration: `npx prisma migrate dev --name initial_schema_v1` |
| 6 | Run seed: `npx prisma db seed` |
| 7 | Smoke test — query 5 tables, verify relations work |

Only after this gate passes does Week 1 (Auth) start.

### Deliverables

| # | Deliverable | Owner | Verification |
|---|---|---|---|
| 1 | Full `prisma/schema.prisma` (all 42 domains, ~80-100 tables) | Developer | Reviewed by you |
| 2 | Seed script (`prisma/seed.ts`) loading mock JSON into tables | Developer | `npx prisma db seed` runs clean |
| 3 | `docker-compose.dev.yml` with LiveKit + Redis + coturn + MinIO | Developer | `docker compose up` starts all 4 services |
| 4 | `.env.local` with all environment variables | Developer | Template committed as `.env.example` |
| 5 | `src/lib/db.ts` — Prisma singleton (copied from BusinessOS) | Developer | Query test passes |
| 6 | `src/lib/redis.ts` — Redis singleton | Developer | PING test passes |
| 7 | `src/lib/queue.ts` — BullMQ setup | Developer | Job enqueue/dequeue test passes |
| 8 | `src/lib/storage.ts` — MinIO client | Developer | Upload + download test passes |
| 9 | `src/lib/livekit.ts` — LiveKit Server SDK wrapper | Developer | Room create + token generate test |
| 10 | Data directory setup on E: drive | You + Developer | `E:\vaidix-data\*` folders exist |

### Environment Variables (`.env.local`)

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/vaidix

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate 64-char hex — use `openssl rand -hex 32`>

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your.vaidix@gmail.com>
EMAIL_PASSWORD=<Gmail App Password — NOT your Google password>
EMAIL_FROM="Vaidix <your.vaidix@gmail.com>"

# LiveKit (local Docker)
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=<LiveKit generates — copy from livekit.yaml>
LIVEKIT_API_SECRET=<LiveKit generates>

# MinIO (local S3)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=vaidix-video
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Existing AI APIs (keep for now)
GEMINI_API_KEY=<your existing key>
GEMINI_MODEL=gemini-2.5-flash
SARVAM_API_KEY=<your existing key>
SARVAM_STT_MODEL=saaras:v3

# File upload limits
MAX_UPLOAD_SIZE_MB=500
```

### Docker Compose (`docker-compose.dev.yml`)

```yaml
version: '3.8'

services:
  livekit:
    image: livekit/livekit-server:latest
    command: --config /livekit.yaml
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    volumes:
      - ./livekit.yaml:/livekit.yaml
      - E:/vaidix-data/livekit-data:/data
    restart: unless-stopped

  livekit-egress:
    image: livekit/egress:latest
    environment:
      EGRESS_CONFIG_FILE: /egress.yaml
    volumes:
      - ./egress.yaml:/egress.yaml
      - E:/vaidix-data/recordings/raw:/output
    restart: unless-stopped
    depends_on:
      - livekit
      - redis

  redis:
    image: redis:8-alpine
    ports:
      - "6379:6379"
    volumes:
      - E:/vaidix-data/redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

  coturn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "5349:5349"
    volumes:
      - ./turnserver.conf:/etc/turnserver.conf
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - E:/vaidix-data/minio-data:/data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    restart: unless-stopped
```

### Data Directory Layout (E: drive)

```
E:\vaidix-data\
├── livekit-data\          ← LiveKit state
├── redis-data\            ← Redis persistence
├── recordings\
│   ├── raw\               ← LiveKit Egress writes MP4s here
│   ├── hls\               ← Transcoded HLS (served via MinIO)
│   ├── clips\             ← Generated clips
│   └── captions\          ← VTT subtitle files
├── minio-data\            ← MinIO object storage
└── documents\             ← Faculty document uploads
    ├── raw\               ← Original uploaded files
    └── processed\         ← Deck Forge polished outputs
```

### Success Criteria (Week 0)

- [ ] `npx prisma migrate dev` creates all tables without errors
- [ ] `npx prisma db seed` loads mock data into tables
- [ ] `docker compose up` starts all 4 services (livekit, redis, coturn, minio)
- [ ] All services respond to health checks
- [ ] MinIO console accessible at http://localhost:9001
- [ ] LiveKit API reachable at ws://localhost:7880
- [ ] Next.js dev server runs without errors

---

## 5. Week 1 — Real Auth + User Management

### Goal

Real login with invitation-based registration. No more demo users.

### Deliverables

| # | Feature | API Routes | UI Pages |
|---|---|---|---|
| 1 | NextAuth.js + Prisma adapter | `/api/auth/[...nextauth]` | — |
| 2 | Login page wired to NextAuth | `/api/auth/session` | `/login` (exists, update) |
| 3 | Admin invitation creation | `/api/invitations` POST | `/admin/invitations/new` |
| 4 | Pending invitations list | `/api/users/pending` GET | `/admin/users/pending` |
| 5 | Accept invitation + set password | `/api/invitations/[token]/accept` | `/invitations/[token]` |
| 6 | Forgot password | `/api/auth/forgot-password` | `/forgot-password` |
| 7 | Reset password | `/api/auth/reset-password` | `/reset-password` |
| 8 | Change password (logged in) | `/api/auth/change-password` | `/profile/security` |
| 9 | Role-based middleware | `middleware.ts` | — |
| 10 | Session + user context | `useSession()` + RoleContext | — |
| 11 | Gmail SMTP integration | — | — |
| 12 | Remove demo users from login page | — | Update `/login` |
| 13 | Admin user management | `/api/admin/users` | `/admin/users`, `/admin/users/[id]` |

### Email Templates

All sent via Nodemailer + Gmail SMTP:

| Template | Triggered When |
|---|---|
| Invitation email | Admin creates invitation |
| Invitation accepted confirmation | User accepts invitation |
| Password reset link | User clicks "Forgot password" |
| Password changed confirmation | Password successfully changed |
| Account suspended | Admin suspends user |

### Security Baked In

- bcrypt 12 rounds for password hashing
- Rate limiting: 5 failed logins / 15-min window per IP+email
- Invitation token: SHA-256 hashed in DB, 7-day expiry
- Reset token: SHA-256 hashed, 1-hour expiry
- HTTP-only Secure SameSite=Strict cookies
- CSRF protection on state-changing routes
- Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
- Password change invalidates all existing sessions

### Seed Users (for testing)

```typescript
// prisma/seed.ts — create ONE admin to bootstrap
{
  email: "admin@lvpei.org",
  password: <hashed>,
  name: "LVPEI Admin",
  role: "admin",
  status: "approved",
  email_verified: true
}
```

The admin then invites everyone else through the real flow.

### Success Criteria (Week 1)

- [ ] Admin can log in with real password
- [ ] Admin invites a faculty member → email arrives in Gmail → link works
- [ ] Faculty accepts invitation, sets password, logs in
- [ ] Faculty invites a resident → same flow
- [ ] Forgot password flow works end-to-end (reset link arrives, new password works)
- [ ] Protected routes redirect unauthenticated users to `/login`
- [ ] Role-based access works (resident can't access `/admin/*`)
- [ ] All 4 demo buttons removed from login page
- [ ] Password change invalidates existing session

---

## 6. Week 2 — LiveKit Live Video

### Goal

Faculty and residents can join a live video session.

### Deliverables

| # | Feature | API Routes | UI Pages |
|---|---|---|---|
| 1 | LiveKit token generation with role | `/api/classroom/token` | — |
| 2 | Session creation (faculty) | `/api/classroom/sessions` POST | `/classroom/new` |
| 3 | Session list | `/api/classroom/sessions` GET | `/classroom` (update) |
| 4 | Live session room | — | `/classroom/[id]` (new) |
| 5 | LiveKit React components integration | — | Custom `<LiveSession>` component |
| 6 | Screen sharing | LiveKit built-in | — |
| 7 | Live chat (data channels) | LiveKit built-in | — |
| 8 | Hand raise | LiveKit built-in | — |
| 9 | Faculty controls (mute all, kick) | LiveKit Server SDK | Faculty UI panel |
| 10 | Participant list | LiveKit built-in | Sidebar |
| 11 | Session start/end tracking | `/api/classroom/sessions/[id]` PATCH | Auto |

### Role Permissions Matrix

| Role | Can publish video/audio | Can share screen | Can mute others | Can remove participant | Can end session |
|---|---|---|---|---|---|
| Faculty (host) | Yes | Yes | Yes | Yes | Yes |
| Resident (participant) | Yes | No (permission-based) | No | No | No |
| Observer | No (view only) | No | No | No | No |

Permissions encoded in LiveKit token metadata.

### UI Sketch — `/classroom/[id]`

```
┌───────────────────────────────────────────────┬────────────┐
│                                               │ Participants│
│                                               │  [12]      │
│         [Main video grid — WebRTC]            │             │
│         Faculty + active speakers             │ Dr. P (F)   │
│                                               │ Priya R (R) │
│                                               │ Rohan D (R) │
│                                               │ ...         │
├───────────────────────────────────────────────┤             │
│ [🎤] [📹] [🖥️ Share] [✋ Raise] [💬 Chat]   │             │
│ [⚙️ Faculty controls ▼ — mute all, end]      │             │
└───────────────────────────────────────────────┴────────────┘
```

### Success Criteria (Week 2)

- [ ] Faculty creates a session (title, scheduled time)
- [ ] Faculty joins session, sees self-video
- [ ] Resident joins same session, both see each other's video
- [ ] Screen share works
- [ ] Live chat works
- [ ] Hand raise works
- [ ] Faculty can mute a participant
- [ ] Faculty can remove a participant
- [ ] Session end is tracked in database

---

## 7. Week 3 — Session Scheduling & Calendar

### Goal

Program Director schedules a class → faculty approves → session appears on attendee calendars (Vaidix UI + Google/Outlook via `.ics`). Recurring sessions supported. Cohort-scoped visibility.

### Why This Week Exists

Without scheduling, a Program Director would have to Slack each faculty to confirm time, manually track who accepted, and email residents individually. That doesn't scale past one session. This week adds the approval workflow + calendar that LVPEI will actually use day-to-day.

### Deliverables

| # | Feature | API Routes | UI Pages |
|---|---|---|---|
| 1 | Cohort management | `/api/cohorts`, `/api/cohorts/[id]/members` | `/admin/cohorts` |
| 2 | PD schedules a session (draft + submit) | `POST /api/classroom/sessions` (w/ visibility, cohort, invites, RRULE) | `/calendar/new` |
| 3 | Faculty approval inbox | `POST /api/classroom/sessions/[id]/approve`, `/reject` | `/inbox/approvals` |
| 4 | Auto-approve when PD is also host | `session-service.createSession` | — |
| 5 | Calendar feed (role-scoped) | `GET /api/calendar/events?from=...&to=...` | — |
| 6 | Calendar UI (month/week/day/agenda) | — | `/calendar` |
| 7 | Session detail drawer (from calendar click) | `GET /api/classroom/sessions/[id]` | Modal in `/calendar` |
| 8 | Reschedule flow (re-triggers approval) | `POST /api/classroom/sessions/[id]/reschedule` | Form in detail drawer |
| 9 | Cancel flow | `DELETE /api/classroom/sessions/[id]` | Button in detail drawer |
| 10 | Conflict detection (app + Postgres) | Exclusion constraint + app check | Warning banner on form |
| 11 | Recurrence (RFC 5545 RRULE) | `rrule` npm package, server-side expansion | Form picker in `/calendar/new` |
| 12 | `.ics` export per session | `GET /api/classroom/sessions/[id]/ics` | Download button + email attachment |
| 13 | Subscribable iCal feed per user | `GET /api/calendar/ics/user/[userId]?token=...` | "Subscribe in Google Calendar" button on `/profile` |
| 14 | Notification emails (proposed/approved/rejected/rescheduled/cancelled) | Reuse Week 1 Nodemailer + `Notification` model | — |
| 15 | Reminder jobs (24h + 15min) | BullMQ `reminder` queue | Cron via `queue.ts` |
| 16 | Invite management for INVITE_ONLY sessions | `POST / DELETE /api/classroom/sessions/[id]/invites` | Multi-select in form |

### Visibility Rules

| Visibility | Who sees on calendar |
|---|---|
| `OPEN_TO_ALL` | All residents + faculty in institution |
| `COHORT` | Members of the selected `Cohort` |
| `INVITE_ONLY` | Users in `SessionInvite` list |
| `PRIVATE` | Host + proposing PD only |

Enforced in `/api/calendar/events` via Prisma `where` clause — never trust the client.

### Approval State Machine

```
DRAFT ──(PD submits)──► PENDING_FACULTY ──(faculty accepts)──► APPROVED ──(session happens)──► LIVE → COMPLETED
  │                           │                                    │
  │                           └──(faculty rejects)───► REJECTED ───┘
  │                                                                │
  └──(PD cancels before submit)──► CANCELLED                       │
                                                                   │
PD-self-hosts special case: proposedBy == hostId ──► auto-APPROVED │
                                                                   │
Reschedule: APPROVED ──(PD reschedules)──► PENDING_FACULTY (loop) ─┘
```

### Tech Stack (new this week)

| Library | License | Role |
|---|---|---|
| [`rrule`](https://github.com/jakubroztocil/rrule) | MIT | RFC 5545 recurrence generation + expansion |
| [`ics`](https://github.com/adamgibbons/ics) | MIT | `.ics` file generation for email attachment |
| [`react-big-calendar`](https://github.com/jquense/react-big-calendar) | MIT | Calendar UI (month/week/day/agenda views) |
| `btree_gist` Postgres extension | PostgreSQL license | Exclusion constraint for race-free conflict check |

### Schema Additions (see prisma/schema.prisma migration)

**Extended `TeachingSession`:** `approvalStatus`, `proposedBy`, `approvedBy`, `approvedAt`, `rejectedReason`, `visibility`, `cohortId`, `recurrenceRule`, `recurrenceUntil`, `parentSessionId`.

**New models:** `Cohort`, `CohortMember`, `SessionInvite`, `SessionApprovalAudit`.

**New enums:** `SessionApprovalStatus`, `SessionVisibility`.

### Success Criteria (Week 3)

- [ ] PD creates cohort "2026 Retina Fellows" with 8 residents
- [ ] PD drafts session, picks faculty Dr. X, 2026-04-20 10:00–11:00, visibility = COHORT
- [ ] Dr. X receives email + in-app notification within 60 seconds
- [ ] Dr. X sees session in `/inbox/approvals` with Accept/Decline buttons
- [ ] On Accept: PD receives confirmation email; session now has `status = APPROVED`; audit log has entry
- [ ] All 8 residents see the session on their `/calendar` (month + week + day views)
- [ ] Residents NOT in the cohort do NOT see the session
- [ ] Each resident receives an email with `.ics` attachment that opens in Google Calendar / Outlook / Apple Calendar
- [ ] 24h before session: email reminder to all 8 residents
- [ ] 15min before session: in-app notification to all 8 residents
- [ ] Recurring session: PD picks "Every Monday for 8 weeks" → 8 occurrences show on calendar
- [ ] Conflict: PD tries to schedule Dr. X for 10:30–11:30 same day → form shows "Dr. X has Grand Rounds 10:00–11:00 — cannot double-book" and server returns 409
- [ ] Reschedule: PD moves session to 11:00–12:00 → status goes back to PENDING_FACULTY, Dr. X re-notified, all attendees receive updated `.ics`
- [ ] PD is faculty: PD creates session with `hostId = self` → auto-approved, skips PENDING_FACULTY

### Days (within this week)

| Day | Focus |
|---|---|
| 1 | Schema migration + `rrule`/`ics` install + services (`session-service`, `cohort-service`, `calendar-service`) |
| 2 | APIs: sessions CRUD, approve/reject, calendar events feed, cohorts CRUD |
| 3 | `/calendar` page with react-big-calendar, event styling by status, role-based filter |
| 4 | `/calendar/new` form (faculty picker, datetime, cohort/invite selector, RRULE picker), session detail drawer |
| 5 | `/inbox/approvals` faculty page, notification emails + templates + `.ics` attachments |
| 6 | BullMQ reminder jobs (24h + 15min), iCal subscribable feed, timezone handling |
| 7 | Polish + e2e script (`scripts/e2e-w3.ts`), buffer |

---

## 8. W4-Sprint — Recording + Transcription + Documents + Live Engagement Foundation

### Scope

**4 calendar weeks. 11 developers. 4 parallel streams. 15 of 22 Phase-1 features ship production-ready.**

Original W4 (1 week, 1 dev, 3 deliverables) is replaced by this sprint. The expansion is driven by the client decision (2026-04-24) to deliver all 22 features from the original [Feeddback.md](../Feeddback.md) brief as Phase 1 — not a 5-pillar showcase. W4-Sprint absorbs everything that can be parallelized; the remaining 7 features ship in W5–W14 as their prerequisites land.

### Why 4 weeks, not 1

22 production-ready features × ~8 person-days each (DB migration + API + UI + auth/audit/rate-limit + tests + edge cases + code review + security pass) = ~176 person-days. 11 devs × 4 weeks × 5 working days = 220 person-days. Buffer: ~44 person-days for integration, code review, blocked-task slack, integration tests. **No buffer means slip.** This sizing is the math, not optimism.

### Team & coordination

| Role | Count | Owns |
|---|---|---|
| Tech lead (existing) | 1 | Schema migrations (single owner — no parallel migrations), code review across streams, daily standup, integration tests |
| Stream A leads (Recording & Media) | 1 | Stream A backlog + cross-stream interface contracts |
| Stream A devs | 2 | Implementation |
| Stream B leads (Transcription & Live Captions) | 1 | Stream B backlog + provider interface |
| Stream B devs | 2 | Implementation |
| Stream C leads (Documents & Presentation AI) | 1 | Stream C backlog + AI prompt engineering |
| Stream C devs | 2 | Implementation |
| Stream D leads (Engagement & Out-of-band) | 1 | Stream D backlog + WhatsApp integration |
| Stream D dev | 1 | Implementation |

**Coordination rules (binding):**

1. **All Prisma migrations go through the tech lead.** No parallel migrations on the same model. Each stream files migration requests in a queue; lead applies them sequentially in `main`.
2. **Daily 15-min stand-up** across all 11 devs (cross-stream blockers surface here).
3. **One PR queue per stream** in GitHub. Lead reviews intra-stream; tech lead reviews cross-stream.
4. **Per-stream e2e script** in `scripts/e2e-w4-stream-{a,b,c,d}.ts`. Must pass before a feature is marked done.
5. **No god-endpoints.** Every feature gets its own route file under one of the existing `/api/*` namespaces (see §8.6).
6. **Production-ready bar enforced via PR template** — covers tests, audit hook, rate limit (where applicable), error paths, security review checkbox.

### Stream A — Recording & Media (3 devs, 4 weeks)

| # | Feature | Tables | API | UI |
|---|---|---|---|---|
| A1 | LiveKit Egress auto-records | `Recording` (exists), `RecordingStageEvent` (exists) | extend `/api/classroom/webhooks/livekit` for Egress events | — |
| A2 | BullMQ `transcode` worker | reuses `Recording`, new `JobRecord` rows | — | — |
| A3 | FFmpeg MP4 → HLS multi-bitrate (1080p/720p/480p/360p/240p) | — | — | — |
| A4 | MinIO HLS storage layout | — | — | — |
| A5 | Vidstack recording playback page | reuses `Recording` | `GET /api/classroom/sessions/[id]/recordings` | `/classroom/[id]/recording` |
| A6 | Multi-language caption toggle (consumes Stream B output) | reuses `Transcript` (exists) | `GET /api/classroom/sessions/[id]/transcripts` | Caption picker on Vidstack |
| A7 | Chapter markers from AI summary | reuses `Recording.metadata` | — | Vidstack chapters |
| A8 | **#10 Instagram Reels Auto-Creation** | reuses `Clip` (exists), add `kind=reel` value | `POST /api/classroom/sessions/[id]/reels`, `GET /clips?kind=reel` | Reel browser + share-to-IG copy link |
| A9 | **#1 AI Promo Content Generator** | reuses `Document` with `kind=promo_asset` value | `POST /api/promo/generate`, `GET /api/promo/list` | `/faculty/promo` page (flyer / teaser / WhatsApp banner / IG card) |

**Recording state machine** (lives in `Recording.status` enum, already in schema):
```
RECORDING → TRANSCODING → TRANSCRIBING → AI_PROCESSING → READY
  (live)     (FFmpeg)      (Stream B)     (Stream B)      (playable)
```

### Stream B — Transcription & Live Captions (3 devs, 4 weeks)

| # | Feature | Tables | API | UI |
|---|---|---|---|---|
| B1 | `TranscriptionProvider` interface | — | — | — |
| B2 | `sarvam-provider` implementation | — | — | — |
| B3 | `self-hosted-provider` implementation (calls Python worker via internal HTTP) | — | — | — |
| B4 | Production env gate in `src/lib/env.ts` | — | — | — |
| B5 | BullMQ `transcribe` worker | reuses `Transcript` (exists) | — | — |
| B6 | Audio extraction (FFmpeg) | — | — | — |
| B7 | Speaker diarization (pyannote — self-hosted only; Sarvam returns its own diarization) | reuses `Transcript.metadata` | — | — |
| B8 | VTT generation (original lang + English translation) | reuses `Transcript` | — | — |
| B9 | **#14 Real-time live captions** (LiveKit Agent) | new `LiveCaptionSegment` (transient via Redis preferred; persist only if recording opt-in) | SSE stream `/api/classroom/sessions/[id]/live-captions` | Vidstack overlay during live session |

**Transcription provider strategy (binding — overrides any earlier doc):**

| Phase | Provider | Where it runs |
|---|---|---|
| W4-Sprint, showcase, early testing | `sarvam` Sarvam Saaras API | External SaaS — synthetic / consented data only |
| LVPEI production | `self_hosted` Faster-Whisper + IndicConformer + pyannote | LVPEI on-prem GPU |

**Implementation contract:**

1. `TranscriptionProvider` interface in `src/server/services/transcription/transcription-provider.ts`. Two implementations: `sarvam-provider.ts`, `self-hosted-provider.ts`. Selector reads `TRANSCRIPTION_PROVIDER` env var.
2. The `transcribe` BullMQ worker calls `getTranscriptionProvider().transcribe(...)` and never knows which one ran.
3. **Production env gate** in `src/lib/env.ts`: if `NODE_ENV=production` AND `SARVAM_API_KEY` is set, the app **refuses to boot**. Prevents a misconfigured deploy from silently routing patient audio to Sarvam.
4. Switching at LVPEI = remove `SARVAM_API_KEY` from prod env + set `TRANSCRIPTION_PROVIDER=self_hosted` + restart. No code change.
5. Sarvam adapter stays in the repo for dev laptops without GPU. The env gate keeps it dormant in production.

### Stream C — Documents & Presentation AI (3 devs, 4 weeks)

| # | Feature | Tables | API | UI |
|---|---|---|---|---|
| C1 | Document upload (500 MB) | reuses `Document` (exists) | `POST /api/documents` | Upload modal |
| C2 | MinIO storage with per-document signed URLs | — | `GET /api/documents/[id]/url` | — |
| C3 | AI classification (Gemini in Phase A; swap to Vaidix Core in Phase B) | reuses `Document.kind` enum | `POST /api/documents/[id]/classify` | Classification suggestion UI |
| C4 | Faculty approval / override of classification | — | `POST /api/documents/[id]/approve` | Approve/override |
| C5 | PHI/PII sanitizer (Microsoft Presidio) for case-notes uploads | new `PhiScanResult` (exists in schema) | runs inside C3 worker | Auto-redact preview |
| C6 | Faculty document library page | reuses `Document`, `DocumentTag` (exists) | `GET /api/documents` | `/faculty/documents` |
| C7 | Tag document to session | reuses `DocumentSessionLink` (exists) | `POST /api/documents/[id]/tag-session` | Session detail picker |
| C8 | Resources section on recording page (consumes C7) | — | reuses C7 endpoint | `/classroom/[id]/recording` resources tab |
| C9 | Document visibility state machine (`private_faculty` ↔ `public_with_session`) | reuses `Document.status` (exists) | `PATCH /api/documents/[id]/visibility` | Visibility toggle |
| C10 | **#15 Smart Presentation Enhancement Studio** — readability score, slide density, visual balance, interaction points | reuses `DeckForgeJob` (exists) — extend `analysisResult` JSON column | `POST /api/documents/[id]/analyze` | Per-slide analysis panel + suggestion list |

**Classification routing:**

| Category | Routing |
|---|---|
| `ppt_to_polish` | → Stream C10 analysis pipeline → Deck Forge polish (later week) |
| `reference` | → Store, taggable to sessions |
| `case_notes` | → PHI scan + store |
| `surgical_video` | → Stream A video pipeline |
| `image` | → Image library (W9) |
| `paper`, `guideline` | → Store + offer RAG index (W13) |
| `other` | → Generic file |

### Stream D — Engagement & Out-of-band (2 devs + lead, 4 weeks)

| # | Feature | Tables | API | UI |
|---|---|---|---|---|
| D1 | **#22 Engagement signals foundation** (the schema other live-AI features depend on) | new `EngagementSignal` (per-participant time-series: signal_type, value, ts, sessionId, userId) | internal — not exposed | — |
| D2 | **#4 Live Hooks Engine** — auto-injects polls / T-F / dilemma every 6–8 min | new `LiveHook`, `LiveHookResponse` | `POST /api/classroom/sessions/[id]/hooks`, `POST /[hookId]/respond`, SSE for delivery | Hook overlay during live session + response collector |
| D3 | **#5 Presenter Cognitive Alerts** — private "engagement low" prompts | new `PresenterAlert` (alert log) | SSE stream `/api/classroom/sessions/[id]/presenter-alerts` (presenter-only) | HUD widget on presenter screen, hidden from learners |
| D4 | **#9 WhatsApp Pearl Delivery Engine** — 3 pearls/day, 24h/72h/7d spaced | reuses `Notification`, `NotificationPreference`, `NotificationChannel` (add `WHATSAPP` value) | `POST /api/notifications/whatsapp/send`, scheduled BullMQ job | Faculty config: spaced-repetition cadence; learner consent toggle |
| D5 | **#17 Live Leaderboards** (with anonymous toggle) | reuses `GamificationPoint` (exists), `SessionParticipant` | `GET /api/classroom/sessions/[id]/leaderboard` + SSE | Live leaderboard panel + anonymous mode |
| D6 | **#19 Teaching Bot Reinforcement Coach** | reuses `Conversation`, `Message`, `Pearl`, `Case` (all exist) | `POST /api/learners/[id]/coach`, `GET /api/learners/[id]/coach/conversations` | Coach chat UI in learner dashboard |
| D7 | **#20 Reflective Learning Bot prompts** | reuses `JournalEntry` (exists) — extend with `promptType` enum + `prompted=true` field | `POST /api/journal/prompted`, `GET /api/journal/prompts` | Prompted reflection in journal flow |
| D8 | **#21 Bloom's Taxonomy Analytics Engine** (depth tracking over time) | reuses `Pearl.bloomsLevel`, `Case.bloomsLevel`, `ScoringEvent` | `GET /api/learners/[id]/blooms-progression` | Bloom's depth chart in `/progress` |
| D9 | **#11 Kirkpatrick L1 + L2** (Reaction + Learning; L3 ships W8 with DOPS) | new `KirkpatrickEvaluation`, `KirkpatrickEvidence` | `POST /api/learners/[id]/kirkpatrick`, L1-survey endpoint | Post-session survey + L2 from quiz scores |
| D10 | **#3 Readiness Predictor** (data layer only — UI lands W11) | reuses `EngagementSignal` from D1 | `GET /api/classroom/sessions/[id]/readiness` (returns signal aggregates) | data only this sprint; UI in W11 with course data |

### Production env gates (apply across all streams)

`src/lib/env.ts` boot assertions — failure to satisfy = refuse to start:

```ts
if (process.env.NODE_ENV === 'production') {
  if (process.env.SARVAM_API_KEY) throw new Error('Production refuses to boot with SARVAM_API_KEY set')
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 64) throw new Error(...)
  if (process.env.DATABASE_URL?.includes('localhost')) throw new Error(...)
  // Phase B (post-Vaidix Core launch): also assert no GEMINI_API_KEY
}
```

### Cross-stream interface contracts (locked Day 1 of W4-Sprint)

To prevent integration hell at Week 4, the following interfaces are designed and stubbed on Day 1; implementations follow:

| Interface | Producer | Consumer |
|---|---|---|
| `TranscriptionProvider` | Stream B | Stream A (caption toggle), Stream D (D6 coach RAG) |
| `EngagementSignal` write API | Stream A (recording events), Stream D (hook responses) | Stream D (D3 alerts, D10 readiness) |
| Notification dispatch | Stream D (D4 WhatsApp) | Future weeks (W12 full notifications) |
| `Document.kind` enum extension | Stream C | Stream A (A9 promo as document), W14 (audit) |

### W4-Sprint API namespace summary

All routes under existing namespaces (no god-endpoint, no new top-level prefixes):

| Namespace | Routes added in W4-Sprint |
|---|---|
| `/api/classroom/sessions/[id]/*` | `recordings`, `transcripts`, `live-captions` (SSE), `hooks` + `[hookId]/respond`, `presenter-alerts` (SSE), `leaderboard` + SSE, `reels`, `readiness` |
| `/api/documents/*` | `[id]`, `[id]/classify`, `[id]/approve`, `[id]/url`, `[id]/tag-session`, `[id]/visibility`, `[id]/analyze` |
| `/api/learners/[id]/*` | `coach`, `coach/conversations`, `kirkpatrick`, `blooms-progression` |
| `/api/notifications/*` | `whatsapp/send` |
| `/api/promo/*` | `generate`, `list` |
| `/api/journal/*` | `prompted`, `prompts` |

**Total new route files: ~22, distributed across 6 existing namespaces. No endpoint takes a `command` parameter; every endpoint is REST-shaped.**

### Success Criteria (W4-Sprint, end of week 4)

**Stream A (Recording & Media):**
- [ ] Session recording auto-starts when faculty joins
- [ ] Recording transcoded to HLS within 10 min of session end
- [ ] Vidstack player loads recording with adaptive bitrate
- [ ] Faculty generates 30-sec reel from a recording, downloads MP4
- [ ] Faculty generates promo flyer from a session — gets PDF + WhatsApp banner + IG card

**Stream B (Transcription):**
- [ ] `TranscriptionProvider` selectable via env var; `sarvam` provider runs in dev
- [ ] Production env gate refuses to start with `SARVAM_API_KEY` and `NODE_ENV=production`
- [ ] VTT captions toggle in player (original + English) — Sarvam-transcribed
- [ ] Live caption SSE stream produces text within 10 sec of speech during a live session

**Stream C (Documents & Presentation AI):**
- [ ] Faculty uploads PPT — AI classifies as `ppt_to_polish` — analysis returns readability score, slide density, visual balance, suggested interaction points
- [ ] Faculty uploads PDF reference — classified, tagged to session, appears in Resources tab on recording page
- [ ] Faculty uploads case notes — Presidio PHI scan flags PHI; faculty reviews redactions before save
- [ ] Faculty document library lists all uploads with classification + visibility

**Stream D (Engagement & Out-of-band):**
- [ ] During live session: live hook (T/F or poll) auto-fires every 6–8 min based on `LiveHook.intervalSeconds`
- [ ] Presenter sees private "engagement low" alert when `EngagementSignal` aggregates cross threshold (no learner sees it)
- [ ] Faculty configures WhatsApp pearl delivery — resident receives 3 pearls/day at 24h/72h/7d cadence
- [ ] Live leaderboard updates within 2 sec of quiz/poll response (anonymous mode toggleable)
- [ ] Learner asks coach "explain DR again" — gets explanation + follow-up quiz + relevant case
- [ ] Resident submits L1 reaction survey post-session; system computes L2 from quiz scores
- [ ] Bloom's progression chart loads in /progress

**Cross-stream:**
- [ ] All 4 stream e2e scripts pass (`npm run e2e:w4-stream-a`, `-b`, `-c`, `-d`)
- [ ] Tech-lead-run integration test exercises a full session lifecycle (schedule → live → record → transcribe → reel → coach interaction → spaced WhatsApp pearl → L1 survey)
- [ ] No god-endpoint introduced; PR review confirms each new route file is REST-shaped
- [ ] All endpoints write `AuditEvent` for state-changing actions
- [ ] Security review pass: no PHI flowing to external services in production env (env gate verified)

---

## 9. Week 5 — Q&A + Resources + Breakouts (with AI grouping + co-facilitator)

### Goal

Timestamped Q&A on recordings, faculty Resources tab, AI-grouped breakouts with in-breakout co-facilitator agent. Polish moved to W15 (now-final-Phase-1-week).

**Team:** back to ~3 devs after W4-Sprint demobilization. (The W4-Sprint hires can stay if budget allows — they'd compress W5–W15 substantially. Default assumption: they roll off after W4.)

### Deliverables — Q&A

| # | Feature | API | UI |
|---|---|---|---|
| 1 | Post Q at current timestamp | `/api/classroom/[id]/qa` POST | Sidebar "Add question" button |
| 2 | List Q&A by timestamp | `/api/classroom/[id]/qa` GET | Sidebar list |
| 3 | Reply to Q&A (single level) | `/api/classroom/[id]/qa/[commentId]/reply` | Reply form |
| 4 | Like a Q&A | `/api/classroom/[id]/likes` POST | Heart button |
| 5 | Faculty pin a Q&A | `/api/classroom/[id]/qa/[commentId]/pin` | Pin button |
| 6 | Click timestamp → seek video | Vidstack `currentTime` | Click handler |

V1 = sidebar list (no timeline markers). Timeline markers = V2 post-showcase.

### Deliverables — Resources Section

Below the video player on `/classroom/[id]/recording`:

```
┌──────────────────────────────────────────────────────────┐
│            [ Vidstack Video Player ]                     │
└──────────────────────────────────────────────────────────┘
[ Transcript ▼ ]     [ Resources ▼ ]     [ Q&A ▼ ]

━━━ RESOURCES FROM THIS LECTURE ━━━
┌──────────────────────────────────────────────────────────┐
│ 📊 Polished Deck: "PDR Management Algorithm"  [View]     │
│    Generated from Dr. Pathengay's notes                  │
│    Uploaded: pre_session · Downloaded: 12 times          │
│                                                          │
│ 📄 Reference: "Diabetic Retinopathy Guidelines 2026"     │
│    Uploaded by Dr. Pathengay          [Download]         │
│                                                          │
│ 📝 Case notes: "Mrs. Lakshmi's case" [View]              │
│    De-identified per DPDPA · PHI sanitized               │
└──────────────────────────────────────────────────────────┘
```

### Deliverables — Breakout Rooms (with AI grouping + co-facilitator)

| # | Feature | Detail |
|---|---|---|
| 1 | Faculty starts breakout | Modal: random / self-select / **AI auto-group (#13)** |
| 2 | **#13 AI auto-grouping** | Algorithm clusters by `User.role`, recent `ScoringEvent` performance, session participation history. Output: N balanced groups. No new tables — derived from existing data. |
| 3 | LiveKit child rooms | Created via Server SDK |
| 4 | Participants moved via new tokens | UI transitions smoothly |
| 5 | Breakout chat persists per room | Each breakout has its own chat |
| 6 | **#6 AI Discussion Co-Facilitator** | LiveKit Agent joins each breakout room. Summarizes discussion, prompts silent participants, asks probing questions. New table: `BreakoutAgentLog` (per-breakout summaries + interventions). |
| 7 | Reconvene button | All participants moved back to main room |
| 8 | No breakout recording | Only main room is recorded |

### Deliverables — Share Links

| # | Feature | Detail |
|---|---|---|
| 1 | Create share link | `/api/classroom/[id]/share` — expiry 7 days default |
| 2 | Optional password protect | Hashed password in DB |
| 3 | Track access | Every access logged to audit_log |
| 4 | Revoke before expiry | Admin/faculty action |

### Deliverables — Polish

- Responsive layout on mobile
- Dark mode consistent
- Loading states on all async operations
- Error boundaries on every page
- Toast notifications for actions (Sonner)
- Empty states designed (no recordings, no Q&A, etc.)
- Keyboard shortcuts in video player

### Success Criteria (Week 4)

- [ ] Resident posts a Q at 12:34 timestamp
- [ ] Click the timestamp → video jumps to 12:34
- [ ] Faculty replies to the question
- [ ] Faculty pins an important answer
- [ ] Likes count updates in real-time
- [ ] Resources section shows all tagged documents
- [ ] Documents downloadable with audit trail
- [ ] Breakout rooms: faculty creates 3 rooms, 6 participants randomly split
- [ ] Breakout chat works within each room
- [ ] Reconvene moves everyone back
- [ ] Share link works, expires after 7 days
- [ ] Mobile layout clean on phone

---

## 10. Week 6 — Cases + Conversations + Topics + Pre-Conference Q&A Engine

### Goal

Wire the full case engine: cases as full chat conversations, topic taxonomy, and the Pre-Conference Question Submission Engine (Feeddback #2) for residents to submit/vote on questions before live sessions.

### Deliverables

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Cases full chat engine | `Case`, `CaseStageHistory`, `Conversation`, `Message`, `ScoringEvent` (all exist) | `/api/cases/[id]/conversations`, `/messages` |
| 2 | Topics taxonomy | `Topic`, `Level`, `UserLevelProgress` (exist) | `/api/topics`, `/api/topics/[id]` |
| 3 | **#2 Pre-Conference Question Submission Engine** | new `PreSessionQuestion`, `PreSessionQuestionVote`, `PreSessionQuestionTheme` | `/api/classroom/sessions/[id]/pre-questions` (POST/GET), `/[qid]/vote` (POST), `/themes` (GET) |
| 4 | AI question clustering into themes | uses Gemini in Phase A | runs in BullMQ on submission |
| 5 | Presenter pre-session dashboard ("top 10 anticipated learner concerns") | derived from #3+#4 | `/api/classroom/sessions/[id]/pre-questions/dashboard` |

### Success Criteria
- [ ] Resident submits pre-session question + upvotes 2 others
- [ ] AI clusters submitted questions into themes within 30 sec
- [ ] Presenter sees top 10 themes on session dashboard before session starts
- [ ] Cases load full conversation history with scoring events

---

## 10a. Week 7 — Reviews + Journal + Challenges + Knowledge Atoms

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Reviews (in-app spaced repetition queue) | `Review`, `ReviewItem` (exist) | `/api/reviews/queue`, `/api/reviews/[id]/answer` |
| 2 | Journal entries (manual) | `JournalEntry` (exists) | `/api/journal` (POST/GET) |
| 3 | Journal entries (bot-prompted — wires #20 fully) | `JournalEntry` extended in W4 | `/api/journal/prompted` (already shipped W4 D7) |
| 4 | Diagnostic Challenges | `Challenge`, `ChallengeAttempt` (exist) | `/api/challenges`, `/api/challenges/[id]/attempt` |
| 5 | Knowledge Atoms (taggable to Pearls/Cases) | `Bookmark`, `Citation` (exist) | `/api/bookmarks`, `/api/citations` |

### Success Criteria
- [ ] Resident's review queue loads with due cards (spaced repetition algorithm)
- [ ] Resident receives nightly bot prompt → writes reflection in journal
- [ ] Resident attempts diagnostic challenge → gets scored
- [ ] Knowledge atom bookmark → searchable in W12 global search

---

## 10b. Week 8 — Assessment + Analytics + Kirkpatrick L3

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Scoring historical log (Phase B) | `ScoringEvent` (exists) | `/api/learners/[id]/scoring-history` |
| 2 | DOPS Assessment | `DopsAssessment` (exists) | `/api/faculty/dops`, `/api/faculty/dops/[id]` |
| 3 | Mini-CEX Assessment | `MiniCexAssessment` (exists) | `/api/faculty/mini-cex` |
| 4 | EPA Records | `EpaRecord`, `EpaRecalcEvent` (exist) | `/api/learners/[id]/epa` |
| 5 | Progress page (3H radar, Bloom's chart, EPA progress) | reuses scoring data | `/api/learners/[id]/progress` |
| 6 | **#11 Kirkpatrick L3** (Behavior — uses DOPS evidence) | extends W4 D9 | `/api/learners/[id]/kirkpatrick/l3` (auto-derived from DOPS scores) |

### Success Criteria
- [ ] Faculty submits DOPS for resident's intravitreal injection
- [ ] Resident's progress page shows updated EPA level + Bloom's depth + 3H radar
- [ ] Kirkpatrick L3 score auto-recomputes from new DOPS evidence

---

## 10c. Week 9 — Knowledge Library (Pearls + Atlas + Reference)

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Pearls library (full searchable) | `Pearl`, `PearlLike` (exist) | `/api/pearls`, `/api/pearls/[id]`, `/api/pearls/like` |
| 2 | Signs Atlas | `AtlasImage`, `AtlasTag` (exist) | `/api/atlas`, `/api/atlas/[id]` |
| 3 | Medical Reference | reuses `RagDocument` (exists, scoped to `reference` collection) | `/api/reference/search` |
| 4 | Image Library | `File` (exists) | `/api/images`, `/api/images/[id]` |

---

## 10d. Week 10 — Practice Tools (Simulators) + Live Sim Launch

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Simulators (slit lamp, fundoscopy, tonometry) | `Simulator`, `SimulatorRun` (exist) | `/api/simulators`, `/api/simulators/[id]/run` |
| 2 | **#16 Branching simulations** (decision trees) | extends `Simulator.metadata` JSON | `/api/simulators/[id]/branching/[stateId]` |
| 3 | **#16 Adaptive Baseline simulation** | uses `User`'s prior `ScoringEvent` history | `/api/simulators/baseline/start` |
| 4 | **#8 Live in-session simulation launch** | new `LiveSimulationLaunch` (sessionId × simulatorId × responses) | `/api/classroom/sessions/[id]/launch-simulation`, `/active-simulations/[id]` |

### Success Criteria
- [ ] Presenter clicks "Launch case" during live session → all participants vote on management decision
- [ ] Branching sim: wrong answer → branches to "tractional RD" path with new vignette
- [ ] Adaptive baseline measures resident's competency in 5 min, customizes pathway

---

## 10e. Week 11 — Pathways (Courses + Recommendations + Readiness UI)

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Competency Courses | `Course`, `CourseModule`, `CourseItem`, `CourseEnrollment`, `CourseCompletion` (exist) | `/api/courses`, `/api/courses/[id]/enroll` |
| 2 | Recommendations Engine | `Recommendation` (exists) | `/api/learners/[id]/recommendations` |
| 3 | Certificates | `Certificate` (exists) | `/api/learners/[id]/certificates` |
| 4 | **#3 Readiness Predictor UI** (data layer shipped W4 D10) | reuses `EngagementSignal`, `LearnerReadinessSignal` | `/api/classroom/sessions/[id]/readiness` already exists; UI added here |

### Success Criteria
- [ ] PD sees readiness dashboard: "5 of 12 residents underprepared for tomorrow's session"
- [ ] System recommends remediation course for underprepared residents
- [ ] Resident completes course → certificate issued

---

## 10f. Week 12 — Infrastructure (Notifications + Search + Reports + CME)

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Notifications (full — email + in-app + WhatsApp from W4 D4) | `Notification`, `NotificationPreference` (exist) | `/api/notifications`, `/api/notifications/preferences` |
| 2 | Global search across all transcripts, pearls, atlas, cases | `SearchIndex` (exists, Postgres FTS) | `/api/search?q=...` |
| 3 | Reports & Exports | `DataExport` (exists) | `/api/admin/reports`, `/api/admin/reports/[id]/export` |
| 4 | CME Credits | `CmeCredit` (exists) | `/api/learners/[id]/cme`, certificate generation |

### Success Criteria
- [ ] Resident searches "tractional RD" → top results across pearls, atlas, lecture transcripts (with timestamp seek)
- [ ] PD exports cohort progress report as CSV
- [ ] Resident accumulates CME credit from course completion

---

## 10g. Week 13 — AI Pipeline (Content Ingestion + RAG + Training Queue + Live Assistant)

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Content Ingestion (PubMed PMC ingestion, journal scraping) | `RagCollection`, `RagDocument`, `RagChunkMeta` (exist) | `/api/admin/ingestion/jobs`, BullMQ `ingest` worker |
| 2 | RAG retrieval pipeline (BGE-M3 embeddings + Qdrant) | reuses RAG models | `/api/rag/query` |
| 3 | Training Queue (faculty corrections feed LoRA) | `TrainingQueueItem`, `TrainingFeedback` (exist) | `/api/admin/training-queue`, `/api/admin/training-queue/[id]/approve` |
| 4 | **#18 Live AI Clinical Assistant in session** (factual Q + slide retrieval + evidence linking) | reuses `Conversation`, `Message`, `Citation`, RAG suite | `/api/classroom/sessions/[id]/chat-assistant` |
| 5 | AI Models registry | `AiModel`, `LoraAdapter`, `FineTuneRun` (exist) | `/api/admin/models` |

### Success Criteria
- [ ] Resident asks live in-session: "what's the threshold for PRP?" → AI answers with citation to specific paper + retrieved slide
- [ ] Faculty corrects an AI answer → entry appears in training queue
- [ ] PD approves correction → it goes to LoRA training dataset (Phase B activates training)

---

## 10h. Week 14 — Whiteboard + Admin (Audit + VCCE + Gamification + Webhooks + Prefs)

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | **#12 Whiteboard sync + PDF export** (Excalidraw/tldraw integration) | new `WhiteboardSnapshot`, `WhiteboardStroke` | `/api/classroom/sessions/[id]/whiteboard`, `/snapshot`, `/export` |
| 2 | Audit fill-gaps (verify coverage on every state-changing action) | `AuditEvent`, `AdminAction` (exist) | `/api/admin/audit-events` |
| 3 | VCCE eval harness | `VcceItem`, `VcceResult` (exist) | `/api/admin/vcce/run`, `/api/admin/vcce/results` |
| 4 | Gamification points (with W4 D5 leaderboard already live) | `GamificationPoint` (exists) | `/api/learners/[id]/gamification` |
| 5 | Webhooks | `Webhook`, `WebhookDelivery` (exist) | `/api/admin/webhooks`, `/api/admin/webhooks/[id]/test` |
| 6 | User Preferences | `UserPreferences`, `NotificationPreference` (exist) | `/api/profile/preferences` |

### Success Criteria
- [ ] Faculty draws on whiteboard during live session → all participants see strokes in real-time
- [ ] Whiteboard exports as PDF after session
- [ ] VCCE test run completes; results stored
- [ ] PD configures webhook → test fires successfully

---

## 10i. Week 15 — Polish + Phase-1 Production Demo

### Goal

Phase-1 production-ready showcase. All 22 features functional. End-to-end rehearsal.

### Deliverables

| # | Deliverable |
|---|---|
| 1 | Phase-1 demo data seeded: 3 faculty + 10 residents + 5 pre-recorded sessions + 20 documents + 50 pearls + 100 challenges + simulator runs + course enrollments |
| 2 | Full Phase-1 e2e walkthrough — covers all 22 features in one rehearsal |
| 3 | Performance test: 50 concurrent live participants + 100 concurrent recording viewers |
| 4 | Mobile responsiveness pass on 375px width |
| 5 | Dark mode pass across all pages |
| 6 | Loading states + error boundaries on every page |
| 7 | All BullMQ workers run cleanly under load |
| 8 | Bug fixes from QA |
| 9 | Demo script written for 30-min walkthrough (was 15 min for showcase; now covers more) |
| 10 | Demo rehearsal |
| 11 | Backup plan (if live demo fails, show pre-recorded session) |
| 12 | Production env-gate verification on a staging deploy |

### Phase-1 Demo Script (30-minute walkthrough)

```
ACT 1 — BEFORE THE LIVE SESSION (8 min)
  - Admin invites new faculty + resident (W1)
  - PD schedules session for tomorrow 2pm, cohort visibility (W3)
  - Faculty uploads PPT + 2 reference PDFs during scheduling (W4 Stream C)
  - AI classifies, flags PHI in case-note PDF, faculty redacts (W4 C5)
  - AI Smart Presentation Studio scores PPT — readability 6/10, suggests
    interaction points at slides 4, 9, 14 (W4 C10)
  - AI generates promo content: WhatsApp banner + flyer for the session (W4 A9)
  - Residents submit pre-session questions, AI clusters into 4 themes,
    presenter sees top concerns (W6 #2)

ACT 2 — DURING THE LIVE SESSION (12 min)
  - Faculty + 10 residents join (W2)
  - Live English captions stream during talk (W4 B9)
  - Auto-hook fires at 7-min mark: "True/False — anti-VEGF in tractional RD?"
    Live leaderboard updates as residents respond (W4 D2 + D5)
  - Presenter sees private alert: "engagement low last 3 min, ask question"
    (W4 D3) — no learner sees it
  - Faculty launches in-session diagnostic case — residents vote management
    (W10 #4)
  - Faculty starts AI-grouped breakout — system clusters by performance into
    3 balanced groups (W5 #2)
  - In each breakout: AI co-facilitator summarizes, prompts silent (W5 #6)
  - Faculty shares whiteboard, draws PDR algorithm — residents see live
    (W14 #1)
  - Resident asks AI in-session: "PRP threshold?" — AI answers with citation
    (W13 #4)

ACT 3 — AFTER THE LIVE SESSION (10 min)
  - Recording auto-uploads, transcodes to HLS in 8 min (W4 Stream A)
  - Multi-lang captions toggleable on Vidstack (W4 A6)
  - Resident posts Q at 12:34 timestamp; faculty pins reply (W5 Q&A)
  - Resources tab shows: tagged PPT, polished deck, redacted case notes,
    reel from session (W4 + W5 Resources)
  - WhatsApp pearl scheduled: 3 pearls deliver to resident at 24h/72h/7d
    (W4 D4)
  - Coach interaction: resident asks "explain DR again" — bot explains +
    quizzes + links case (W4 D6)
  - Reflection bot prompts: resident writes journal entry (W4 D7 + W7 #3)
  - Progress page shows: Bloom's depth ↑, Kirkpatrick L1 (survey done) +
    L2 (quiz score) + L3 pending DOPS, EPA progress (W4 D8/D9 + W8)
  - PD readiness predictor: "for tomorrow's session, 4 residents
    underprepared — recommend remediation course" (W11 #4)
  - Recommendations engine: 3 personalized next-steps for the resident
    (W11 #2)

ACT 4 — THE DIFFERENTIATOR (close, ~30 sec)
  "Zoom gives you video. Vaidix delivers a complete clinical learning
   intelligence platform — pre-class priming, live AI co-teaching, post-
   class reinforcement, longitudinal competency tracking — all on LVPEI's
   own infrastructure with one fine-tuned medical SLM."
```

### Success Criteria (Phase-1 Showcase)

- [ ] Demo runs end-to-end without errors in 2 consecutive rehearsals
- [ ] All 22 Phase-1 features hit during demo (script lists which act covers each)
- [ ] 50-participant live + 100-viewer recording stress test passes
- [ ] Mobile demo on iPhone Safari + Android Chrome works
- [ ] Production env-gates pass on staging deploy with `NODE_ENV=production`
- [ ] All BullMQ workers process jobs without retries during demo
- [ ] Backup recording prepared for live-demo failure
- [ ] Demo script ≤ 30 minutes

---

## 11. Prerequisites

### Already done (W0 prerequisites)

PostgreSQL, Redis, Docker, `vaidix` database, E:\vaidix-data\, Gmail App Password, single dev assigned. ✅

### NEW prerequisites for W4-Sprint (must be done before W4-Sprint Day 1)

| Task | Owner | Notes |
|---|---|---|
| **Hire 10 additional developers** | Symbiosys + you | 4 stream leads + 6 implementation devs. Confirm before W4 Day 1. |
| **Confirm hiring budget** | You | 11 devs × 4 weeks. Get buffer for 5 weeks in case of slip. |
| **GitHub org / branch protection** | Tech lead | Per-stream branches, required reviews, CI gating. No more direct pushes to `main`. |
| **CI pipeline** | Tech lead | GitHub Actions: typecheck, lint, all 4 stream e2e scripts on PR + main. Currently absent — must land before W4. |
| **WhatsApp Business API account** | You | Required for Stream D #9. ~1-week procurement. Start now. |
| **Sentry / error tracking** | Tech lead | Before W4 Day 1. Currently no error tracking. |
| **Onboarding handbook** for the 10 new hires | Tech lead | 1-day onboarding: repo tour, schema overview, conventions, env setup, dev runbook |
| **Daily-standup tool** | Tech lead | Slack channel + 15-min sync slot for all 11 devs |
| **Pick Phase-1 showcase date** | You | Target end of W15 + 1 week buffer = ~20 weeks from W0 start |

---

## 12. Tech Stack Summary (for this build)

| Layer | Technology | Source |
|---|---|---|
| **Framework** | Next.js 16 + React 19 | Already installed |
| **Database** | PostgreSQL 17 | Already installed |
| **ORM** | Prisma 6 | `npm install` |
| **Queue** | BullMQ + Redis 8 | `npm install`, Redis already installed |
| **Auth** | NextAuth.js v5 + bcrypt | `npm install` |
| **Email** | Nodemailer (Gmail SMTP) | `npm install` |
| **Video SFU** | LiveKit | Docker |
| **Video Player** | Vidstack | `npm install` |
| **Video Storage** | MinIO (S3-compatible) | Docker |
| **Video Transcoding** | FFmpeg | BullMQ worker |
| **TURN** | coturn | Docker |
| **Transcription** | `sarvam` (W4–showcase, dual-provider behind `TranscriptionProvider` interface) → `self_hosted` Faster-Whisper + IndicConformer at LVPEI prod cutover. Hard env gate (§8). | API key (dev) / on-prem GPU (prod) |
| **AI Services (Phase A)** | Gemini API (existing) | Existing keys |
| **AI Services (Phase B, post-showcase)** | Vaidix Core SLM (Qwen 2.5-7B + LoRA) per [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md). Same env-gate pattern as transcription: production flips to `AI_PROVIDER=vaidix_core` and bans `GEMINI_API_KEY` in prod env. | LVPEI on-prem GPU |
| **UI Components** | shadcn/ui + Tailwind + Framer Motion | Already installed |
| **State** | Zustand | Already installed |

### New npm packages to install

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter
npm install bcryptjs zod nodemailer
npm install bullmq ioredis
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install livekit-server-sdk @livekit/components-react livekit-client
npm install vidstack
npm install @sparticuz/chromium puppeteer-core   # for PDF generation (Week 5+)

# Dev dependencies
npm install -D @types/bcryptjs @types/nodemailer tsx
```

---

## 13. Success Criteria (Overall — Phase 1 by end of Week 15)

### Functional — all 22 Phase-1 features working

- [ ] All 5 W0–W3 features still functional (auth, scheduling, live video, calendar, admissions)
- [ ] All 15 W4-Sprint features functional (recording, transcription, documents, presentation analysis, promo, reels, live captions, hooks, presenter alerts, WhatsApp pearls, leaderboards, coach, reflection bot, Bloom's, Kirkpatrick L1+L2)
- [ ] All 7 W5–W14 features functional (Q&A + breakouts + co-facilitator + AI grouping, pre-conference Q&A engine, Kirkpatrick L3, branching/adaptive sims, live in-session sim launch, readiness predictor UI, live AI clinical assistant, whiteboard sync + PDF export)
- [ ] **#7 Emotion Analytics deferred to W16+** — pending LVPEI ethics committee sign-off

### Non-functional

- [ ] Page load p95 < 2.5s on localhost; < 4s on LVPEI on-prem
- [ ] Video join p95 < 3s
- [ ] Recording playback start p95 < 3s
- [ ] Live caption SSE delivers text within 10 sec of speech
- [ ] Mobile responsive on 375px width
- [ ] Dark mode works across all pages
- [ ] No console errors in happy path on any page
- [ ] Keyboard accessible
- [ ] All BullMQ workers process jobs without retries during normal load

### Security

- [ ] bcrypt password hashing
- [ ] HTTP-only Secure SameSite=Strict cookies
- [ ] Rate limiting on login + sensitive routes
- [ ] CSRF protection on state-changing routes
- [ ] Protected routes enforce authentication
- [ ] Role-based access enforced
- [ ] Audit log records every critical action across all 22 features
- [ ] **Production env gates pass:** boot fails with `SARVAM_API_KEY` set, with localhost `DATABASE_URL`, with weak `NEXTAUTH_SECRET`
- [ ] PHI sanitizer (Presidio) runs on all case-note uploads
- [ ] DPDPA expunge worker functional (right-to-erasure)
- [ ] WhatsApp opt-in consent recorded in `ConsentRecord` before any pearl send

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **W4-Sprint scope is aggressive — 11 devs in parallel can integration-thrash** | Single tech-lead-owned migration queue, daily 15-min sync, per-stream e2e scripts, locked cross-stream interfaces on Day 1, per-stream PR queues with stream-lead intra-review. |
| **Hiring 10 devs takes longer than W4 sprint window** | Start hiring NOW (before W3 finishes). Have backup plan: 6-dev W4-Sprint takes 6 weeks instead of 4. Documented in §11 prerequisites. |
| **Quality slips under sprint pressure** | Production-ready bar enforced via PR template. Tech lead reviews every cross-stream PR. Security review checkbox is non-negotiable. If a feature isn't ready by W4 end, it slides to W5 — does not ship as a stub. |
| **LiveKit self-hosting complexity** | Use LiveKit Cloud free tier (50K min free) as fallback for early dev. Migrate to self-hosted (LVPEI on-prem) before production. |
| **Transcription quality on Indian English** | W4–showcase: Sarvam API (synthetic data only). LVPEI prod cutover to self-hosted Faster-Whisper + IndicConformer enforced by env gate (§8). |
| **Demo bandwidth on LVPEI WiFi** | Run backup pre-recorded session. Show that + live setup separately. |
| **Stream lead unavailable mid-sprint** | Stream-lead role can be picked up by tech lead temporarily; each stream has 2-3 implementation devs who can absorb. Daily standups surface blockers fast. |
| **Gmail SMTP rate limits** | Gmail allows 500 emails/day free. Sufficient for development. Production: migrate to AWS SES / SendGrid (W12 Notifications work covers this). |
| **500 MB file uploads failing** | Chunked upload via presigned URLs to MinIO. Tested in W4 Stream C. |
| **PHI in demo data** | All demo documents fully synthetic or faculty-approved. Presidio PHI sanitizer (W4 C5) runs on all case notes. |
| **Schema changes during W4-Sprint** | All migrations through tech lead. Prisma `migrate dev` only on tech lead's machine; everyone else `migrate deploy`. |
| **WhatsApp Business API onboarding takes weeks** | Start procurement immediately (§11 prerequisites). Stream D #9 can use a stub provider during dev, swap to real API when account active. |
| **#7 Emotion Analytics ethics approval slips past W15** | Acceptable — Phase 1 ships with 21 of 22 features and #7 added in W16+ as a small follow-up release. Documented as a calendar dependency, not engineering. |
| **Live AI in-session features (W4 hooks/alerts, W13 RAG assistant) hit GPU contention with transcription** | Dedicated GPU instances per concern (transcription on its own, vLLM serving on its own). Documented in [VAIDIX-VIDEO-ARCHITECTURE.md §6.5](VAIDIX-VIDEO-ARCHITECTURE.md). |

---

## 15. After Phase 1 (Phase 2 scope)

Phase 1 now delivers all 22 features from [Feeddback.md](../Feeddback.md) over W0–W15 (with #7 Emotion Analytics in W16+ when ethics signs off). The previous "After the Showcase" 14-week continuation has been folded into W6–W14 inline.

Phase 2 scope (post W15):

### Phase 2.0 — Vaidix Core SLM activation (replaces Gemini)
- Train Vaidix Core v1 LoRA on accumulated training-queue corrections (W13 Training Queue feeds this)
- Switch `AI_PROVIDER=vaidix_core` in production env, ban `GEMINI_API_KEY` via env gate
- Per [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md)

### Phase 2.1 — Enterprise integrations
- EMR integration (HL7 FHIR — `EmrIntegrationStub`, `EmrMappingStub` already in schema)
- SSO/SAML (`SsoProviderStub` already in schema)
- SCIM provisioning (`ScimGroupStub` already in schema)
- 2FA (TOTP/WebAuthn)

### Phase 2.2 — Resilience + scale
- Offline sync (residents on train/flight)
- Multi-region failover (if LVPEI expands beyond Hyderabad)
- AWS/GCP cloud-staging environment for canary deployments

### Phase 2.3 — Cross-specialty replication
- Add cardiology, neurology, orthopaedics LoRA adapters per [VAIDIX-SLM-ARCHITECTURE.md §13](VAIDIX-SLM-ARCHITECTURE.md)
- Multi-LoRA serving via vLLM
- Per-specialty content ingestion + VCCE harnesses

---

## 16. Local Dev → LVPEI On-Prem Migration

The build runs on a developer's local machine (Windows + E: drive + Docker compose). The production target is **LVPEI's on-prem server**, not a public cloud. AWS/GCP Mumbai is only a staging fallback if on-prem provisioning slips.

### 16.1 What stays identical between local and on-prem

Same Docker Compose stack: PostgreSQL, Redis, LiveKit, LiveKit Egress, MinIO, coturn. Same Prisma schema, same migrations, same Next.js build, same BullMQ workers. Only env vars change.

### 16.2 What changes at cutover

| Concern | Local dev | LVPEI on-prem (production) |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | local Postgres on E: | on-prem Postgres on LVPEI server |
| Object storage | MinIO on E:\vaidix-data | MinIO on LVPEI storage volume (same S3 API) |
| `TRANSCRIPTION_PROVIDER` | `sarvam` (or `self_hosted` if dev has GPU) | `self_hosted` — **and `SARVAM_API_KEY` removed from env** |
| `AI_PROVIDER` | `gemini` | Phase A: `gemini` (until SLM ready); Phase B: `vaidix_core` — **and `GEMINI_API_KEY` removed from env** |
| Email | Gmail SMTP | LVPEI SMTP relay or AWS SES |
| TLS | none (localhost) | nginx in front of Next.js, certs provisioned by LVPEI IT |
| Backups | none | nightly Postgres `pg_dump` + MinIO `mc mirror` to a second volume |

### 16.3 Production env gates (defense-in-depth)

`src/lib/env.ts` must contain assertions that **fail boot** if any of these are true in production:

- `NODE_ENV=production` AND `SARVAM_API_KEY` is set → refuse to boot (transcription must be self-hosted)
- `NODE_ENV=production` AND `AI_PROVIDER=gemini` AND `GEMINI_API_KEY` is set, **once Phase B is reached** → refuse to boot (Vaidix Core only). Until Phase B, Gemini is allowed in prod with a logged warning.
- `NODE_ENV=production` AND `NEXTAUTH_SECRET` is missing or shorter than 64 chars → refuse to boot
- `NODE_ENV=production` AND `DATABASE_URL` points to localhost → refuse to boot

These gates are the single most cost-effective way to prevent a misconfigured deploy from leaking patient data to an external service.

### 16.4 Cutover checklist (run once at LVPEI go-live)

1. Provision on-prem GPU server, install Docker, mirror Docker Compose stack
2. Apply all Prisma migrations against on-prem Postgres
3. Seed bootstrap admin (`prisma/seed.ts`)
4. Set production env vars per §16.2 — explicitly remove `SARVAM_API_KEY`
5. Deploy Faster-Whisper + IndicConformer + pyannote services on the GPU
6. Smoke-test transcription with synthetic audio
7. Boot Next.js — env gates must pass, otherwise fix env
8. Run W1+W2+W3 e2e scripts against on-prem URL
9. First real LVPEI session: faculty + 2 residents, 10 min, recorded, transcribed end-to-end
10. Sign-off from LVPEI IT (data residency, audit log review)

---

## Change Log

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-04-13 | Initial 5-week video-first showcase build plan. 4 pillars: Auth + Live Video + Recordings + Faculty Documents. Phase 1 production build plan (not MVP). Week 0 schema lock approach. All 42 domains designed upfront, empty tables fine. |
| v1.1 | 2026-04-24 | **Status snapshot + dual-provider clarifications.** Added "Status as of 2026-04-24" table at top: W0–W3 ✅ done, W4–W6 ❌ not started. W4 (§8) rewritten with Sarvam → self-hosted dual-provider strategy, `TranscriptionProvider` interface, and production env gate that refuses boot with `SARVAM_API_KEY` set. Tech stack table (§12) split AI Services into Phase A (Gemini, current) and Phase B (Vaidix Core, post-showcase) with the same env-gate pattern. Risks (§14) updated to reflect the env-gate enforcement. New §16 added: Local Dev → LVPEI On-Prem Migration with explicit cutover checklist and prod env-gate list. Production target restated as **LVPEI on-prem**, not AWS/GCP — cloud is a staging fallback only. |
| v1.2 | 2026-04-24 | **Phase 1 expansion to all 22 features (no prototypes, no deferrals to "after showcase").** Client decision: deliver every feature from the original [Feeddback.md](../Feeddback.md) brief as Phase 1, production-ready. **W4 → W4-Sprint** (4 calendar weeks, 11 devs in 4 parallel streams: Recording & Media / Transcription & Live Captions / Documents & Presentation AI / Engagement & Out-of-band) — absorbs 15 of 22 features. **W5–W14 expanded** to absorb the remaining 7 features as their prerequisites land (breakouts in W5 unlock #6+#13; scoring in W8 unlocks #11 L3; simulators in W10 unlock #8+#16; RAG in W13 unlocks #18; whiteboard gets its own W14 slot). **W15 = Phase-1 production demo** (was the showcase). **#7 Emotion Analytics** explicitly deferred to W16+ pending LVPEI ethics committee — calendar dependency, not engineering. §3 timeline diagram fully replaced. §8 fully rewritten as W4-Sprint with stream-by-stream tables, cross-stream interface contracts, and per-stream success criteria. §9 (W5) extended with #6 + #13. §10 split into §10a–§10i (W6–W15), each a 1-week scope with deliverables, tables, APIs, success criteria. §11 prerequisites updated for the 11-dev hire + GitHub branch protection + CI + WhatsApp Business API + Sentry. §13 Success Criteria rewritten to Phase-1 (all 22). §14 Risks expanded with sprint-coordination + hiring + quality risks. §15 (After the Showcase) replaced with Phase 2 scope (Vaidix Core activation, EMR/SSO/SCIM, offline sync, multi-specialty replication). API namespace summary in §8.6: ~22 new route files across 6 existing namespaces, no god-endpoint. |

---

*Document Version: 1.2*
*Status: W0–W3 shipped. W4-Sprint ready to kick off pending: 10-dev hire, CI pipeline, WhatsApp Business API account, branch protection.*
*Phase 1 total: 19 calendar weeks (4 elapsed + 4 sprint + 11 normal). All 22 Feeddback.md features production-ready by end W15.*
*Next step: Confirm 10-dev hire timeline → write VAIDIX-W4-SPRINT.md implementation playbook → kick off W4 Day 1.*
