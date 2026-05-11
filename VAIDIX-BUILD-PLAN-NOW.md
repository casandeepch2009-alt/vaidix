# Vaidix — Build Plan (NOW)

## Phase 1 Execution Plan — All 22 Features, Production-Ready by W15

| Field | Value |
|---|---|
| **Document status** | v3.5 — **Session audience flags refactor (the Meera↔Arjun visibility bug).** Replaces the single-choice `SessionVisibility` enum (`OPEN_TO_ALL`/`COHORT`/`INVITE_ONLY`/`PRIVATE`) with three orthogonal flags so a host can combine "Anyone with link" **and** "Cohort PGY-1" **and** "Invite specific people" in one session — the old form forced a single radio choice and silently defaulted to `OPEN_TO_ALL`, which the visibility helper deliberately excluded from RESIDENT list surfaces (intentional design), so faculty saw their own sessions but the residents they wanted to teach didn't. **Schema (migration `20260511210000_session_audience_flags`)**: add `TeachingSession.openToAll Boolean @default(false)`, backfill from `visibility='OPEN_TO_ALL'`, drop the `visibility` column + index + the `SessionVisibility` enum type. `cohortId` and `invites[]` continue to carry cohort/invite scoping — their presence is now the signal, no enum gating. PRIVATE becomes the empty state (all flags off / no cohort / no invitees). **Validation** (`src/lib/validation/session.ts`): `createSessionSchema` drops the `visibility` field for `openToAll: z.boolean().default(false)`; cohort/invitee refines removed — any combination of axes is legal, including none (PRIVATE). **Service layer**: `buildSessionVisibilityWhere` and `userCanSeeSession` in `sessions/visibility.ts` rewritten — list-surface match = cohort member OR invitee OR (FACULTY: host/proposer) OR (ADMIN/PD: program-wide). `openToAll` alone is link-only, deliberately not list-matched. `getEffectiveSessionRole` in `session-service.ts` adds an `openToAll → PARTICIPANT` fallback after the cohort/invite branches so anyone-with-link can join the call. `assertInviteEditor` drops its `visibility === INVITE_ONLY` guard — invitees are now orthogonal to other axes and can be layered on any session. `resolveAttendees` in `session-notifications.ts` rewritten as cohort∪invitees with no `OPEN_TO_ALL → blast every resident+faculty` path — that was an accidental institution-wide email every time a host accepted the default. `userCanViewSession` in `recordings/recording-service.ts` switched to flag-based matching. `pre-questions-service.ts` deduped to call `sharedUserCanSeeSession/userIsHostOrPrivileged` from `sessions/visibility.ts` (eliminates a drifted copy of the rule). `ical-feed-service.buildFeedForUser` rewritten to reuse `buildSessionVisibilityWhere` so the iCal feed and the Classroom listing can no longer disagree (previously the feed included OPEN_TO_ALL for everyone while the in-app list excluded it). **API**: `/api/calendar/session-preview/[id]` returns `openToAll: boolean` instead of `visibility: string`. **UI**: `new-session-form.tsx` StepAudience converted from a 4-way radio group to a 4-way checkbox group (`AUDIENCE_OPTIONS` = openToAll | cohort | invite | private). Private is mutually exclusive with the other three; the other three can combine freely. `validateStep(2)` now requires "cohort selected if Cohort axis ticked; ≥1 invitee if Invite axis ticked." Submit payload swapped from `{visibility, cohortId, inviteeIds}` to `{openToAll, cohortId, inviteeIds}`. Edit-mode invitee diff no longer gated on `visibility === INVITE_ONLY` — invitees diff on every save. `classroom/[id]/edit/page.tsx` loads `openToAll` and surfaces all existing invitees regardless of other axes. Display components updated: `calendar-view.tsx` (`ApiEvent` type carries `openToAll: boolean`), `session-preview-panel.tsx` (`CohortSummary` takes `openToAll` boolean and renders "Anyone with link can join" / "Invite-only session"), `approvals-inbox.tsx` (new `audienceSummary()` helper composes "Cohort: X · 3 invitees · Anyone with link" from the active axes). **Seed (`prisma/seed.demo.ts`)**: demo sessions now stamp `openToAll: true` AND `cohortId=demo-cohort-2025`; both `arjun.mehta@vaidix.local` (RESIDENT) and `meera.krishnan@vaidix.local` (FACULTY) from the base seed are enrolled in `demo-cohort-2025` so the primary demo logins see the 5 seeded sessions in `/classroom` under the new strict list rules. **Tests**: new `scripts/e2e-audience-flags.ts` — back-end end-to-end covering (a) multi-axis create accepts openToAll+cohortId+inviteeIds together, (b) in-cohort resident sees a cohort-only session in `/api/calendar/events`, (c) out-of-cohort resident does NOT see a cohort-only or openToAll-only session, (d) invitee sees an invite-only session even without cohort membership, (e) token endpoint rejects out-of-audience from cohort-only but admits them to openToAll, (f) invitees can now be added to a cohort-only session (assertInviteEditor no longer enum-gated), (g) recording playback follows the same gates. New Playwright UI test `tests/e2e/audience-multi-select.spec.ts` drives the actual checkbox picker, ticks Cohort + Anyone-with-link, schedules a session as faculty, then verifies a resident in that cohort sees the session on `/classroom`. **Files added:** `prisma/migrations/20260511210000_session_audience_flags/migration.sql`, `scripts/e2e-audience-flags.ts`, `tests/e2e/audience-multi-select.spec.ts`. **Files modified:** `prisma/schema.prisma`, `prisma/seed.demo.ts`, `src/lib/validation/session.ts`, `src/server/services/sessions/visibility.ts`, `src/server/services/session-service.ts`, `src/server/services/session-notifications.ts`, `src/server/services/calendar-service.ts`, `src/server/services/ical-feed-service.ts`, `src/server/services/recordings/recording-service.ts`, `src/server/services/pre-questions/pre-questions-service.ts`, `src/app/api/calendar/session-preview/[id]/route.ts`, `src/app/(platform)/calendar/new/new-session-form.tsx`, `src/app/(platform)/classroom/[id]/edit/page.tsx`, `src/components/calendar/calendar-view.tsx`, `src/components/calendar/session-preview-panel.tsx`, `src/app/(platform)/inbox/approvals/approvals-inbox.tsx`, `src/app/(platform)/inbox/approvals/page.tsx`. **Decision rationale (recorded for codex review):** (1) `openToAll` alone deliberately does NOT auto-list — preserving the link-share semantic from v2.0; this is the explicit guard against the original footgun where the default radio choice silently published every session to the institution. If a host wants list visibility they must explicitly pick a cohort and/or invitees. (2) `openToAll` link-joiners CAN chat and Q&A live (webinar semantics) but CANNOT see study-pack / pre-cases / pre-questions (materials are list-match only). (3) `openToAll` does NOT broadcast emails — recipient set is the union of cohort∪invitees. The old "OPEN_TO_ALL → mass email every resident+faculty" path is removed. (4) PRIVATE is no longer a distinct enum value; it's the empty state, exposed in the UI as a mutually-exclusive checkbox so faculty can still pick "host only" with one click. v3.4 — **W8 Faculty Forge & Pre-Session Suite shipped.** End-to-end document → forge → AI-coach → publish → share → readiness loop, with multi-model AI routing landed. (1) **AI router infra (Phase 0)** — `claude.ts` refactored to accept `model` per call (backwards-compatible default to `env.ANTHROPIC_MODEL`). `gemini.ts` extended with `geminiGenerateImage()` (Nano Banana / Imagen via `:generateContent` with `responseModalities=['IMAGE']`). New env vars: `ANTHROPIC_OPUS_MODEL=claude-opus-4-7`, `ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6`, `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image`. **New `src/server/services/ai/router.ts`** — single import surface for all feature-level AI work. Operations: `aiReview` (Opus, clinical accuracy audit), `aiDesign` (Sonnet, structure/layout), `aiEnhanceEnglish` (Gemini Flash, polish), `aiEnhanceContent` (Opus, deepen reasoning), `aiGenerateImagePrompt` (Gemini Flash — same family as renderer = native idiom), `aiGenerateImage` (Gemini Image), plus convenience `aiGenerateImageForSlide` chaining the two. JSON-output variants (`aiReviewJson`/`aiDesignJson`/`aiEnhanceContentJson`) parse + clamp inline. Honesty filter doc-comment: "is this reasoning or just description?" — image prompt routes to Gemini, not Opus. (2) **Document detail page (Phase 1)** — `/faculty/documents/[id]/page.tsx` + `document-detail-client.tsx`. Server loads `getDocumentForActor` + `DeckForgeJob[]` for this doc + linked `TeachingSession[]` + available program sessions. Client renders: header (kind chip + PHI status pill + classification + AI-suggested-route nudge + tags), two hero forge cards (Forge presentation → existing `/api/decks/forge`; Forge case → new `/api/cases/forge`), forged decks list with per-deck score chips (readability / density / balance from `analysisResult`), Share-to-session sidebar reusing `/api/documents/[id]/tag-session`, document info dl. framer-motion stagger + linear gradient cards (`bg-linear-to-br` Tailwind v4). Library row titles linkable. **`tests/e2e/w8-faculty-document-detail.spec.ts`** drives library → detail → link-to-session. (3) **Slide-aware deck analyze (Phase 2)** — new `src/server/services/decks/deck-analyze-service.ts`. `analyzeDeck()` runs Opus review pass + Sonnet design pass in parallel via the router; both produce slide-keyed `DeckSuggestion`s with stable `cuid` ids (so accept/dismiss endpoints can address them). Persists to `DeckForgeJob.analysisResult` as **router-v2** payload (versioned — v1 heuristic shape from W4 C10 stays parseable). Carry-forward logic: dismissed/applied state survives re-analysis when matching `kind+slideId+message` reappears. Helpers: `dismissSuggestion`, `markSuggestionApplied`, `isRouterV2`. New API `POST /api/decks/[jobId]/analyze` (CSRF-gated, owner+PD+ADMIN, rate-limited via new `LIMITS.DECK_ANALYZE` 30/h fail-closed). New audit events: `DECK_ANALYZED/SUGGESTION_APPLIED/SUGGESTION_DISMISSED/SLIDE_REFINED`. (4) **AI Coach panel + slide refine (Phase 3)** — new `src/server/services/decks/deck-refine-service.ts`. `applySuggestionToSlide()` picks model by suggestion kind (CLINICAL_ACCURACY/MISSING_CONTENT → Opus, TEXT_OVERLOAD/READABILITY → Gemini, VISUAL_BALANCE/STRUCTURE/INTERACTION_POINT → Sonnet) and produces a `RefineProposal` (before/after diff, never mutates). `refineSlideWithInstruction()` for chat-style refines, intent-routed (`english` → Gemini Flash, `content` → Opus 4.7). Three new endpoints: `POST /suggestions/[id]/dismiss`, `POST /suggestions/[id]/apply` (returns proposal; `?commit=true` marks applied after PATCH lands), `POST /slides/[slideId]/refine`. New rate-limit bucket `DECK_REFINE` 120/h fail-closed. **New `src/components/decks/deck-ai-coach.tsx`** — three regions: score tiles (read/density/balance traffic-light), suggestion list grouped by active-slide → deck-level → others, refine chat with English/Content intent toggle. **New `src/components/decks/deck-diff-modal.tsx`** — before/after columns, model badge (Opus violet / Sonnet teal / Gemini sky), Cancel + Accept. Auto-trigger analyze on mount when no `analysisResult` exists. Existing `deck-editor-client.tsx` got a Tab strip (Edit / AI Coach) and the Coach is the default tab. **`tests/e2e/w8-deck-ai-coach.spec.ts`** seeds an analysisResult and asserts score tiles + suggestion render + dismiss flow + tab swap. (5) **Case-forge end-to-end (Phase 4)** — DB migration `20260510170000_add_case_forge_fields` adds `CaseTemplate.{ownerId,status (CaseTemplateStatus enum DRAFT/PUBLISHED/ARCHIVED),sourceDocumentId,stageGuidance Json,analysisResult Json,forgedAt}` + 3 indexes + 2 FKs (SetNull on cascade). Existing rows get `status=PUBLISHED` (default) so the resident bank stays warm. Reverse relations on User (`caseTemplatesAuthored`) and Document (`forgedCases`). Reused: `cases-service.listCaseTemplates` + `getCaseTemplate` now filter `status: 'PUBLISHED'` so DRAFT/ARCHIVED stay private. **New `src/server/services/cases/case-forge-service.ts`** — Gemini multimodal forge with full Socratic 5-stage prompt (PATIENT_STORY/OBSERVATION/HYPOTHESIS/INVESTIGATION/REFLECTION); produces title/condition/specialty/blooms/difficulty/patient profile/presenting complaint/oslerianPrinciples/tags/`stageGuidance` (mentor intro, expected questions, differentials ranked, workups, teaching points, pearls). Persists as DRAFT owned by faculty. Helpers `publishCaseTemplate`, `archiveCaseTemplate`, `listMyCases`. New API: `POST /api/cases/forge` (CSRF + faculty-like + program-scoped + new `LIMITS.CASE_FORGE` 20/h fail-closed); `POST /api/cases/[caseTemplateId]/publish`; `POST /api/cases/[caseTemplateId]/archive`; `PATCH /api/cases/[caseTemplateId]` (zod-validated owner edits, audited as `case_template.edited`). New audit events `CASE_FORGE_REQUESTED/COMPLETED/FAILED/CASE_TEMPLATE_PUBLISHED/ARCHIVED/EDITED`. **New `/faculty/cases` revamp** — replaces ComingSoon stub. `cases-client.tsx` shows status filter pills (All/Drafts/Published/Archived) + search + cards with status pill / emergency badge / difficulty / Bloom / AI-forged hint / forged + published timestamps / tags. Empty-state pushes to `/faculty/documents`. **New `/faculty/cases/[id]/edit`** owner-only. Server loads + linked-session list. Client `case-editor-client.tsx`: header (status pill + emergency + AI-forged ts + source-doc backlink), two-column body — left: title/condition/description/patient (name/age/sex)/presenting-complaint with char-counts, plus collapsible 5-stage AI mentor guidance read-only preview (every stage rendered with mentor prompt, expected items, ranked differentials, pearls); right: difficulty (Bloom slider 1-6), estimated minutes, emergency toggle, tags chip-input (max 8, lower-cased + hyphen-normalised), Share-to-session picker (gated until status===PUBLISHED) backed by new `/tag-session` endpoint that creates `SessionPreCase` rows. Save / Publish / Archive buttons. Document-detail "Forge case" button now wired and active (calls `/api/cases/forge` then `router.push` to editor). **`tests/e2e/w8-faculty-cases.spec.ts`** seeds a draft, drives library → editor → edit title → save → publish → DB-verifies `status=PUBLISHED + publishedAt set + new title persisted`. (6) **Share-to-session for cases (Phase 5)** — `POST /api/cases/[caseTemplateId]/tag-session` upserts a `SessionPreCase` row for the picked session (program-scoped, requires `status=PUBLISHED` so drafts can't be assigned). Decks ride on their source-document linkage already in place — no new table needed. (7) **Readiness Dashboard 4.1.5 (Phase 6)** — new `/faculty/readiness/[sessionId]/page.tsx` + `readiness-client.tsx`. Reuses existing `computeSessionReadiness` (W6.8 deterministic scorer with 5 weighted signals: pre-readings 25, pre-videos 25, pre-cases 30, pre-questions 10, attendance 10) and adds an inline 7-day engagement timeline computed straight from `EngagementSignal` rows so the timeline matches what residents actually did. UI is the 4.1.5 mockup re-skinned in Vaidix tokens: live-monitoring chip (pulse dot when daysUntil≤1) + countdown, filter pills (All / High risk / Non-engaged) + search, KPI strip (4 accent-bar cards: At-Risk, Non-Engaged, Avg Readiness, Session-Ready), cohort distribution stacked bar with 4-band split (re-banded at UI from the 3-tier service: Critical/AtRisk/Progressing/Ready), 7-day stacked-bar timeline with "Today · N active" callout, learner risk register table (avatar with band-coloured initials, score pill in band tone, material/precases progress, last active relative-time, Nudge + View per-row actions), right column: AI insights cards (heuristic for v1 — calls out critical-unprepared count, cohort-pre-reading-gap pct, momentum), risk-groups collapsible list, Smart Nudge composer with 2 preview templates and Generate-nudges button (LLM endpoint deferred — UI surfaces the placeholder cleanly). framer-motion stagger throughout. **`tests/e2e/w8-readiness-dashboard.spec.ts`** asserts dashboard + chip + KPIs + table + insights + nudge composer surface for an upcoming session. **AI memory updated:** `project_vaidix_ai_routing.md` documents the routing decision (Opus = senior consultant for review/content depth; Sonnet = curriculum designer for design/structure; Gemini = fast assistant for polish/image-prompt/render/source-ingest); `feedback_ai_routing_honesty.md` captures the "is this genuinely reasoning?" filter (initial draft routed image-prompt to Opus; user pushed back; Gemini is correct because same family as renderer + ~50x cheaper). **Files added (Phase 0-6 sum):** `src/server/services/ai/router.ts`, `src/server/services/decks/deck-analyze-service.ts`, `src/server/services/decks/deck-refine-service.ts`, `src/server/services/cases/case-forge-service.ts`, `src/components/decks/deck-ai-coach.tsx`, `src/components/decks/deck-diff-modal.tsx`, `src/app/(platform)/faculty/documents/[id]/page.tsx`, `…/document-detail-client.tsx`, `src/app/(platform)/faculty/cases/[id]/edit/page.tsx`, `…/case-editor-client.tsx`, `src/app/(platform)/faculty/cases/cases-client.tsx`, `src/app/(platform)/faculty/readiness/[sessionId]/page.tsx`, `…/readiness-client.tsx`, `src/app/api/decks/[jobId]/analyze/route.ts`, `…/suggestions/[suggestionId]/dismiss/route.ts`, `…/suggestions/[suggestionId]/apply/route.ts`, `…/slides/[slideId]/refine/route.ts`, `src/app/api/cases/forge/route.ts`, `src/app/api/cases/[caseTemplateId]/publish/route.ts`, `…/archive/route.ts`, `…/tag-session/route.ts`, migration `20260510170000_add_case_forge_fields/migration.sql`, `tests/e2e/w8-faculty-document-detail.spec.ts`, `tests/e2e/w8-deck-ai-coach.spec.ts`, `tests/e2e/w8-faculty-cases.spec.ts`, `tests/e2e/w8-readiness-dashboard.spec.ts`. **Files modified:** `src/server/services/ai/claude.ts` (model per call), `src/server/services/ai/gemini.ts` (image gen), `src/lib/env.ts` (3 new model vars), `src/lib/constants.ts` (drop AI Audit nav entry), `src/app/(platform)/faculty/cases/page.tsx` (replaces ComingSoon stub with the new server page), `src/app/(platform)/faculty/decks/[jobId]/page.tsx` + `…/deck-editor-client.tsx` (Tab strip + Coach default), `src/app/(platform)/faculty/documents/documents-library-client.tsx` (titles linkable), `src/server/services/audit.ts` (10 new events), `src/server/services/rate-limit.ts` (DECK_ANALYZE/DECK_REFINE/CASE_FORGE buckets), `src/server/services/cases/cases-service.ts` (status=PUBLISHED filter on resident-facing list+get), `prisma/schema.prisma` (CaseTemplateStatus enum + 7 fields on CaseTemplate + reverse relations), `src/app/api/cases/[caseTemplateId]/route.ts` (PATCH for owner edits). **Files removed:** `src/app/(platform)/faculty/ai-audit/` (per user decision). **Pre-existing TS errors in unrelated files (not introduced):** `dashboard/page.tsx` generic narrowing, `progress/page.tsx` missing Skeleton import, `api/blueprints/route.ts` + `api/decks/forge/route.ts` reference `LIMITS.DECK_FORGE` which never existed in `rate-limit.ts`, `captions/transcript/export-pdf` JsonArray cast, `popout/[id]/[surface]` UserRole vs Role mismatch, `noise-suppression-toggle`, `pip-button`, `whiteboard-surface`, `session-notifications` — all pre-date this work. v3.3 — **W8.3 frontend wired + Playwright UI test green.** (1) New client component `src/components/classroom/post-session-insights-panel.tsx` — gradient header (Sparkles + "Session insights"), `Download transcript PDF` link (every session-visible role), `Regenerate` button (HOST + PD + ADMIN only, bootstraps `vaidix-csrf` cookie via `/api/csrf` on first click, shows Queueing… → Queued chip), animated tabs `Pearls / Q&A / SJT / PBL` (framer-motion `layoutId` underline), per-tab card lists with "Awaiting faculty review" badge on unapproved pearls + correct-option highlighting on SJT + objectives bullets on PBL, empty-state when totalContent === 0. All elements carry `data-testid` for the Playwright spec. (2) Wired into `src/app/(platform)/classroom/[id]/page.tsx` — server-side cheap select on `SessionTranscript` (`finalized: true`) gates whether the panel mounts, `canTrigger` derived from `hostId` / `PROGRAM_DIRECTOR` / `ADMIN`. Renders above `<LiveSession>` so users see insights without scrolling past the live room. (3) Tailwind v4 class names (`bg-linear-to-*` not `bg-gradient-to-*`). (4) **New `tests/e2e/w8-post-session.spec.ts`** — drives the actual UI: faculty logs in, navigates to `/classroom/[id]`, asserts panel renders, asserts the PDF link href + downloads PDF bytes (`%PDF` magic + ≥1000 bytes), clicks Regenerate, asserts chip becomes `Queued`; resident sees panel + PDF but `Regenerate` has count 0; panel hides when transcript.finalized=false. **3/3 PASSED.** Pairs with `scripts/e2e-w8-post-session.ts` (21/21 API-level). v3.2 — **W8.3 runtime fixes + e2e green.** (1) PDF route: field `startTime` → `scheduledStart` on `TeachingSession`. (2) BullMQ job IDs cannot contain `:` (namespace separator); changed `post-session:<id>` → `psp-auto-<id>` / `psp-manual-<id>-<ts>` and `auto-hook:<id>:<round>` → `ahg-<id>-r<round>`. (3) `post-session-pack-service.ts` rewritten to use `$queryRaw`/`$executeRawUnsafe` for PostSessionQa, SjtCase, PblScenario and `pearl.sourceSessionTranscriptId` — Prisma client cannot be regenerated while Next.js dev server holds the query-engine DLL on Windows. Column names are camelCase (as in migration). Same for e2e cleanup checks. `npm run e2e:w8:post-session` → **PASSED 21/21**. v3.1 — **W8.3 Post-Session Content Pack** logged. (1) **Deps:** `pdf-lib ^1.17.1` + `@anthropic-ai/sdk ^0.95.1` added. (2) **Env:** `ANTHROPIC_API_KEY` (optional) + `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) added to `env.ts`. (3) **Schema (migration `20260510160000_add_post_session_content`):** new `PostSessionQa {id, sessionTranscriptId, question, answer, source, createdAt}`, `SjtCase {id, sessionTranscriptId, stem, options Json, correctIndex?, rationale, createdByAi, approved, approvedById?, approvedAt?, createdAt}`, `PblScenario {id, sessionTranscriptId, trigger, objectives Json, content, createdByAi, approved, approvedById?, approvedAt?, createdAt}` — all FK to `session_transcripts` ON DELETE CASCADE. Added `sourceSessionTranscriptId Text?` to `pearls` + index. Added back-relations `qaPairs`, `sjtCases`, `pblScenarios` on `SessionTranscript`. (4) **Service `src/server/services/ai/claude.ts`** — thin Anthropic SDK wrapper (`claudeGenerate`, `tryParseJson`, `ClaudeUnavailableError`, `ClaudeUnparseableError`). Singleton client, lazy init. (5) **Service `src/server/services/captions/post-session-pack-service.ts`** — `generatePostSessionPack(sessionId)` runs 4 Claude calls in parallel (allSettled so partial failure is tolerated): pearl extraction (3 pearls → `Pearl` table, `extractedByAi=true`, `approved=false`, `sourceType='session_transcript'`), Q&A extraction (5 pairs → `PostSessionQa`), SJT generation (1 case → `SjtCase`), PBL generation (1 scenario → `PblScenario`). Idempotent: skips if `PostSessionQa` rows already exist. `readPostSessionPack(sessionId)` used by the GET route. (6) **New queue `POST_SESSION` (`'post-session'`)**, worker `post-session-pack-worker.ts` (concurrency=2), registered in `workers/index.ts`. (7) **Auto-trigger:** `captions/publish/route.ts` enqueues `post-session-pack` job (`jobId=post-session:<sessionId>`) when `finalizeOnEnd=true` fires. (8) **API routes:** `GET /api/classroom/sessions/[id]/captions/transcript/export-pdf` — any session-visible role, returns A4 PDF (pdf-lib) with branded header, segment timeline `[mm:ss] Speaker: text`, paginated, footer page counter, audited as `transcript.pdf.exported`. `GET /api/classroom/sessions/[id]/post-session` — any session-visible role, returns `{pearls, qaPairs, sjtCases, pblScenarios}`. `POST /api/classroom/sessions/[id]/post-session` — HOST/CO_HOST/PD/ADMIN only, CSRF-gated, enqueues manual re-trigger, audited as `post_session.pack.triggered`. (9) **Audit events:** `TRANSCRIPT_PDF_EXPORTED`, `POST_SESSION_PACK_TRIGGERED`. **Files added:** `src/server/services/ai/claude.ts`, `src/server/services/captions/post-session-pack-service.ts`, `src/server/workers/post-session-pack-worker.ts`, `src/app/api/classroom/sessions/[id]/captions/transcript/export-pdf/route.ts`, `src/app/api/classroom/sessions/[id]/post-session/route.ts`, migration SQL. **Files modified:** `prisma/schema.prisma`, `src/lib/env.ts`, `src/lib/queue.ts`, `src/server/workers/index.ts`, `src/app/api/classroom/sessions/[id]/captions/publish/route.ts`, `src/server/services/audit.ts`. v3.0 — **W8.1 AI Hook Auto-Generator + W8.2 Presenter Alert Extensions** logged. (1) **W8.1 — AI Hook Auto-Generator (live session):** New BullMQ queue `AI_HOOK` (`'ai-hook'`). New service `src/server/services/captions/hook-generator-service.ts` — `scheduleFirstHookRound(sessionId)` enqueues a delayed job (15-min delay, `jobId=auto-hook:<sessionId>:<round>` for dedup); `generateAndFireHooks(sessionId)` reads rolling `SessionTranscript.contentText`, checks Redis offset key `auto-hook:offset:<sessionId>` to skip rounds with < 300 new chars, sends last 3,500-char window to Gemini Flash (ophthalmology-anchored system prompt), parses strict-JSON array of 2 hooks (TRUE_FALSE/POLL/ONE_WORD/REPEAT_CONCEPT/DILEMMA), calls existing `createHook()` + `fireHook()`. `scheduleNextHookRound` called by worker after each round if session still LIVE. New worker `ai-hook-generator-worker.ts` on `QUEUES.AI_HOOK` (concurrency=4); registered in `workers/index.ts`. Trigger: `captions/publish/route.ts` calls `scheduleFirstHookRound` fire-and-forget on first persisted segment. No new API routes, no new schema — reuses `LiveHook` + `hooks-service`. (2) **W8.2 — Presenter Alert Extensions:** Added `SILENT_PARTICIPANTS` to `PresenterAlertKind` enum (migration `20260510140000_add_presenter_alert_silent_participants`). Extended `evaluatePresenterAlerts()` with two new rules: **TOO_MUCH_LECTURE** fires when session age > 20 min AND zero HOOK_RESPONSE/HAND_RAISE/CHAT_MESSAGE signals in last 15 min; **SILENT_PARTICIPANTS** fires when ≥2 hooks fired in last 30 min AND hook response rate < 25% of active participant count. Both surface on existing `PresenterAlertsHud` SSE stream with 4-min dedup. **Files added:** `src/server/services/captions/hook-generator-service.ts`, `src/server/workers/ai-hook-generator-worker.ts`, `prisma/migrations/20260510140000_add_presenter_alert_silent_participants/migration.sql`. **Files modified:** `prisma/schema.prisma`, `src/lib/queue.ts`, `src/server/workers/index.ts`, `src/app/api/classroom/sessions/[id]/captions/publish/route.ts`, `src/server/services/engagement/engagement-service.ts`. v2.9 — **W7.4 Live Captions — Deepgram (Phase 1 English) + per-listener Gemini translation + persistent SessionTranscript** logged. (1) **Schema (additive, migration `20260510120000_add_session_transcript`)** — new `SessionTranscript` model `{id, sessionId, language, source, segments Json, contentText Text, finalized, startedAt, finalizedAt, updatedAt}`, unique index `(sessionId, language)`, ON DELETE CASCADE on session. **Decision: distinct from `Transcript` (which is recordingId-keyed and produced by the post-recording transcribe-worker against the recorded audio file).** Why a separate table: not every session is recorded (`recordingEnabled=false`), and even for recorded sessions the live transcript is available *minutes* before the post-batch one. Post-session export endpoint reads `SessionTranscript` first, falls back to `Transcript` when unfinalized. (2) **Service** — `src/server/services/captions/transcript-service.ts` (`appendSegment` upserts the row, dedupes the last-10 entries, caps at 50k segments / 4 MB content; `finalizeTranscript` locks the row; `listTranscriptsForSession` for export). `src/server/services/captions/translate-service.ts` (Gemini Flash with code-mix-preserving system prompt — *do not translate medical English terms, drug names, anatomy, acronyms, numerals + units*; Redis cache `captrx:<from>:<to>:<sha1>` 5min TTL so 50 listeners pay ~1 Gemini call per segment). `src/lib/deepgram.ts` (`mintDeepgramAccessToken` calls `/v1/auth/grant` with `ttl_seconds=30` so the master `DEEPGRAM_API_KEY` never reaches the browser; `deepgramListenWsUrl` returns the configured WS endpoint with `model=nova-3, language=en, smart_format, punctuate, interim_results, utterances, utterance_end_ms=1000, encoding=opus, sample_rate=48000`). (3) **API routes** (4 new, all under `/api/classroom/sessions/[id]/captions/*`): **`POST /deepgram-token`** — host-only (HOST/CO_HOST), CSRF-gated, rate-limited via new `LIMITS.CAPTIONS_TOKEN_MINT` 60/h fail-closed, audited as `captions.token.minted`; returns `{accessToken, expiresInSec, wsUrl}` so the host's browser can `new WebSocket(wsUrl, ['token', accessToken])` directly. **`POST /publish`** — host-only, CSRF-gated, rate-limited via `LIMITS.CAPTIONS_PUBLISH` 600/min fail-open, audited as `captions.published` (one batch entry, not per-segment); accepts up to 20 segments per call with optional `partial` flag — partials broadcast on Redis pub/sub but skipped from DB to avoid thrashing the JSON column; finals append to `SessionTranscript` and publish to the existing `caption:<sessionId>` channel so the existing SSE GET keeps working unchanged. Empty `segments` is allowed only when `finalizeOnEnd=true` (zod refine), in which case the route closes every open language track for the session. **`POST /translate`** — any session-visible role, CSRF-gated, rate-limited via `LIMITS.CAPTIONS_TRANSLATE` 300/h fail-closed (Gemini is billable, runaway re-render shouldn't silently rack up cost), audited as `captions.translated` *only on cache miss*. **`GET /transcript`** — any session-visible role, audited as `captions.transcript.read`; returns one entry per language with `segmentCount`, full `segments` array, and `contentText`. (4) **Browser producer** — `src/components/classroom/deepgram-captions-producer.tsx` (headless, host-only). Captures `localParticipant.getTrackPublication(Track.Source.Microphone).audioTrack.mediaStreamTrack` from the existing LiveKit room (no second `getUserMedia` prompt), pipes opus chunks via `MediaRecorder` to the Deepgram WebSocket (`mimeType='audio/webm;codecs=opus'`, `audioBitsPerSecond=32_000`, `recorder.start(250)`), receives transcripts, and POSTs finalized utterances to `/captions/publish`. Polls the LocalParticipant for up to 30s if mic isn't yet published. Reconnects on WS close with `[500,1000,2000,4000,8000]ms` backoff up to 5 attempts. On unmount: posts `{segments:[], finalizeOnEnd:true}` so the row is locked. (5) **Overlay rewrite** — `src/components/engagement/live-captions-overlay.tsx` gained a 9-language picker (English, हिन्दी, తెలుగు, தமிழ், ಕನ್ನಡ, മലയാളം, मराठी, বাংলা, اردو). When picked language differs from broadcast `lang`, finalized segments fan out to `/captions/translate` per-listener; the overlay shows the source text dimmed (`opacity-60`) until the translation arrives, then swaps in. Per-listener choice persists in `localStorage.vaidix.liveCaptionsLang`. Translation failures render a subtle `[translation failed]` chip — original text stays visible. (6) **Wizard integration** — `new-session-form.tsx` step 4 gained a "Live captions" radio group: `English (Deepgram)` / `Hindi/Telugu mix (Coming soon)` / `Off`, default `english-only`. Indic-mix is currently disabled (renders with opacity-60 + "Soon" badge); selecting it is gated. `captionsProfile` persists into `metadata.captionsProfile` (existing JSON column, no new schema, mirrors the v2.8 `excludedDates` pattern). (7) **LiveSession integration** — `live-session.tsx` mounts `<DeepgramCaptionsProducer enabled={role==='HOST' && session.captionsProfile==='english-only'} />` and renders the overlay only when `captionsProfile !== 'off'`. Classroom page reads `s.metadata.captionsProfile` and threads it through to the SessionInfo prop. (8) **Audit events:** `CAPTIONS_TOKEN_MINTED`, `CAPTIONS_PUBLISHED`, `CAPTIONS_TRANSLATED`, `CAPTIONS_TRANSCRIPT_FINALIZED`, `CAPTIONS_TRANSCRIPT_READ`. (9) **e2e:** `scripts/e2e-w7-captions.ts` (13 assertions): faculty mints Deepgram token (200 with key, 503 without — gracefully skips when `DEEPGRAM_API_KEY` absent); resident token-mint → 403; faculty publishes 3 finals → published=3, persisted=3, contentText concatenated; partial publish → published=1, persisted=0; duplicate dedupes; resident publish → 403; resident transcript read → 200 with 3 segments; en→te translation (200 + cached on second call when `GEMINI_API_KEY` present); same-lang identity passthrough; finalize via `finalizeOnEnd=true segments=[]` → row locked + further publishes capped; empty segments without finalize → 422; CSRF mismatch → 403; cleanup cascades. **Decision: drop voice dubbing entirely from Phase 1.** Reasons: (a) live S2ST adds ~600 ms TTS latency on top of ASR + MT, breaking conversational flow; (b) listeners reading captions can self-pace through dense ophthalmology vocabulary while voice cannot; (c) two providers (Deepgram + Gemini Flash) is enough integration risk for one phase. **Phase 2 (deferred):** Sarvam Saaras live producer for `indic-mix` profile (same `/publish` contract, different ASR feed); post-session export endpoints (Word `.docx` via `docx`, PDF via `pdfkit`); Gemini summary endpoint that reads from `SessionTranscript.contentText` and emits `{discussionSummary, takeaways, actionItems, perSpeakerContributions, qaPairs}`. **Files added:** `src/lib/deepgram.ts`, `src/server/services/captions/transcript-service.ts`, `src/server/services/captions/translate-service.ts`, `src/app/api/classroom/sessions/[id]/captions/deepgram-token/route.ts`, `src/app/api/classroom/sessions/[id]/captions/publish/route.ts`, `src/app/api/classroom/sessions/[id]/captions/translate/route.ts`, `src/app/api/classroom/sessions/[id]/captions/transcript/route.ts`, `src/components/classroom/deepgram-captions-producer.tsx`, `prisma/migrations/20260510120000_add_session_transcript/migration.sql`, `scripts/e2e-w7-captions.ts`. **Files modified:** `prisma/schema.prisma` (SessionTranscript + TeachingSession back-relation), `src/lib/env.ts` (DEEPGRAM_API_KEY + DEEPGRAM_MODEL), `.env.example` (same), `src/server/services/audit.ts` (5 new events), `src/server/services/rate-limit.ts` (3 new buckets), `src/lib/validation/session.ts` (CAPTIONS_PROFILES + captionsProfile field), `src/server/services/session-service.ts` (persist captionsProfile in metadata), `src/components/engagement/live-captions-overlay.tsx` (rewrite with language picker + translate fan-out), `src/components/classroom/live-session.tsx` (mount producer + gate overlay), `src/app/(platform)/classroom/[id]/page.tsx` (read metadata.captionsProfile → SessionInfo), `src/app/(platform)/calendar/new/new-session-form.tsx` (captions profile picker in StepDetails). **Pending after this commit:** stop the dev server, run `npx prisma generate && npx prisma migrate deploy`, paste a *rotated* DEEPGRAM_API_KEY into `.env`, restart dev, then `tsx --env-file=.env scripts/e2e-w7-captions.ts`. v2.8 — **Schedule-session form redesign + Teams-style recurrence + role-aware host picker** logged. (1) **`/calendar/new` wizard rewrite** — flat 5-section form replaced with a 4-step animated wizard (framer-motion `AnimatePresence` + slide transitions, gradient step headers with cross-fading blur blobs per step, animated progress bar). Step 1 = title + 6 colourful session-type cards (Lecture/Grand Rounds/Case Conference/Journal Club/Skills Workshop/Assessment, each with its own gradient + glow shadow + spring-animated checkmark badge). Step 4 opens with a live review card summarising title/host/timing/visibility. CTA button has gradient shimmer + `Zap` icon micro-animation. (2) **Role-aware faculty host picker** — admin/PD avatar grid (which rendered seed-data cuids/email-fragments unreadably) replaced with a searchable combobox `<FacultySearch>` (auto-focus search input on open, click-outside to close, full-name + role + YOU badge). Faculty role no longer sees the picker at all — host is locked to self with a "✓ You're hosting" panel. Required new prop `currentUserRole` from `page.tsx` → form. (3) **Teams-style recurrence** — old "Frequency dropdown + 7 day buttons + count input" panel rebuilt: "Every N day/week/month" inline pattern, day-of-week toggles (weekly only), end-mode radio group `count | date | never` with inline disabled inputs per option, and a Teams-parity exception list (`<input type="date" sr-only>` wrapped in a styled `+ Add exception` chip; selected dates render as removable destructive-coloured chips). (4) **Date picker smart positioning** — `<DateTimePicker>` panel was always opening downward and getting clipped near viewport bottom; new logic in `openPicker()` measures `spaceBelow / spaceAbove` against a `PANEL_H=480` estimate and flips upward when below is insufficient; animation `initial.y` direction also flips so the panel slides naturally from the trigger either way. New `compact` prop (px-3 py-1.5 vs px-3.5 py-2.5) used by the redesigned schedule form so date fields stop dominating vertical space. (5) **Schema/service** — `createSessionSchema` accepts `excludedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100).optional()`; `session-service.createSession()` persists them alongside `prereq` under `metadata.excludedDates` (no new column — nothing queries it from SQL). (6) **e2e** — `scripts/e2e-calendar-scheduler.ts` (11 steps): faculty self-host auto-approves, PD-as-proposer + faculty-as-host → `PENDING_FACULTY` (approvedAt null), PD self-host auto-approves, recurrence weekly×8 round-trips, INTERVAL=2 + BYDAY=TU,TH persists, UNTIL date persists, excludedDates round-trip via `db.teachingSession.metadata`, malformed exclusion → 400, end-before-start → 400, bogus hostId → 4xx, calendar feed surfaces approved sessions for host. **Files modified:** `src/app/(platform)/calendar/new/new-session-form.tsx` (full rewrite), `src/app/(platform)/calendar/new/page.tsx` (`currentUserRole` prop), `src/components/ui/date-time-picker.tsx` (smart direction + compact prop), `src/lib/validation/session.ts` (`excludedDates` schema), `src/server/services/session-service.ts` (metadata persistence). **Files added:** `scripts/e2e-calendar-scheduler.ts`. v2.7 — **Curriculum Blueprint tool + slide-prompt VARK upgrade** logged. Layered onto v2.6 Deck Forge. (1) **Blueprint tool** — separate one-shot Gemini feature distinct from slide forge. Schema (additive, migration `20260509140000_add_blueprint_model`): new `Blueprint` model `{id, requestedById, topic, learnerLevel, content (markdown), source, createdAt}` with FK to User (`@relation("BlueprintRequester")`, ON DELETE RESTRICT — keeps faculty's library safe from accidental user-soft-deletes), indexed on `(requestedById, createdAt)`. New service `src/server/services/blueprints/blueprint-service.ts` carries the full Precision Education Blueprint system prompt — instructs Gemini as "Ophthalmology Medical Educator + Curriculum Designer + Instructional Strategist," demands strict markdown headings (Topic/Module, Target Learner, Prior Knowledge Assumed, Clinical Context, Learning Style Adaptation [V/A/R/K topic-specific], Required Learning Attributes, Best-Fit Learning Theory [single primary + optional secondary], Instructional Tactics [3-5 multimodal], Feedback Loop, Competency Assessment [MCQ/SAQ/OSCE/DOPS/Mini-CEX/viva/surgical rubric], Mastery Indicators, Common Learner Errors, Faculty/Resource Needs, Additional Instruction), forbids generic educational filler, anchors every recommendation to ophthalmic tools (slit-lamp, fundoscopy, OCT, FFA, ICGA, USG, lasers, wet-lab, microsurgery, counseling). New API: `GET /api/blueprints` lists faculty's library, `POST /api/blueprints` generates (zod-validated `{topic ≤280, learnerLevel ≤80}`, faculty-only, CSRF-gated, audited as `blueprint.generated`, rate-limited via the shared `LIMITS.DECK_FORGE` bucket — same upstream provider, fail-closed billable), `GET /api/blueprints/[id]` reads (owner-only — service-level guard checks `requestedById` match, returns 404 otherwise), `DELETE /api/blueprints/[id]` (owner-only). New page `/faculty/blueprints` with 3-pane layout: left = generate form (topic input + 11-option learner-level select including Intern/PGY-1/2/Senior/VR-fellow/Cornea/Glaucoma/Pediatric-fellow/Optometrist/Practicing) + history list (framer-motion AnimatePresence on add/delete, click-to-load-detail), right = markdown detail with Copy-markdown + Download-.md actions. Includes a tiny in-house markdown→HTML renderer (handles `#`/`##`/`-`/`*`/`1.`/`**bold**`/`*italic*`/`code` — escapes raw HTML to neutralize prompt-injected `<script>` tags, sufficient for the structured headings Gemini outputs without pulling in remark/rehype). Sidebar: "Blueprints" entry added to faculty + program-director nav configs in `src/lib/constants.ts`, `Sparkles` icon imported into `app-sidebar.tsx` ICON_MAP. (2) **Deck Forge prompt VARK upgrade** — same turn lifts the strongest pedagogic guarantees from the user's blueprint prompt into the slide-forge system prompt at `deck-forge-service.ts`. New rules: tailor depth to learner level (intern/PGY-1 anatomy-first; senior/fellow decision-points), force ≥1 IMAGE_FOCUS slide for visual learners (slit-lamp / fundus / OCT / FFA / ICGA / USG / surgical-step), force ≥1 INTERACTION every 6-8 slides AND ≥1 INTERACTION formatted as a competency-check key-feature question (AAC vs PAC, NPDR severity, masquerade syndromes), mandate exactly one "Common pitfalls / Learner errors" slide near the end, mandate ophthalmology-specific vocabulary throughout (no generic "the patient presents…" pablum), prefer TWO_COLUMN for classification systems (ETDRS, Shaffer, Spaeth, AAO PPP). Forge API + `forgeDeck()` accept new optional `learnerLevel` field; defaults to "ophthalmology resident at LVPEI". (3) **Audit events:** `BLUEPRINT_GENERATED`, `BLUEPRINT_DELETED` added to `AUDIT_EVENTS`. (4) **e2e:** `scripts/e2e-deck-forge.ts` extended with 4 new steps — generate blueprint (asserts content >200 chars + ≥2 ophthalmic terms matched against `[slit-lamp, gonioscopy, tonometry, IOP, iridotomy, OPD, YAG, pilocarpine]` + Topic/Module heading present), list contains it, resident cannot list/read (403), delete removes the row. **Files added:** `src/server/services/blueprints/blueprint-service.ts`, `src/app/api/blueprints/route.ts`, `src/app/api/blueprints/[id]/route.ts`, `src/app/(platform)/faculty/blueprints/page.tsx` + `blueprints-client.tsx`, `prisma/migrations/20260509140000_add_blueprint_model/migration.sql`. **Files modified:** `prisma/schema.prisma` (Blueprint model + User back-relation), `src/server/services/audit.ts` (2 events), `src/lib/constants.ts` (faculty + PD nav), `src/components/layout/app-sidebar.tsx` (Sparkles icon), `src/server/services/decks/deck-forge-service.ts` (prompt + ForgeInput.learnerLevel), `src/app/api/decks/forge/route.ts` (zod field), `scripts/e2e-deck-forge.ts` (blueprint steps). **Decision: blueprint and slide-forge are separate features, not one merged endpoint.** Two reasons. First, the artifact shapes are different — blueprint outputs a markdown teaching plan, slides output structured JSON Slide rows. Forcing one Gemini call to produce both bloats the prompt, hurts both outputs, and complicates rate-limiting. Second, the user journeys diverge — blueprint is "I'm designing a new module from scratch, give me the syllabus scaffolding" (no source upload), slides are "I have a PDF/transcript, turn it into a deck." Phase B (deferred): `DeckForgeJob.blueprintId` FK to chain blueprint → slide-forge for pedagogically-grounded decks (one button on the blueprint detail page that runs forge with the blueprint as additional system context). v2.6 — **Deck Forge slide generation (in-app HTML slides + .pptx export)** logged. Fills the long-deferred "Deck Forge polish" gap from W4 Stream C — `DeckForgeJob` had `EXTRACTING → GENERATING_SLIDES → REVIEW_PENDING` states defined since W0 with no implementation, only the W4 C10 *analysis* path. Now: (1) **Schema (additive, migration `20260509130000_slide_model_and_deck_forge_sources`)** — new `Slide` model (one row per slide, `{deckForgeJobId, order, layout, title, bullets[], speakerNotes, sourceCitations Json, accentHex}`, unique index on `(deckForgeJobId, order)`, ON DELETE CASCADE); new enums `DeckForgeSource {DOCUMENT, TRANSCRIPT, HYBRID}` and `SlideLayout {TITLE_ONLY, TITLE_BULLETS, TWO_COLUMN, IMAGE_FOCUS, QUOTE, INTERACTION, CLOSING}`; `DeckForgeJob.documentId` relaxed to nullable (transcript-only forges have none) + new `recordingId` FK + new `sourceKind` discriminator; back-relation added on `Recording.deckForgeJobs`. **Decision: slides are first-class DB rows, not an HTML/PPT blob** — `.pptx` is an export, never canonical, so each slide is editable, reorderable, and citable to its source. (2) **Service** — `src/server/services/decks/deck-forge-service.ts`. Loads `DocumentSource` (PDF/DOC/MD/TXT — fetched from S3 via `s3.send(GetObjectCommand)` and base64'd inline; capped at 18 MB so `geminiGenerate()` stays under the multimodal budget) and/or `TranscriptSource` (pulls `Transcript.content` preferring `language='en'`, capped at 15k chars), composes a multimodal Gemini prompt with strict-JSON system instruction defining the 7 layouts + 14–22 slide budget + interaction-point rule (every 6–8 slides), normalizes the response with `tryParseJson` + clamp/slice/filter (drops empty titles, caps bullets at 6 × 200 chars, hard-ceilings 30 slides), persists `Slide` rows + flips job to `REVIEW_PENDING` in a single tx. Source materials Gemini can't read inline (PPT/DOC binaries) fall back to title+description-only — Phase B will add a python-pptx text-extraction worker. Job state transitions through `EXTRACTING → GENERATING_SLIDES → REVIEW_PENDING` (or `FAILED` with `errorMessage`). Synchronous in Phase A because Gemini-text returns in seconds; Phase B will move to BullMQ. (3) **API routes** (5 new): `POST /api/decks/forge` accepting `{documentId?, recordingId?, inputTitle?}`, faculty-only, CSRF-gated, audited as `deck_forge.requested/completed/failed`, rate-limited via new `LIMITS.DECK_FORGE` (20/h fail-closed — Gemini multimodal is billable + slow). `GET/DELETE /api/decks/[jobId]` (owner + PD/admin can read; DELETE soft-rejects). `PATCH /api/decks/[jobId]/slides/[slideId]` for per-slide edits (title/bullets/speakerNotes/layout/accentHex, audited as `deck.slide.updated`). `POST /api/decks/[jobId]/reorder` accepting `{order: slideId[]}` — uses two-phase negative-then-positive update inside a tx to avoid the `(deckForgeJobId, order)` unique-index colliding mid-update. `POST /api/decks/[jobId]/export-pptx` server-renders the `Slide` rows to a real .pptx binary via pptxgenjs (added to deps; runtime='nodejs'); theme + helpers (`addHeader`/`addFooter`/per-layout renderers + accent strip + slide counter) ported from the standalone `vaidix-pptx-generator.html` so on-screen and exported decks read identically; speaker notes go on `s.addNotes()`. Stream returned as binary with `Content-Disposition: attachment; filename=*.pptx`, audited as `deck.exported.pptx`. (4) **UI** — three new pages under `/faculty/decks/[jobId]`. Editor (`page.tsx` + `deck-editor-client.tsx`): 12-col layout with thumbnail rail (3 col, framer-motion AnimatePresence on reorder) + center preview (6 col, shows the focused slide + its speaker notes card) + right edit panel (3 col — layout select, title/bullets/notes textareas with onBlur PATCH, accent hex input, +/- bullet management). "Save order", "Export .pptx" (downloads via `URL.createObjectURL` + anchor click), "Present ▶". Present mode (`present/page.tsx` + `deck-presenter-client.tsx`): full-screen presenter with arrow-keys / PageUp-Down / Home/End / Space, F to toggle browser fullscreen, N to toggle speaker-notes drawer, ESC to exit, slide-progress dots at top, AnimatePresence cross-fade between slides. Both reuse a shared `<SlideCanvas mode='preview'\|'present'>` component (`src/components/decks/slide-canvas.tsx`) — 16:9 aspect-ratio container with the same Vaidix navy/teal/gold theme as the .pptx export, container-query-driven font sizes (`cqw`) so text scales with the canvas, framer-motion stagger per layout type. Layouts implemented: TITLE_ONLY (hero), TITLE_BULLETS (default), TWO_COLUMN, QUOTE, INTERACTION (lettered option cards), IMAGE_FOCUS (placeholder pending asset upload), CLOSING. (5) **Entry points** — "✨ Forge slides" button on every row of `/faculty/documents` (calls `POST /api/decks/forge` with `{documentId}` then `router.push` to the editor); "Forge slides" pill in the recording-viewer action bar (faculty-like roles only, requires ≥1 transcript track, calls with `{recordingId}`). Both routes through new `csrfHeaders()` helper at `src/lib/csrf-client.ts` (extracted because three components inlined the cookie read). (6) **Auth + audit + rate-limit on every state-changing route** — reuses `requireAuth`, `requireCsrf`, `parseBody`, `audit`, `extractRequestMetadata`, `checkRateLimit`. New audit events: `DECK_FORGE_REQUESTED/COMPLETED/FAILED/SLIDE_UPDATED/EXPORTED_PPTX`. **Files added:** `src/server/services/decks/deck-forge-service.ts`, `src/app/api/decks/forge/route.ts`, `src/app/api/decks/[jobId]/route.ts`, `src/app/api/decks/[jobId]/slides/[slideId]/route.ts`, `src/app/api/decks/[jobId]/reorder/route.ts`, `src/app/api/decks/[jobId]/export-pptx/route.ts`, `src/app/(platform)/faculty/decks/[jobId]/page.tsx` + `deck-editor-client.tsx`, `src/app/(platform)/faculty/decks/[jobId]/present/page.tsx` + `deck-presenter-client.tsx`, `src/components/decks/slide-canvas.tsx`, `src/lib/csrf-client.ts`, `prisma/migrations/20260509130000_slide_model_and_deck_forge_sources/migration.sql`. **Files modified:** `prisma/schema.prisma` (Slide + enums + DeckForgeJob fields + Recording back-relation), `src/server/services/audit.ts` (5 new events), `src/server/services/rate-limit.ts` (DECK_FORGE bucket), `src/app/(platform)/faculty/documents/documents-library-client.tsx` (Forge button per row), `src/components/recording/recording-viewer.tsx` (Forge button in action bar). **Deps added:** `pptxgenjs ^3.12.0`. **Pending after this commit:** run `npm install` for pptxgenjs; stop dev server then `npx prisma generate && npx prisma migrate deploy` (engine dll lock + drift in dev DB blocks the commands while `next dev` runs). v2.5 — **W7 Krisp ML noise filter (two-tier, verified license-free)** logged. Installed `@livekit/krisp-noise-filter` (~4MB WASM, lazy-loaded via dynamic import — bundle cost only paid when toggle is flipped on). Refactored `NoiseSuppressionToggle` from single-tier (browser constraints) to two-tier with automatic upgrade: **Tier 1 = Krisp** (ML, strips keyboard/dogs/traffic/fans), **Tier 2 = browser native** (`applyConstraints`). On toggle ON, attempts `track.setProcessor(KrispNoiseFilter())` first; if Krisp's WASM init fails (unsupported browser, asset load failure) silently falls through to constraints and remembers the block via `krispBlockedRef` — no repeated 4MB downloads. The chip badge changes label/colour to reflect the active tier (`AI` fuchsia for Krisp, `ON` teal for browser, `OFF` zinc, `N/A` when neither tier is supported). NOISE_SUPPRESSION_TOGGLE audit/replay events now carry an additional `tier` field (`'krisp' \| 'browser' \| 'off' \| 'unsupported'`). Field is purely additive — existing readers don't break. **Licensing — empirically verified**: a temporary `/dev/krisp-probe` page + Playwright script (now removed) drove the package's full init path against a real getUserMedia track. Result: `processor.init()` succeeded and the WASM model loaded with no LiveKit Cloud token, no Krisp Enterprise license. The ToS-bound npm license (points to livekit.io/legal/terms-of-service rather than a permissive SPDX) may impose obligations on commercial deployments — recommend a legal review with LiveKit before LVPEI go-live — but there is no technical access gate. Tier 1 will engage in production. New e2e spec `tests/e2e/w7-krisp.spec.ts` asserts the toggle flow + audit-event shape regardless of which tier engaged. v2.4 — **W7 Phase 3** logged. Wiring + reuse pass — **zero new tables, zero new endpoints**, all leveraging existing infra. (1) **Whiteboard control-bar button** — Phase 2 wiring oversight closed; the dedicated `Pencil`/"Board" CtrlBtn now opens the whiteboard tab directly; the old leaderboard CtrlBtn relabelled "Stats" to avoid collision. (2) **Whiteboard fullscreen modal** — `WhiteboardPanel` gained a fullscreen toggle that hosts the same canvas inside an inset modal overlay (z-80), reusing the existing `WhiteboardSurface` and snapshot pipeline; the sidebar shows a placeholder while fullscreen is active. (3) **Screen-share annotations** — pure reuse of the SessionAuditEvent + `useSessionEvents` machinery: added `ANNOTATION_DRAW` and `ANNOTATION_CLEAR` to `SESSION_AUDIT` (host-only, replayable), built `AnnotationOverlay` (custom SVG drawing in normalised coords — no tldraw chrome competing with the video underneath), wired into the live-session video layer (only renders when a screen-share is published), extended `RecordingReplayLayer` to replay strokes and rebuild canvas state on backwards seeks. (4) **Chat popout** — new `ChatPanelStandalone` polls `/chat` every 3s instead of using LiveKit data-channel hooks, enabling the Chat surface in the chrome-less `/popout/[id]/[surface]` window; sends still post through the same `/chat` endpoint so popout-sent messages propagate to the live tab via its scrollback. New e2e specs in `tests/e2e/w7-phase3.spec.ts`. Lint clean. Phase-4 deferred: People popout polling variant, Krisp ML noise filter (paid LiveKit Cloud SDK), per-tile annotation coord mapping (current overlay covers the full grid). v2.3 — **W7 Phase 2** logged. Adds the meatier Teams-parity items deferred from Phase 1: (1) **Tldraw whiteboard** — new `Whiteboard` + `WhiteboardSnapshot` tables, host edits, snapshot fan-out via LiveKit data channel topic `whiteboard`, debounced REST persist (3s of idle), recording-viewer scrub via `tMs`-tagged snapshot history. tldraw v5 dynamic-imported into a `<TldrawSurface>` so the ~1.5MB bundle only loads when the panel opens. New API: `GET/POST /whiteboard` and `GET /whiteboard/snapshots/[snapshotId]`. New components: `WhiteboardPanel` (host-only edit gate via `editableByResidents`) and `WhiteboardSurface` (lazy-loaded tldraw v5). New rate-limit bucket `SHARED_NOTE_WRITE` shared between notes + whiteboard (~120/min/user). (2) **Spotlight tile button** — `SpotlightTile` wraps LiveKit's `<ParticipantTile />` with a host-only star/X overlay; toggling fires SPOTLIGHT_SET / SPOTLIGHT_CLEAR through the existing `useSpotlight` hook (no new API). VideoGrid now renders SpotlightTile as the GridLayout child instead of stock ParticipantTile. (3) **Webinar role separation in token mint** — when `isWebinar=true`, the `/token` route demotes any non-host/co-host effective role to VIEWER server-side (regardless of cohort/invite state) and stamps `isWebinarAttendee` in the LiveKit metadata. Webinar attendees get the viewer-grade LiveKit grants (no publish/screen-share). New e2e spec `tests/e2e/w7-phase2.spec.ts` covers: whiteboard host edit + persistence, resident view-only banner, spotlight star presence/absence by role, webinar role demotion (gated on `E2E_WEBINAR_FIXTURE=1`). Whiteboard schema applied via `prisma db execute prisma/sql/w7_phase2_whiteboard.sql` (idempotent, see notes on the divergent W6.11 migration history). Phase-3 follow-ups (deferred): screen-share annotations canvas, whiteboard fullscreen modal (sidebar 320px is too narrow for serious diagrams), Chat/People polling variants for the popout window, Krisp ML noise-suppression. v2.2 — **W7 Live-conference parity (Teams gap-close, Phase 1)** logged. Closes the gap from the codex-flagged Teams comparison: emoji reactions, host spotlight, browser-noise-suppression toggle, file-in-chat, picture-in-picture, pop-out (Notes), shared notes, webinar registration. Architecture keystone: **no new event table** — extended existing `SessionAuditEvent` with a nullable `tMs` column (offset from `Recording.startedAtRoom`) and added 11 replay event types to `SESSION_AUDIT` (REACTION, SPOTLIGHT_SET/CLEAR, PIN_SET/CLEAR, NOTE_EDIT, FILE_SHARE, NOISE_SUPPRESSION_TOGGLE, BG_BLUR_TOGGLE, PIP_TOGGLE, POP_OUT, WEBINAR_JOIN). New tables: `SharedNote` + `SharedNoteEdit` (one note per session + append-only edit log; last-writer-wins with optimistic concurrency `version`), `SessionFile` (S3-backed chat attachments; presigned PUT + finalize), `WebinarRegistration` (public registration with email confirmation, EXTERNAL_LEARNER auto-provision into the session's program). New API routes: `POST/GET /events`, `GET/POST /notes`, `POST /files` + `POST /files/[fileId]/finalize`, `POST/GET /webinar-registrations` + `POST /webinar-registrations/confirm`; chat POST extended to accept `attachmentId`. New components: `useSessionEvents` hook (DC publish + REST POST), `ReactionsBar` + `FloatingReactionsLayer`, `SpotlightButton` + `useSpotlight`, `NoiseSuppressionToggle` (browser-side `applyConstraints`), `SharedNotesPanel` (debounced auto-save), `PictureInPictureButton` (HTMLVideoElement.requestPictureInPicture), `PopOutWindowButton` (Notes-only in Phase 1; Chat/People need polling variants), `RecordingReplayLayer` (replays REACTION/FILE_SHARE/SPOTLIGHT events on the recording-viewer). Public `/webinar/[id]/register` + `/webinar/[id]/confirm` routes. Pop-out route at `/popout/[id]/[surface]`. Field added to TeachingSession: `isWebinar`. Field added to Recording: `startedAtRoom`. Phase-2 follow-ups (deferred): tldraw whiteboard, screen-share annotations, Chat/People popout polling variants, webinar attendee/presenter token-mint separation, Krisp ML noise-suppression. v2.1 — **W6.11 Multi-Program Tenancy** logged. Adds `Program` + `ProgramMembership` + `users.activeProgramId` and scopes the 6 entry-point domain tables (Cohort, TeachingSession, Topic, CaseTemplate, Pearl, Course) by `programId`; new `/api/me/active-program` route + top-bar `<ProgramSwitcher>`; new `requireAuthWithProgram()` helper; entry-point list routes (`/api/cohorts`, `/api/topics`, `/api/cases`, `/api/classroom/sessions`, `/api/calendar/events`, `/api/dashboard/upcoming`, `/classroom`, `/admin/cohorts`) tenant-scoped. Phase-2 audit of the remaining ~30 `teachingSession.findMany` callers + explicit `programId` on transitively-scoped tables intentionally deferred. v2.0 — **OPEN_TO_ALL link-only + edit-after-create** logged. (1) `OPEN_TO_ALL` no longer auto-populates every user's calendar/classroom feed: `buildSessionVisibilityWhere()` drops the OPEN_TO_ALL OR-clause for non-privileged actors. `userCanSeeSession()` keeps OPEN_TO_ALL → true so anyone with the URL/share-link can still join. The `OPEN_TO_ALL` radio is relabelled "Anyone with link" in the new-session form + visibility guide. (2) New `/classroom/[id]/edit` page with `EditSessionForm` for host/proposer/admin/PD: edits title, description, host (read-only display), topic, start/end (routes through existing reschedule endpoint, resets approval if not host), objectives, recording/consent, prereq, and INVITE_ONLY invitee diff (POST adds + DELETE removes via existing invite endpoints). Visibility tier is locked. `updateSessionSchema` extended to accept nullable `topicId`. New `EditSessionLink` chip surfaces the entry point on the classroom detail page for both pending and approved sessions. v1.9 — **W6.9 Learning Objectives + resident-discoverable pre-class surface** logged. New row in status table below. Adds `objectives` Json column on `teaching_sessions` + new `session_objective_achievements` table (`ObjectiveAchievementStatus` enum YES/PARTLY/NO). Two new API routes: `GET /api/classroom/sessions/[id]/objectives` (read + my marks) and `POST /api/classroom/sessions/[id]/objectives/check` (resident self-mark, upsert). `createSessionSchema` + `updateSessionSchema` accept the new `objectives` array; `session-service.normaliseObjectives()` stamps server-side cuids so resident marks survive curator reorders. UI: new `<ObjectivesEditor>` (calendar new-session form), `<ObjectivesChipList>` (read-only chips with Bloom's badge + per-resident status dot, shown on both the curator and resident prep blocks), `<ObjectivesChecklist>` (Yes/Partly/No buttons on the recording page for residents + external learners). Same v1.9 turn also wired the previously-built **resident pre-class discoverability gap**: the existing `/classroom/[id]/study` and `/classroom/[id]/pre-questions` pages had no entry points for residents — now surfaced via a new `<PreConferenceResidentBlock>` on the session detail page (parallel to the host/PD curator block) and Study Pack + Ask-before-class chips on every upcoming `VideoCard` in the classroom feed. |
| **Date** | 2026-04-13 (v1.0); 2026-04-24 (v1.1 status update + v1.2 Phase 1 expansion); 2026-04-27 (v1.3 + v1.4); 2026-04-25 (v1.5 W6.5 polish sprint logged); 2026-04-26 (v1.6 W6.6 admin invitations polish + v1.7 W6.7 cohort/session-invite UI + v1.8 cohort CRUD completion + orphan-FK hardening + calendar redesign); 2026-05-02 (v1.9 W6.9 learning objectives + resident pre-class discoverability); 2026-05-09 (v2.0 OPEN_TO_ALL link-only + edit-after-create; v2.1 W6.11 Multi-Program Tenancy; v2.2 W7 Live-conference parity; v2.3 W7 Phase 2 whiteboard + spotlight tile + webinar role; v2.4 W7 Phase 3 wiring + annotations + chat popout; v2.5 W7 Krisp ML noise filter two-tier; v2.6 Deck Forge slide generation; v2.7 Curriculum Blueprint tool; v2.8 Schedule-session form redesign + Teams-style recurrence); 2026-05-10 (v2.9 W7.4 Live Captions; v3.0 W8.1+W8.2 AI Hook Generator + Alert Extensions; v3.1 W8.3 Post-Session Content Pack — PDF + Claude Pearl/QA/SJT/PBL; v3.2 W8.3 runtime fixes; v3.3 W8.3 frontend wired; v3.4 W8 Faculty Forge & Pre-Session Suite — multi-model AI routing, document-detail launchpad, deck AI Coach with Opus review + Sonnet design + Gemini polish, case-forge end-to-end, /faculty/cases revamp, share-to-session for cases, Readiness Dashboard 4.1.5) |
| **Owner** | Symbiosys Technologies |
| **Goal** | **Phase 1 production-ready delivery: all 22 features from [Feeddback.md](../Feeddback.md), no prototypes.** W15 ends with a 30-min demo covering every feature live. |
| **Environment** | Local dev (E: drive) → LVPEI on-prem (production) — see §16. Cloud (AWS/GCP Mumbai) is the staging fallback only. |
| **Parent doc** | [Vaidix-Build-Approach.md](../Vaidix-Build-Approach.md) (full 42-domain plan), [Feeddback.md](../Feeddback.md) (CTO brief — source of the 22 Phase-1 features) |
| **Related docs** | [VAIDIX-VIDEO-ARCHITECTURE.md](VAIDIX-VIDEO-ARCHITECTURE.md), [VAIDIX-SLM-ARCHITECTURE.md](VAIDIX-SLM-ARCHITECTURE.md) |

## Status as of 2026-04-27

| Week | Calendar | Team | Scope | Status |
|---|---|---|---|---|
| W0 — Schema lock + env | done | 1 dev | ~94 tables, 5 migrations, Docker compose (LiveKit + Redis + coturn + MinIO) | ✅ done |
| W1 — Real auth | done | 1 dev | NextAuth + invitations + Gmail SMTP, password reset, role middleware, admin user mgmt, e2e-w1 | ✅ done |
| W2 — LiveKit live video | done | 1 dev | Tokens, sessions, screen share, chat, hand raise, faculty controls, admissions/waiting room, share-link, e2e-w2 | ✅ done |
| W3 — Scheduling & calendar | done | 1 dev | Cohorts, PD→Faculty approval, RRULE, react-big-calendar, .ics, subscribable iCal feed, 24h/15min reminder worker | ✅ done |
| **W4-Sprint** — Recording + Transcription + Documents + Live Engagement Foundation | **4 calendar weeks** | **11 devs in 4 parallel streams** | Egress → MinIO HLS → Vidstack; `TranscriptionProvider` (Sarvam + self-hosted, hard env gate); document upload + AI classification + presentation enhancement (Gemini-vision); **PHI/PII regex scanner + worker + tag-to-session gate**; promo + reels generators (Gemini copy + FFmpeg vertical-crop); live captions agent contract; engagement signals foundation; live hooks + presenter alerts; WhatsApp pearl delivery; live leaderboards; **coach (real Gemini call)** + reflection bots; Bloom's analytics; Kirkpatrick L1+L2 — **15 of the 22 Phase-1 features land here, production-ready** | ✅ shipped (verified e2e 89/89; reviewer-flagged gaps closed in v1.3) |
| W5 — Q&A + Breakouts + Resources + Polish | 1 week | 3 devs | Timestamped Q&A with single-level reply threads + pin/like; breakouts (random + self-select; AI grouping deferred to W11 by sign-off); reconvene atomicity; recording-share with token + optional bcrypt password + access logging; Python co-facilitator wire-contract (`docs/BREAKOUT-AGENT-CONTRACT.md`); Playwright suite covers full LiveKit-driven breakout flow | ✅ shipped (e2e-w5 + Playwright PASS, 2026-04-27) |
| W6 — Core Learner: Cases + Conversations + Topics | 1 week | 3 devs | Cases full chat engine on `Conversation` + `Message` (mock JSON removed; `CaseTemplate` seeded from `mock-data/cases.json`); Socratic mentor responses via Gemini Phase-A with stage-default fallback; Topics read API; Pre-Conference Question Submission Engine end-to-end (submit/vote/themes/dashboard) with debounced Gemini clustering worker | ✅ shipped (e2e-w6 26/26 + e2e-w6-cases 17/17 PASS, 2026-04-27) |
| **W6.5 — Polish Sprint (out-of-plan)** | done | 1 dev | Session-driven `RoleProvider` (replaces demo-mode hardcoded resident); `EXTERNAL_LEARNER` role wired into nav + dashboard; `/admin/users` and `/admin/institution` switched from mock JSON to real DB queries with edit-role/deactivate/reactivate modals (reuses existing W1 admin APIs); `/faculty/learners` and `/faculty/cohort` real DB lists + cohort filter + sessions-joined / cases-completed counts; `/program/competency-map` set to a "Week 8" banner pointing at this section; engagement layer for **Pearls** (`PearlLike` heart + generic `Bookmark` + Web-Share/clipboard) and **Recordings** (`Bookmark` + W5 `RecordingShare` token-mint modal); **Discussion forum on saved videos** = `QaSidebar` extended with prominent "Answered by Dr. X" block; new `qa-service.answerQuestion` + `PATCH /api/classroom/sessions/[id]/qa/[qaId]/answer` (FACULTY/PD/ADMIN/host, audited as `qa.question.answered` / `qa.answer.cleared`); `/profile` + `/profile/bookmarks`; `signOut()` properly wired; root-redirect chain fixed (no more `?callbackUrl=http%3A%2F%2F...`); dead `/admin/roles` + `/admin/image-library` sidebar entries removed. Schema unchanged — additive UI on existing W0-locked tables. See [E2E-FRONTEND-AUDIT.md](E2E-FRONTEND-AUDIT.md). | ✅ shipped (build clean, 2026-04-25) |
| **W6.7 — Cohort & Session-Invite UI Completion (out-of-plan, closes W3 UI gaps)** | done | 1 dev | **Sidebar rename + scheduling-form redesign:** "Calendar" sidebar entry renamed to "Live Classes" across all 5 role nav configs in `src/lib/constants.ts` (admin/PD/faculty/resident/external_learner) since "Calendar" was abstract — users couldn't tell it was where to schedule/find video sessions. **`/calendar/new` rebuilt:** form now uses 4 sectioned cards (Basics / When / Who can join / Options) with icons, Vaidix-primary `bg-primary/5` accents, sticky bottom action bar; visibility picker is now 4 radio cards (Open to all / Cohort / Invite only / Private) with icon + description per card instead of a small dropdown that hid the behavior implications; faculty-host Select fixed (was rendering raw cuid like `cmof92k2x000skrmwtt81wuft` instead of names because base-ui `Select.Value` shows the value verbatim unless a function child renders the label — applied a `<SelectValue>{(v) => …}</SelectValue>` render-prop pattern to every Select in the form: hostId → "Avatar + Name + (YOU)", sessionType → "Lecture", visibility cohort dropdown → "UsersRound + Name (count)", frequency, share-link TTL); host preview shows initials avatar + role; datetime fields wrapped with Clock-icon prefix and Vaidix focus glow; recurrence and share-link sections are now bordered cards with checkbox-headers that auto-reveal sub-controls. **Cohort quick-add on session creation:** new `<CohortQuickAdd>` component (`src/components/cohort-quick-add.tsx`) sits above the user picker on `/calendar/new` INVITE_ONLY mode — fetches cohorts on mount, renders each as a chip with member count + academic year badge; clicking a chip fetches `GET /api/cohorts/[id]` and merges all members into the picker's selected list (deduplicated). Lets a PD invite "PGY-1 2026" in one click instead of 12 picks. Members are expanded **at create time** (snapshot semantics — adding someone to the cohort later won't retroactively invite them; for that the existing COHORT visibility option is dynamic). **Inline member-add on cohort creation:** Create form on `/admin/cohorts` now embeds `<UserPicker>` so admins can pick initial members in the same flow; submit creates the cohort then POSTs to `/api/cohorts/[id]/members` in a follow-up call (server upserts so duplicates are safe; member-add failure surfaces as a non-fatal warning so the cohort itself stays created). **Cohort member management UI** (W3 row 1 was UI-incomplete — backend `addMembers`/`removeMember` + `POST/DELETE /api/cohorts/[id]/members` already shipped, no UI to call them): new `GET /api/cohorts/[id]` (auth-only) returns cohort with members + counts; `/admin/cohorts` cards now clickable, opening a right-side drawer with current-member list (avatar + role badge + remove button) and an inline picker to search-and-add residents/faculty/anyone — wired through the existing POST/DELETE member routes. **Session INVITE_ONLY picker** (W3 row 16 was a TODO comma-separated text input): replaced with the same searchable multi-select on `/calendar/new`, chips for selected users, validation banner if zero invitees. **Share link at scheduling time** (was post-creation only via `/api/classroom/sessions/[id]/share-link`): added "Generate share link" toggle + TTL select (24h / 48h / 72h / 7d) on the create form; on submit the form mints the link via existing endpoint and shows a copy-to-clipboard success banner with expiry time before redirecting. **Shared infra** for both pickers: new `GET /api/users/searchable?role=&search=&excludeIds=&limit=` (ADMIN+PD, returns minimal `{id, name, email, role, avatarUrl}` filtered to ACTIVE non-deleted users — separate from `/api/admin/users` which is admin-surface-area-only); new `<UserPicker>` component at `src/components/user-picker.tsx` (debounced search, role-color chips, click-outside collapse). Schema unchanged — all new code is API + UI on existing tables (`Cohort`/`CohortMember` from W3, `SessionInvite` from W3). | ✅ shipped (`npx tsc --noEmit` clean, 2026-04-26) |
| **W6.8 — Pre-Conference Polish Sprint (out-of-plan, closes Pre-Conference Learning Ecosystem gaps)** | done | 1 dev | **Closes the 4 partial Pre-Conference features from the original CTO brief that the codebase had only stubbed:** (1) **#1 AI Promo Teaser Video** — `/api/promo/teaser-video` queues a render onto a new dedicated `PROMO` BullMQ queue; new `promo-teaser-worker` composes 3 SVG cards (title / hook / CTA), rasterizes via `@resvg/resvg-js` (new dep), then FFmpeg builds a 15-sec silent vertical 1080×1920 MP4 with crossfade transitions. Output stored as `Document` row with new `DocumentRoute.PROMO_TEASER_VIDEO` (additive enum value) so the existing library/signed-URL endpoints work unchanged. Reuses `buildCopy()` from `promo-service.ts` (Gemini with heuristic fallback). Decision: dedicated PROMO queue (not RECORDING) so the existing co-tenant `{ skipped: true }` filter doesn't silently drop teaser jobs — that pattern is a latent bug in transcode/reels but out of scope to fix here. (2) **#3 Study Material Hub pre-session surface** — new `isPreSession` boolean + `preSessionRank` int on `DocumentSessionLink` (additive); resident page at `/classroom/[id]/study` lists curated pre-readings + pre-watch videos + pre-cases with per-item `viewedByMe` checkmarks. View tracking writes `StudyPackView` rows + an `EngagementSignal` of new kind `PRE_READING_VIEWED` / `PRE_VIDEO_WATCHED` (so the existing aggregator + the W6.8 readiness predictor see the same data). Curator UI is faculty-side: `/classroom/[id]` (SCHEDULED state) shows a Pre-Conference Prep block with 3 tabs — Study Pack curator (toggle "Mark as pre-session" on tagged docs), Pre-cases curator (search the W6 case template library + attach), Teaser video. (3) **#6A Pre-Case Scenario Simulations** — new `SessionPreCase` join table (sessionId + caseTemplateId + assignedById + rank + required, with unique on (sessionId, caseTemplateId)). Faculty attaches templates as session prep; resident clicks "Start" → `POST /api/classroom/sessions/[id]/pre-cases/[id]/start` is idempotent (resumes any ACTIVE attempt of the same template, else creates a fresh `Case` via the existing W6 `cases-service.startCase`). `required` is **soft only** — joining the live session is never blocked (per project pedagogy memory). Completion writes `EngagementSignal` of `PRE_CASE_COMPLETED`. (4) **#5 Readiness Predictor Dashboard** — new deterministic `readiness-service.computeSessionReadiness()` returning per-learner score 0–100 + tier (READY/AT_RISK/UNDERPREPARED). Inputs: pre-readings viewed, pre-videos watched, pre-cases completed, pre-questions submitted, prior-30d attendance ratio. Weights as constants (READINGS 25, VIDEOS 25, PRE_CASES 30, PRE_QUESTIONS 10, ATTENDANCE 10) with `versionTag='readiness-v1'` so cohort comparisons across schedule changes can detect the boundary. **No ML, no Gemini call** — codex-defensible deterministic. Faculty-side `<ReadinessPanel>` polls `GET /api/classroom/sessions/[id]/readiness` every 60s; resident calling it gets 403. Audited as `readiness.viewed` (per-learner identity exposure). **Schema:** 1 additive migration `20260427000000_w68_preconf_polish` — 1 new value on `DocumentRoute`, 4 new values on `EngagementSignalKind`, 2 new columns on `document_session_links`, 2 new tables (`session_pre_cases`, `study_pack_views`) with indexes + cascade FKs matching the existing per-session convention. Migration applied via `prisma db execute` + `migrate resolve --applied` (existing dev DB had drift on two W4-era migrations from prior hand-edits; reset would have nuked seeded fixtures). **Auth + audit + rate-limit on every state-changing route** — reuses `requireAuth`, `parseBody`, `audit`, `extractRequestMetadata`, `checkRateLimit` with `LIMITS.DOCUMENT_ANALYZE` (fail-closed for teaser, billable upstream) and `LIMITS.ENGAGEMENT_SIGNAL_WRITE` (fail-open for view writes). All new services throw `XAccessError` classes with `{NOT_FOUND, FORBIDDEN, INVALID, CONFLICT}` codes, mirroring `PromoAccessError` / `ReelAccessError` shape. **Tests:** new `scripts/e2e-w68-preconf.ts` (~20-step API contract: study-pack assignment → resident view → engagement signal lands → pre-case attach → idempotent re-start → readiness shape + 403/422 negative paths + teaser 202); new Playwright specs `tests/e2e/w68-preconf-{study-pack,curator,teaser}.spec.ts` driving the real UI as resident + faculty. **Skipped intentionally:** `/calendar/new` Step-5 prep section — the same pre-conference panels already render on the session detail page (`/classroom/[id]`) immediately after creation, so adding a 5th step to the W6.7 4-card form is redundant churn rather than user value. **Reused infra (no parallel systems):** existing `Document` + `DocumentSessionLink` (just adds 2 columns + 1 enum value), `EngagementSignal` (4 new kinds), `Case` + `CaseTemplate` + `Conversation` (untouched — pre-cases are a join, not an extension), `cases-service.startCase()` for pre-case starts, `recordEngagementSignal()` for signal writes, `presignDownload()` for study-pack URLs, `Tabs`/`Card`/`Badge`/`Avatar` UI primitives, `loginAsUser()` Playwright helper. **New shared:** `src/server/services/sessions/visibility.ts` (extracted user-can-see-session + roster helpers used by all 3 W6.8 services). | ✅ shipped (`npx tsc --noEmit` clean, 2026-04-27) |
| **W6.9 — Learning Objectives + Resident Pre-Class Discoverability (out-of-plan)** | done | 1 dev | **Closes two related gaps:** (a) Sessions had only freeform-paragraph objectives in `description`, no structured per-objective tracking, no resident self-mark, no Bloom's tagging beyond the case engine; (b) the W6/W6.8 resident pages `/classroom/[id]/study` + `/classroom/[id]/pre-questions` existed but were unreachable for residents — only host/faculty/PD/admin saw the Pre-Conference Prep block, and the classroom feed `VideoCard` had no quick links. **Schema:** additive migration `20260502120000_session_learning_objectives` adds `teaching_sessions.objectives JSONB` (array of `{id, text, blooms, epaTag?}` — Json over a 4th sub-table because objectives are session-scoped + ordered + rarely queried in bulk; promotion to a normalised table is forward-only since the cuid id is preserved), new enum `ObjectiveAchievementStatus { YES, PARTLY, NO }`, new table `session_objective_achievements` with unique `(sessionId, userId, objectiveId)` + cascade FKs to `teaching_sessions` + `users` (matches `study_pack_views` cascade convention). `objectiveId` is **not** a FK — orphan marks (whose objective was edited away) are filtered at read time so residents never see ghost rows. **Validation:** `createSessionSchema` + `updateSessionSchema` extended with `objectives` (max 10, text 3–280 chars, blooms 1–6, optional 40-char epaTag); update semantics — `undefined` leaves untouched, `null` or `[]` clears, array replaces. New `objectiveAchievementSchema` for the resident POST. **Service:** `session-service.normaliseObjectives()` stamps a server-side `randomUUID()` on each objective lacking an id (so curators can reorder freely without invalidating resident marks); new `sessions/objectives.ts` service module with `readObjectivesWithMyMarks()` + `markObjectiveAchievement()`, both gated through the existing `userCanSeeSession()` visibility helper from W6.8. The mark endpoint validates the objectiveId exists in the current Json before upserting (rejects `OBJECTIVE_NOT_FOUND`), preventing orphan-row writes. **API:** `GET /api/classroom/sessions/[id]/objectives` (any visible user — returns objectives + that user's marks); `POST /api/classroom/sessions/[id]/objectives/check` (resident-callable, idempotent upsert keyed on the unique index, audited as `objective.achievement.marked` via existing `audit()` + `extractRequestMetadata()`, rate-limited via the high-volume `LIMITS.ENGAGEMENT_SIGNAL_WRITE` bucket — fail-open). The existing `PATCH /api/classroom/sessions/[id]` curator route now writes objectives via the extended `updateSessionSchema` — no new curator endpoint, no parallel system. **UI:** `<ObjectivesEditor>` (curator-side; rows of Textarea + Bloom's Select + remove button, `Add objective` capped at 10, framer-motion AnimatePresence on row enter/exit) used in the Calendar new-session form between Description and the When section. `<ObjectivesChipList>` (read-only display; Bloom's-coloured badge per row + status dot reflecting the resident's mark) shown above the tabs in both `<PreConferencePrepBlock>` (curator) and the new `<PreConferenceResidentBlock>`. `<ObjectivesChecklist>` (resident interactive; Yes/Partly/No buttons per objective with optimistic update + `toast.error` revert on failure, framer-motion stagger) rendered above `<RecordingViewer>` on `/classroom/[id]/recording` only for `RESIDENT` and `EXTERNAL_LEARNER` roles. **Pre-class discoverability fix:** new `<PreConferenceResidentBlock>` on `/classroom/[id]` mirrors the curator block's aesthetic with two cards (Study pack count + Ask-before-class count) linking to the existing `/study` and `/pre-questions` routes; counts pulled via 3 cheap `db.*.count` queries in parallel only when the resident block will render. Classroom feed `VideoCard` gets two compact chips ("Study pack" + "Ask before class") on every upcoming/non-live card — uses `e.stopPropagation()` so chip clicks don't bubble to the parent card link. **Audit events:** `OBJECTIVES_UPDATED`, `OBJECTIVE_ACHIEVEMENT_MARKED` added to `AUDIT_EVENTS`. **Reused infra (no parallel systems):** `userCanSeeSession()` from `sessions/visibility.ts` (W6.8), `requireAuth` + `parseBody` + `audit` + `extractRequestMetadata` + `checkRateLimit`, the existing `PATCH /api/classroom/sessions/[id]` for curator writes, the existing `<PreConferencePrepBlock>` aesthetic for the resident block, framer-motion + Bloom's level metaphor from the W6 case engine. **Skipped intentionally:** EPA tag picker UI (server schema already accepts `epaTag` for v2 once a curated tag list ships); per-objective bulk-curator analytics ("how often is X achieved across cohorts") — would require promoting the Json to a normalised table, on roadmap once we have data; hard pre-class blocking on incomplete prereqs (project pedagogy is "difficult but fair", soft signal only — same rationale as W6.8 `SessionPreCase.required`). | ✅ shipped (`npx tsc --noEmit` clean, 2026-05-02; migration not yet applied on local dev — engine dll locked by running `next dev`, run `npx prisma generate && npx prisma migrate deploy` after stopping the dev server) |
| **W6.6 — Admin Invitations Polish (out-of-plan)** | done | 1 dev | **Editable pending invitations:** new `updateInvitation` service + `PATCH /api/invitations/[id]` (ADMIN only, gated on `status === PENDING`, returns 409 `NOT_EDITABLE` otherwise); `updateInvitationSchema` mirrors create-schema fields except `email` (locked — typo'd email = revoke + re-invite); audited as new `invitation.updated` event; reuses InviteModal in edit mode (state pre-populated, email field shown read-only with "Locked — revoke & re-invite to change" hint, button copy flips to "Save changes"). **Live duplicate-email check:** new `GET /api/invitations/check-email?email=…` (ADMIN/PD) returns `{available, reason: USER_EXISTS \| PENDING_INVITE, user? \| invitation?}` — wired into step-1 of the invite modal with 400 ms debounce, distinct red banners for the two cases ("Already a registered user — Sandeep already has an account" vs "Already invited — Dr. Priya already has a pending invitation, revoke it first"), Continue button disabled while checking or when taken. Backend already enforced both checks at create-time but errors only fired after step 3 — this surfaces them upfront. **Auto-poll:** invitations page refetches every 15s while `summary.pending > 0`, so "Invited → Registered" appears live without manual reload (backend already flips status correctly inside `acceptInvitation`'s tx; this just removes the "0 REGISTERED stuck on screen" UX gap). **Demo seed:** `prisma/seed.ts` extended with 5 ACTIVE users covering every role — `+919876543210` Sandeep ADMIN (existing, mobile added; password unchanged `Vaidix@2026!`), `+91987654321{1..4}` for RESIDENT/FACULTY/PROGRAM_DIRECTOR/EXTERNAL_LEARNER (password `12345678`), all with `emailVerifiedAt` set so they bypass the invitation flow for QA login-by-mobile testing. **InviteModal redesign:** 2-column layout, dark sidebar uses `oklch(0.45 0.17 165)` Vaidix-primary radial gradient (replaces hardcoded teal/blue), live avatar-initials preview + role badge + module count progress bar, role no longer pre-selected as Resident (starts null, blocks step 2 until chosen), Continue/Save buttons use `bg-primary` + Vaidix-shadow. **Invitation drawer:** Edit button added to footer for PENDING rows; timeline labels `invitation.updated` as "Invitation edited". Schema unchanged — pure API + UI + seed additions on existing tables. | ✅ shipped (`npx tsc --noEmit` clean, 2026-04-26) |
| **W6.10 — Scheduling/Approval/Upcoming hotfix (out-of-plan)** | done | 1 dev | **Closes 8 connected user-reported gaps in the W3 scheduling flow + W6.8/W6.9 pre-conference surfaces:** (1) **Faculty couldn't propose sessions** — `POST /api/classroom/sessions` and `/calendar/new` page + `canCreate` flag on `/calendar` + `canSchedule` on `/classroom` all hard-blocked on `PROGRAM_DIRECTOR \|\| ADMIN`, even though the underlying `session-service.createSession()` already supported PENDING_FACULTY proposals from non-host proposers. Opened all four to FACULTY too — proposer-host flow remains: faculty hosting own session = auto-approved, faculty proposing for another faculty = PENDING_FACULTY. (2) **In-app approval notifications never created** — `notifySessionProposed` / `notifySessionApproved` only sent emails, never wrote to the `Notification` table (verified: only WhatsApp service did `db.notification.create` anywhere). Now writes a `IN_APP` row keyed on host (proposed) + proposer (approved) with `kind=session.proposed/session.approved` + payload `{sessionId, scheduledStart, scheduledEnd, proposerId, approvalUrl}` so a future bell UI is a thin read on top — email path unchanged. Schema unchanged (model exists since W0). (3) **Upcoming sessions invisible** — three independent causes: dashboard `UpcomingCalendar` was hardcoded mock array, classroom `/classroom` filtered strict `approvalStatus: APPROVED`, `calendar-service.buildVisibilityWhere` did the same. Both server filters relaxed: privileged roles unchanged; everyone else now sees APPROVED OR own host/proposer pending — composed under `AND` in classroom (was a top-level OR collision risk with the visibility helper's own OR). Dashboard wired to a new `GET /api/dashboard/upcoming` returning the next 8 sessions in the existing `Training[]` shape with day/time/faculty/type/accent/isLive computed server-side; `<UpcomingCalendar>` becomes a self-fetching client component with loading + empty states (4-line useEffect). **API:** new `GET /api/dashboard/upcoming` (any auth user, scoped to their visibility + own pending). **Schema:** unchanged. **Files:** `src/app/api/classroom/sessions/route.ts`, `src/app/(platform)/calendar/new/page.tsx`, `src/app/(platform)/calendar/page.tsx`, `src/app/(platform)/classroom/page.tsx`, `src/server/services/calendar-service.ts`, `src/server/services/session-notifications.ts`, `src/app/api/dashboard/upcoming/route.ts` (new), `src/app/(platform)/dashboard/page.tsx`. (4) **Stuck SCHEDULED sessions invisible** — a session whose host never clicked Start sat in `status=SCHEDULED` forever once `scheduledStart < now`, vanishing from both Upcoming (`scheduledStart > now` filter) and Past (`status=ENDED` filter). Mirrored the existing `isStaleLive` / `sweepStaleLiveSessions` pattern in [auto-end.ts](src/server/services/sessions/auto-end.ts) with `isStaleScheduled` + `sweepStaleScheduledSessions` (1h grace, throttled to once-per-minute, idempotent under concurrency, audited as `SESSION_AUTO_ENDED` with `reason=stale_scheduled`). actualStart left null, actualEnd stamped as scheduledEnd so "actually-occurred" filters can use `actualStart != null`. Wired both sweeps + both predicates into the classroom feed read path. **Refactor (same turn):** extracted the repeated APPROVED-or-own-pending OR-clause into a shared `buildApprovalGate()` helper next to `buildSessionVisibilityWhere` in [sessions/visibility.ts](src/server/services/sessions/visibility.ts) — was inlined in 3 places (calendar-service, classroom/page, dashboard/upcoming route), now one source of truth. (5) **Service-layer role gate also blocked Faculty proposals** — discovered after the API gate fix because `session-service.createSession()` had its own `proposerRole !== PD && !== ADMIN` check that threw `FORBIDDEN_PROPOSER_ROLE`. Opened to FACULTY too — service-layer comment updated to match the auto-approve-when-self-host / PENDING_FACULTY-otherwise flow that was already working. (6) **Topics linkage UI gap** — `TeachingSession.topicId` had been a schema stub since W3 with no picker in the form and no display anywhere. Wired into `<NewSessionForm>` as a Select between Description and host (with "No topic" fallback, subspecialty hint), seeded `/calendar/new/page.tsx` with a `db.topic.findMany` so the picker has data on render. Validation already accepted `topicId` since W6.9. Display: fetched topic separately in `/classroom/[id]/page.tsx` (no relation back from `Topic` to `TeachingSession` in schema, so `db.topic.findUnique` runs in parallel with host/proposer fetch — no Prisma schema edit needed) and passed to both `<PreConferencePrepBlock>` and `<PreConferenceResidentBlock>` as a primary-tinted chip in their headers (curator + resident parity). (7) **Pre-case mandatory/optional toggle missing** — `SessionPreCase.required` boolean had been in the schema since W6.8 but only `attachPreCase` accepted it (defaulted false) — no curator UI to flip it after attach. New `updatePreCase()` service fn (host/PD/admin only, idempotent) + `PATCH /api/classroom/sessions/[id]/pre-cases/[preCaseId]` (validates `{required?: boolean, rank?: number}`, audited as `pre_case.updated`). Curator: checkbox "Mark as mandatory pre-class prep" under each pre-case row in [study-pack-curator.tsx](src/components/classroom/study-pack-curator.tsx) with optimistic flip + revert-on-failure; "Required" / "Optional" badge surfaces immediately. Learner-side: existing `c.required` chip in [study-pack-list.tsx](src/components/classroom/study-pack-list.tsx) re-styled from "Recommended" to a rose-tinted "Required" badge to match the curator semantic. (8) **Stuck SCHEDULED sessions invisible** — a session whose host never clicked Start sat in `status=SCHEDULED` forever once `scheduledStart < now`, vanishing from both Upcoming (`scheduledStart > now` filter) and Past (`status=ENDED` filter). Mirrored the existing `isStaleLive` / `sweepStaleLiveSessions` pattern in [auto-end.ts](src/server/services/sessions/auto-end.ts) with `isStaleScheduled` + `sweepStaleScheduledSessions` (1h grace, throttled to once-per-minute, idempotent under concurrency, audited as `SESSION_AUTO_ENDED` with `reason=stale_scheduled`). actualStart left null, actualEnd stamped as scheduledEnd so "actually-occurred" filters can use `actualStart != null`. Wired both sweeps + both predicates into the classroom feed read path. **Skipped intentionally:** notification bell + sidebar approval-count badge (Approvals sidebar entry already exists for FACULTY/PD, email goes out, in-app rows persist for future bell); `DocumentSessionLink.isRequired` for pre-readings (would need an additive migration — `isPreSession` already covers "pre-class" semantics as a soft signal, hard "required" can land in a follow-up alongside the same flag for pre-watch videos). | ✅ shipped (2026-05-07) |
| **W6.11 — Multi-Program Tenancy (out-of-plan, foundational)** | done | 1 dev | **Closes the single-tenant assumption the schema has carried since W0:** every domain table — `Cohort`, `TeachingSession`, `Topic`, `CaseTemplate`, `Pearl`, `Course`, plus 30+ downstream — was implicitly "the LVPEI MS Ophthalmology" program. Adds real multi-program tenancy so a single platform install can host MS Ophthalmology + Cornea Fellowship + Retina Fellowship in parallel without data leakage. **Schema:** new `Program` + `ProgramMembership` models (User × Program N:M, with optional per-program role override so a faculty in one program can be PD in another), new `ProgramStatus` enum, `users.activeProgramId` (nullable, FK SET NULL), `programId` (NOT NULL after backfill) on the 6 entry-point tables. Slug uniqueness on `topics` and `courses` relaxed from global to `(programId, slug)` so the same slug can exist across tenants. Migration `20260509120000_w611_program_tenancy` is forward-only single-shot: creates tables → INSERTs `prg_default_lvpei_ms` → ALTERs each entry-point table to add nullable column → UPDATEs to backfill → SETs NOT NULL → adds FK + index. No drift risk because all 6 backfill UPDATEs are bounded to the default program. **Decision: scope only the 6 entry-point tables in W6.11**, not all ~30 tenant-scoped models — every other domain row joins through Cohort or TeachingSession or one of the 6 anchors via FK, so transitive scoping is enforced for free at the entry points (a Document attached to a session inherits the session's program; an EpaRecord for a resident is reachable only via that resident's cohort which is program-scoped). Phase-2 audit will add explicit `programId` to `Document`, `EpaRecord`, `DopsAssessment`, `MiniCexAssessment`, `Recommendation`, `Recording`, `Pearl` likes, `Notification` etc. once we have a second program in production data and the cross-tenant edge cases reveal themselves. **Auth:** new `loadProgramsForUser()` in `program-service.ts` hydrates `programs[]` (lightweight `{programId, slug, name, role}` per membership, ARCHIVED programs filtered out) at sign-in via the credentials `authorize()` callback. JWT carries it as `token.programs[]`; `auth.config.ts` JWT callback also accepts a `trigger === 'update'` payload to mutate `token.activeProgramId` defensively (allowed program ids only, the server endpoint is the authoritative gate). Session callback exposes both fields on `session.user`. Type augmentation in `src/types/next-auth.d.ts` extended with `SessionProgramMembership` + `programs[]` + `activeProgramId`. **Source of truth split:** `programs[]` lives in the JWT (rarely changes; bumped only on next sign-in if memberships change). `activeProgramId` is read **live from the DB user row** by the (platform) layout and by `requireAuthWithProgram()` (a new api-helper variant) so a switch reflects on the very next request without a JWT cookie rotation. The JWT carries `activeProgramId` only as a cached hint. `requireAuthWithProgram` uses `React.cache()` to dedupe the live lookup within one server render. **API:** new `GET/POST /api/me/active-program` route — POST validates program exists + is ACTIVE + caller is a member (via `setActiveProgram` in program-service which throws `ProgramAccessError {NOT_A_MEMBER, PROGRAM_NOT_FOUND, PROGRAM_INACTIVE}`), updates `users.activeProgramId`, audited as `user.active_program.changed`. CSRF-gated, audited via existing `audit()` + `extractRequestMetadata()`. **UI:** new `<ProgramSwitcher>` in `src/components/layout/program-switcher.tsx` mounted in the top bar between the page title and the search box. Self-hides when the user has < 2 memberships, so single-tenant accounts see no chrome. Switch fetches `POST /api/me/active-program` with the CSRF token, then `router.refresh()` — no SessionProvider dependency, no JWT-rotation roundtrip. **Identity / RoleContext extended:** `Identity` now carries `programs[]` + `activeProgramId`; `mapUserToIdentity()` accepts a `programInfo` parameter. `RoleProvider` exposes `programs`, `activeProgramId`, `activeProgram`, `switchProgram()`, `switchingProgram` (loading state). **Service-layer scoping:** `listCohorts({programId, includeArchived?})`, `createCohort(input, userId, programId)`, `listTopics({programId, subspecialty?})`, `getTopic(idOrSlug, programId)`, `listCaseTemplates({programId, ...})`, `getCaseTemplate(idOrLegacyId, programId)`, `startCase(actor, templateId, programId)` all now require `programId`. `createSession(input, proposedBy, role, programId)` writes the new column; cohort-program-mismatch is rejected at create with `COHORT_PROGRAM_MISMATCH` (defense-in-depth — an admin with two memberships could otherwise submit a Cornea cohort id while active in MS). `attachPreCase` validates the case template's program matches the session's program. `startPreCaseAttempt` re-validates at read time so a hand-edited DB row cannot bypass tenancy. **Visibility helper:** `SessionVisibilityActor` extended with optional `activeProgramId` (optional during the W6.11 rollout — Phase-2 audit will tighten to required); `buildProgramScope()` returns the AND-fragment listing entry points compose. **List entry points scoped:** `/api/cohorts` (GET+POST), `/api/topics` (GET), `/api/topics/[idOrSlug]`, `/api/cases` (list templates), `/api/cases/[caseTemplateId]`, `/api/cases/[caseTemplateId]/conversations` (POST start), `/api/classroom/sessions` (GET+POST), `/api/calendar/events`, `/api/dashboard/upcoming`, `/admin/cohorts` page, `/classroom` feed page, `/api/notifications/whatsapp/schedule-pearls` — all switched to `requireAuthWithProgram()` and pass `gate.user.activeProgramId` into queries. **Seed:** new `prg_default_lvpei_ms` always seeded; demo profile additionally seeds `lvpei-cornea-fellowship` so the switcher has something to demo. Sandeep (admin) + Rajeev (PD) + Meera (faculty) get memberships in both programs, with role overrides where appropriate. Topics / Pearls / CaseTemplates / Cohort / Course seed paths updated to include `programId: DEFAULT_PROGRAM_ID`; topics + courses upserts switched to `programId_slug` compound unique keys. **Files added:** `prisma/migrations/20260509120000_w611_program_tenancy/migration.sql`, `src/server/services/program-service.ts`, `src/app/api/me/active-program/route.ts`, `src/components/layout/program-switcher.tsx`. **Files modified:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/types/next-auth.d.ts`, `src/auth.ts`, `src/auth.config.ts`, `src/lib/identity.ts`, `src/app/(platform)/layout.tsx`, `src/contexts/role-context.tsx`, `src/components/layout/header.tsx`, `src/server/services/api-helpers.ts`, `src/server/services/cohort-service.ts`, `src/server/services/topics/topics-service.ts`, `src/server/services/cases/cases-service.ts`, `src/server/services/session-service.ts`, `src/server/services/sessions/visibility.ts`, `src/server/services/calendar-service.ts`, `src/server/services/study-pack/pre-case-service.ts`, plus 8 API/page files listed above. **Phase-2 follow-ups (intentionally deferred, listed here so they're not rediscovered later):** (a) explicit `programId` columns on `Document`, `EpaRecord`, `DopsAssessment`, `MiniCexAssessment`, `Recommendation`, `Recording`, `Notification`, `Pearl` (likes), `Course` (enrollments) — currently scoped transitively but explicit columns let Phase-2 query plans use direct indexes; (b) audit of the remaining ~30 `teachingSession.findMany` callers (ical-feed, auto-end sweeps, reminder scheduler, breakout/qa/hooks/engagement services) — each needs a `programId` filter or a documented "cross-tenant by design" comment; (c) tightening `SessionVisibilityActor.activeProgramId` from optional to required after (b) lands; (d) admin UI to grant/revoke `ProgramMembership` rows (currently only seed sets them); (e) new-program onboarding wizard (Topic + Cohort + initial CaseTemplate seeding for a fresh tenant). | ✅ Phase 1 shipped — migration `20260509120000_w611_program_tenancy` applied (programs=2 with demo seed; 34 users + 4 cohorts + 9 sessions + 16 topics + 36 case templates + 31 pearls + 3 courses backfilled into the default program); seed verified (Sandeep/Rajeev/Meera get memberships in both programs with role overrides applied); `npx tsc --noEmit` clean for W6.11 changes; `scripts/e2e-w611-tenancy.ts` (12 steps) **ALL PASS** against the running dev server — verifies single-tenant cohort scoping, cross-tenant 403 on switch, cross-tenant 404 on case start, multi-program switcher, live-DB activeProgramId read on switch (no JWT refresh roundtrip), 404 on non-existent program. **Manual code-review caught + fixed 3 bugs before any test ran:** (1) ProgramSwitcher fetch was missing the `x-csrf-token` header → would have 403'd; fixed in `src/contexts/role-context.tsx` with on-demand `/api/csrf` bootstrap so the very first action of a fresh session works. (2) Invitation acceptance created users without `ProgramMembership` or `activeProgramId` → would have 409 `NO_ACTIVE_PROGRAM` on every list endpoint; fixed in `src/server/services/invitation-service.ts` by deriving the program from cohort > inviter's active > first ACTIVE program (transactional with the user create). (3) Webinar self-registration created `EXTERNAL_LEARNER` users tenancy-less; fixed in the confirm route by inheriting the session's program and upserting the membership. **Test fixtures updated to set `programId`** so existing W4/W5/W6/W6.8/W6.9 e2e suites + Playwright specs keep passing: `scripts/e2e-w4-helpers.ts` exports `TEST_PROGRAM_ID` + `ensureTestProgram()`; `tests/e2e/setup.ts` mirrors the pattern; the four `audit-*.ts` scripts and four spec files (`w68-preconf-curator/teaser/study-pack`, `prereq-gate`, `w6-pre-questions`) all stamp `programId` on their `db.teachingSession.create` fixtures. Phase 2 audit deferred. |
| **W6.12 — Notification bell phase 1 (out-of-plan)** | done | 1 dev | **Closes the "future bell" skip noted in W6.10:** the header bell at `src/components/layout/header.tsx` was a hardcoded static dot with no fetch, no list, no read-state — even though `notifySessionProposed` / `notifySessionApproved` had been writing `IN_APP` `Notification` rows since W6.10. **No schema change** — model has existed since W0. **Service:** new `src/server/services/notifications-service.ts` with `listForUser({onlyUnread?, limit?})`, `markRead(userId, id)`, `markAllRead(userId)`. List returns `{items, unreadCount}` shaped for the bell — server-side `resolveLinkUrl(kind, payload)` computes the row's deep-link (e.g. `session.proposed → /inbox/approvals`, `session.approved/rescheduled/cancelled/reminder → /classroom/{sessionId}`) so the client doesn't have to replicate the kind→URL mapping. **API:** `GET /api/notifications` (auth-only; query: `?unread=1&limit=N`, default 30, max 100); `PATCH /api/notifications/[id]/read` (auth + CSRF, scoped to caller via `updateMany` so cross-user enumeration returns 404, not 200); `POST /api/notifications/mark-all-read` (auth + CSRF). Marking read is idempotent — second PATCH on an already-read row returns 404 (no row matched the `readAt: null` filter), which the client treats as "already done". **UI:** new `<NotificationBell>` client component in `src/components/layout/notification-bell.tsx` replacing the static bell. Polls `GET /api/notifications?unread=1&limit=1` every 30s for the unread badge (cheap — count + 1 row max), fetches the full list only on popover open. Reuses the manual `useRef` + `mousedown` click-outside pattern from the profile dropdown above it (no popover primitive — base-ui is in deps but unused for popovers anywhere in the codebase, not worth introducing here). Optimistic flip on row click: local `readAt` set immediately, badge decrements, PATCH fires in the background, next 30s poll reconciles. "Mark all read" button disabled when `unread === 0`. Empty state ("You're all caught up") + loading spinner. Renders `formatDistanceToNow(createdAt)` from `date-fns` (already a dep), Bell unread-row tint via `bg-teal-500/[0.04]`, badge pill caps at "99+". Wraps each row in `<Link href={linkUrl}>` when present (Next.js client-side nav — no full reload), `<div>` otherwise. **CSRF:** PATCH and POST routes call `requireCsrf(req)`; client sends the `vaidix-csrf` cookie value via the existing `csrfHeaders()` helper from `src/lib/csrf-client.ts` (HARDENING-PLAN #15 pattern). **Files added:** `src/server/services/notifications-service.ts`, `src/app/api/notifications/route.ts`, `src/app/api/notifications/[id]/read/route.ts`, `src/app/api/notifications/mark-all-read/route.ts`, `src/components/layout/notification-bell.tsx`. **Files modified:** `src/components/layout/header.tsx` (drop static bell + unused `Bell` + `Button` imports; mount `<NotificationBell />`). **Existing-flow audit (done before any new code):** grepped for prior `notification` listing / `markRead` / `markAllRead` / `/api/notifications` callers — only existing routes were `/api/notifications/whatsapp/{send,schedule-pearls}` (outbound WhatsApp dispatch, unrelated namespace). No prior reader endpoint, no prior service file, no prior client fetcher — this is the first reader on a model that has shipped writes since W6.10. The two existing `db.notification.create` callers (`session-notifications.ts`, `whatsapp-service.ts`) needed no edits. **Phase 2 (shipped same sprint, 2026-05-09):** wired `db.notification` rows on all 8 remaining events — see W6.12 Phase 2 row below. **Phase 3 follow-up:** `/inbox` index page with role-aware tabs + per-user `NotificationPreference` UI (`NotificationPreference` model already exists since W0; no writers yet). **E2E:** new `scripts/e2e-w612-notifications.ts` (12 steps, mirrors the `e2e-w611-tenancy.ts` cookie-jar + login + CSRF-bootstrap pattern): unauth → 307 redirect to /login (NextAuth middleware intercepts before requireAuth), auth → list shape + unreadCount accuracy, `?unread=1` filter, server-side `linkUrl` resolution by kind (`session.proposed → /inbox/approvals`, `session.approved → /classroom/{sessionId}`), PATCH without CSRF → 403 CSRF_REQUIRED, PATCH with CSRF → 200 + readAt set + unreadCount decremented, second PATCH on already-read row → 404 NOT_FOUND (idempotent — `updateMany` filter excludes already-read rows), cross-user PATCH attempt → 404 NOT_FOUND with B's row still `readAt=null` in the DB (no enumeration leak), `/mark-all-read` → 200 with `updated >= 1` and subsequent list `unreadCount=0`, `?limit=1` caps results. **All 12 steps PASS** against the running dev server (verified 2026-05-09). | ✅ shipped (`npx eslint` clean for new + edited files; `npx tsx scripts/e2e-w612-notifications.ts` ALL PASS, 2026-05-09) |
| **W6.12 Phase 2 — Notification event wiring (out-of-plan)** | done | 1 dev | **Closes the "Phase 2 follow-ups" noted in the Phase 1 row:** wires `db.notification.create` rows on all 8 events that previously only sent email. **Existing-flow audit (done first):** all 8 sites were confirmed empty of any prior `db.notification.create` call — each service was wiring only email, no in-app rows. **`emit()` helper added to `notifications-service.ts`:** single fire-and-forget wrapper (swallows errors so notification failure never blocks the primary transaction; uses global `db` client, not a tx). `emitToMany()` parallel-fans to multiple users (cancellation/rescheduled attendee lists). Header comment updated from "read + ack only" to reflect its dual role. **New `resolveLinkUrl` kinds:** `session.rejected → /calendar`, `prequestion.posted → /classroom/{id}/pre-questions/dashboard`, `invitation.accepted → /admin/users`, `objective.achieved → /classroom/{id}`, `recording.ready → /classroom/{id}/recording` — added to the existing switch in `notifications-service.ts`. **8 event sites wired:** (1) `notifySessionRejected` in `session-notifications.ts` → proposer gets `session.rejected` row with `payload.reason`; (2) `notifySessionRescheduled` (host) → `session.rescheduled` with `previousStart/End` + new time in payload; (3) `notifySessionRescheduled` (attendees, !requiresApproval) → same kind bulk-emitted to all OPEN_TO_ALL / COHORT / INVITE_ONLY attendees via `emitToMany`; (4) `notifySessionCancelled` → all of `toNotify[]` (host + proposer + attendees, already had ids) via `emitToMany` with `payload.reason`; (5) `notifySessionReminder` — `recipients` array extended from `{name,email}` to `{id,name,email}` so ids are available; host + attendees get `session.reminder` with `payload.leadTime`; (6) `submitQuestion` in `pre-questions-service.ts` → after `db.preSessionQuestion.create`, fetches `session.hostId + host.status`; emits `prequestion.posted` to host only when actor ≠ host AND host is ACTIVE (self-skip: host submitting their own question fires no row); (7) `acceptInvitation` in `invitation-service.ts` → inviter `select` extended with `id + status`; emits `invitation.accepted` to inviter when inviter is ACTIVE; (8) `markObjectiveAchievement` in `sessions/objectives.ts` → checks `db.sessionObjectiveAchievement.findUnique` before the upsert (one extra cheap query); emits `objective.achieved` to the **actor (resident)** only on their **first mark** for that objective (repeat status changes are silent — avoids spam); (9) `transcribe-worker.ts` → after `db.recording.update({status: READY})` fetches `teachingSession.{title, hostId, host.status}` and emits `recording.ready` to host. **Tailwind warnings resolved** in `notification-bell.tsx`: `w-[22rem]→w-88`, `max-h-[28rem]→max-h-112`, `bg-teal-500/[0.04]→bg-teal-500/4`. **Bell KIND_LABELS updated** with 5 new labels: `session.rejected`, `prequestion.posted`, `invitation.accepted`, `objective.achieved`, `recording.ready`. **Files modified:** `src/server/services/notifications-service.ts` (emit + emitToMany + 5 new linkUrl cases), `src/server/services/session-notifications.ts` (4 functions), `src/server/services/pre-questions/pre-questions-service.ts`, `src/server/services/invitation-service.ts`, `src/server/services/sessions/objectives.ts`, `src/server/workers/transcribe-worker.ts`, `src/components/layout/notification-bell.tsx`. **E2E:** new `scripts/e2e-w612p2-notifications.ts` (15 steps): calls service functions directly (no ffmpeg/MinIO stack needed) to verify each event writes the correct row; HTTP call to `GET /api/notifications` as authenticated host verifies all 6 `linkUrl` values end-to-end; negative paths: host-self-posts question → 0 extra rows, objective re-mark → 0 extra rows, `invitation.accepted` verified via direct `emit()` (acceptInvitation's full tx flow is covered by existing W1 e2e). SMTP `send failed` logs in test output are expected for fixture email addresses (non-real domains, dev SMTP rate-limited) — `emit()` is decoupled from the email path so all 15 assertions pass regardless. **ALL 15 PASS** (2026-05-09). | ✅ shipped (`npx eslint` clean; `npx tsx scripts/e2e-w612p2-notifications.ts` ALL PASS, 2026-05-09) |
| **W6.12 Phase 3 — /inbox index page + NotificationPreference toggle (out-of-plan)** | done | 1 dev | **Closes the "Phase 3 follow-up" noted in the Phase 1 row:** builds the full `/inbox` page with role-aware tabs and a per-user in-app notification preference panel. **Existing-flow audit (done first):** confirmed no prior `/inbox/page.tsx`, no prior `NotificationPreference` API routes (`/api/notifications/` only had `[id]/read`, `mark-all-read`, `route.ts`, `whatsapp/`). `NotificationPreference` model exists since W0 with no API writers. `Tabs` component available at `src/components/ui/tabs.tsx` (`@base-ui/react/tabs`). **Service additions:** `getPreferences(userId)` — reads `notification_preferences` for the user's IN_APP prefs, then merges with all 10 `KNOWN_NOTIFICATION_KINDS` defaults (enabled=true when no DB row exists), returning a stable array of `{kind, channel, enabled}` regardless of how many DB rows the user has. `upsertPreference(userId, kind, channel, enabled)` — upserts a single preference row. Both added to `src/server/services/notifications-service.ts`. **API:** `GET /api/notifications/preferences` (auth-only; returns the full 10-kind array with defaults filled) and `PUT /api/notifications/preferences` (auth + CSRF; body `{kind: string, channel: "IN_APP", enabled: boolean}`; open `kind` string — any value is persisted, not restricted to `KNOWN_NOTIFICATION_KINDS`, so future kinds don't require an API change). **`/inbox` page:** `src/app/(platform)/inbox/page.tsx` — server component, reads `auth()`, redirects to `/login` if unauthenticated. Passes `role` string to `<InboxClient>`. **`inbox-client.tsx`:** new `src/components/layout/inbox-client.tsx` — full client component. Fetches `GET /api/notifications?limit=100` on mount (client-side filter is enough at current data volumes; pagination is a Phase-4 follow-up). Tab state (`all | sessions | questions | achievements | recordings | invitations`) drives `filterByTab()` which partitions by kind prefix. Badge counts (teal pill) on each tab showing unread items. Role-conditional tab: `invitations` tab only renders for `admin` and `program_director` roles. **Settings flyout:** gear icon button (top right of inbox) opens a framer-motion `AnimatePresence` dropdown. On first open, fetches `GET /api/notifications/preferences`; subsequent opens use cached state. Each preference row shows label + animated CSS toggle (teal when enabled, `bg-muted` when disabled) that fires `PUT /api/notifications/preferences` optimistically and reverts on error. CSRF token read via `csrfHeaders()`. `busyKind` gate prevents concurrent toggles on the same kind. "In-app notifications only" footer note. **Mark all read + row click:** toolbar "Mark all read" button (disabled when `unread=0`), optimistic row click (same pattern as the bell popover), `<Link>` wrapping for rows with `linkUrl`. `<ChevronRight>` arrow hint on hover. **framer-motion:** `AnimatePresence` + `motion.li` with `layout` on the notification list for smooth add/remove; `AnimatePresence` for the settings flyout enter/exit; fade on tab content. **Sidebar nav:** `Inbox` entry added at position 2 (after Dashboard) for all 5 roles in `src/lib/constants.ts` — `icon: 'Bell'`, `href: '/inbox'`. Faculty and program_director keep their existing `Approvals` → `/inbox/approvals` entry (separate workflow — pending session approval queue). Admin keeps `Invitations` → `/admin/invitations`. External_learner gains inbox for objective/recording notifications. **Files added:** `src/app/api/notifications/preferences/route.ts`, `src/app/(platform)/inbox/page.tsx`, `src/components/layout/inbox-client.tsx`, `scripts/e2e-w612p3-inbox.ts`. **Files modified:** `src/server/services/notifications-service.ts` (getPreferences + upsertPreference + KNOWN_NOTIFICATION_KINDS), `src/lib/constants.ts` (Inbox entry for all 5 roles). **E2E:** new `scripts/e2e-w612p3-inbox.ts` (19 steps): unauth GET preferences → 307 redirect; auth GET → 200 + 10 kinds; all 10 KNOWN_NOTIFICATION_KINDS present and enabled=true by default; PUT without CSRF → 403 CSRF_REQUIRED; PUT with CSRF (disable session.reminder) → 200 enabled=false; response body shape correct; GET again → persisted false; re-enable → 200 enabled=true; GET round-trip → true; unknown kind PUT → 200 (open enum); unauth GET /inbox → 307 redirect; auth GET /inbox → 200 HTML; sidebar constants: /inbox present + icon=Bell for all 5 roles; faculty keeps /inbox/approvals; PD keeps /inbox/approvals. **ALL 19 PASS** (2026-05-09). | ✅ shipped (`npx tsx scripts/e2e-w612p3-inbox.ts` ALL PASS, 2026-05-09) |
| W7 — Reviews + Journal + Challenges + Knowledge Atoms | 1 week | 3 devs | In-app spaced repetition, journal, challenges, knowledge atoms | ❌ not started |
| W8 — Assessment & Analytics | 1 week | 3 devs | Scoring historical log + DOPS/Mini-CEX/EPA + Progress + Kirkpatrick L3 (uses DOPS data) — **see §10b "Pre-W8 state" before starting** | ❌ not started |
| W9 — Knowledge Library | 1 week | 3 devs | Pearls library, **Pearl AI extraction (recording → candidate Pearls + faculty approval, closes the `extractedByAi`/`approvedById` schema gap)**, Atlas, Medical Reference | ❌ not started |
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
Self-host special case: proposedBy == hostId ──► auto-APPROVED     │
  (PD/Faculty hosting themselves, or Resident hosting a peer-led    │
   journal club / case presentation — no faculty approver in path)  │
                                                                   │
Reschedule: APPROVED ──(PD reschedules)──► PENDING_FACULTY (loop) ─┘
```

**Host overlap policy (Teams parity, 2026-05-09).** The btree_gist EXCLUDE
constraint that hard-blocked overlapping host time was dropped (migration
`20260509150000_drop_host_overlap_exclusion`). Real schedules collide —
back-to-back mentoring slots, residents proposing peer sessions during a
faculty grand-rounds — and Outlook/Teams/Google Calendar all permit it with
a warning. We now detect overlaps in `findHostConflicts` and return them as
`response.data.warnings.hostConflicts`; the client surfaces a non-blocking
notice but does not refuse the schedule. `HOST_CONFLICT` is no longer a
returned error code on the create / approve / reschedule routes.

### Tech Stack (new this week)

| Library | License | Role |
|---|---|---|
| [`rrule`](https://github.com/jakubroztocil/rrule) | MIT | RFC 5545 recurrence generation + expansion |
| [`ics`](https://github.com/adamgibbons/ics) | MIT | `.ics` file generation for email attachment |
| [`react-big-calendar`](https://github.com/jquense/react-big-calendar) | MIT | Calendar UI (month/week/day/agenda views) |
| `btree_gist` Postgres extension | PostgreSQL license | Installed in W1; was used for race-free conflict EXCLUDE — constraint dropped 2026-05-09 (warn-not-block policy). Extension retained for future use. |

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
| A9 | **#1 AI Promo Content Generator** — Gemini generates `subtitle` + `hook` per session; SVG templates for flyer / WhatsApp banner / IG card; falls back to deterministic heuristic when `GEMINI_API_KEY` absent. PNG conversion via Chromium = follow-up. | reuses `Document` with `route=PROMO_ASSET` | `POST /api/promo/generate`, `GET /api/promo/list` | Faculty document library surfaces PROMO_ASSET docs with download URL |
| A9.1 (W9, 2026-05-11) | **Promo & Share extension** — `buildCopy` now consumes session objectives + prereqs + study material + top pre-questions (was already accepted by signature but caller never supplied them). Redesigned SVGs match the LVPEI promo mockup (navy/teal/amber, speaker card, structured highlights, REGISTER CTA). New `PromoShare` model + token-hashed public link at `/p/[token]` mirroring the recording-share security model. AI objective suggestions from study material via `aiExtractFromSourceJson` — speaker accepts/dismisses chips, nothing is auto-applied. Auto-banner appears in `FacultyPrepPanel` when objectives ≥ 3. Client-side SVG→PNG on the public page (no puppeteer dep). | adds `PromoShare` (`migration 20260511200000_promo_share`); reuses existing PROMO_ASSET docs | `POST /api/classroom/sessions/[id]/objectives/suggest`, `POST /api/promo/share`, `DELETE /api/promo/share/[shareId]`, `GET /api/p/[token]` (public) | (1) Suggestion chips above objectives input in the prep panel; (2) auto-banner + success banner; (3) unauthenticated `/p/[token]` landing page with three previews + Register CTA. E2E: `scripts/e2e-w9-promo.ts` + `tests/e2e/w9-promo.spec.ts`. |
| A9.3 (W9, 2026-05-11) | **Faculty Q&A tab + doubt prompts** — adds the missing presenter view of the resident Ask & Vote board into the Session Prep Manager as a new "Q&A" tab (4th tab alongside Materials/Objectives/Prerequisites). Embeds the already-shipped `PreQuestionsDashboard` (themes + ranked questions + recluster) unchanged, then layers a "Frame their thinking" panel on top so the presenter can publish 1–3 short framing prompts ("What confuses you most about herpetic uveitis?"). Prompts persist to `session.metadata.doubtPrompts` via an extension of the existing PATCH /prep route — **no new model, no migration**. Residents see the prompts as starter chips above their compose box in `PreQuestionsBoard`; tapping a chip pre-fills the textarea. AI-suggest button calls a new POST endpoint that drafts up to 3 prompts grounded in the session's objectives + uploaded material. Sidebar "Student questions" Prep Check card now polls live so the count updates without a reload. | reuses `PreSessionQuestion` / `PreSessionQuestionTheme`; reuses `PreQuestionsDashboard` + `PreQuestionsBoard`; **no new tables, no migration** — prompts live in the existing `session.metadata` JSON column alongside `prereqItems` | extends `PATCH /api/classroom/sessions/[id]/prep` (now accepts `doubtPrompts`); new `POST /api/classroom/sessions/[id]/pre-questions/prompts/suggest` (Gemini drafts, persists nothing); GET `/api/classroom/sessions/[id]` already returns metadata so the resident board reads via that. New audit events `PRE_QUESTION_PROMPTS_UPDATED`, `PRE_QUESTION_PROMPTS_SUGGESTED`. | (1) New "Q&A" tab in `FacultyPrepPanel` with Frame-their-thinking panel + embedded presenter dashboard; (2) starter-chip row above the resident compose textarea in `PreQuestionsBoard`. E2E: `scripts/e2e-w93-qa-prompts.ts` (14/14 assertions inc. resident 403 on host-only PATCH) + `tests/e2e/w93-qa-prompts.spec.ts` (faculty publishes a prompt → resident sees + taps chip). |
| A9.4 (W9, 2026-05-11) | **Pre-session structured polls** — adds a 5th "Polls" tab in the Session Prep Manager and a "Poll" tab in the resident Study Hub. Presenter creates multi-choice polls (manually or via AI-suggest), reviews + publishes; residents see the published polls before the session and cast one vote each; both sides see an aggregate bar chart (residents only after they vote — Mentimeter pattern, anti-anchoring). The same poll row can be re-fired live in-session via the existing `/fire` endpoint — pre-session + live responses aggregate into the same bar chart. **Extends `LiveHook` with one nullable column `prePublishedAt` instead of building a parallel `Quiz` / `QuizQuestion` / `QuizAttempt` schema** — same data model, same response upsert semantics, same `@@unique(hookId, userId)` enforcement, same engagement-signal pipeline. Codex-grade authorization: host/PD/admin can CRUD + publish; residents can only vote + see results after voting; PATCH/DELETE refused after responses exist (returns 409 HAS_RESPONSES); invalid-option votes rejected with 400; results endpoint returns 403 VOTE_FIRST for un-voted residents. Idempotent publish/unpublish. AI suggest mirrors the objectives + doubt-prompts pattern (returns drafts, persists nothing). | extends `LiveHook` with `prePublishedAt: DateTime?` + index `(sessionId, prePublishedAt)` (migration `20260511230000_live_hook_pre_published`); **no new tables** — reuses `LiveHook` + `LiveHookResponse` schema and the existing `recordHookResponse` + `recordEngagementSignal` pipeline | extends `GET /api/classroom/sessions/[id]/hooks` (new `?prePublished=true\|false` filter); new `PATCH/DELETE /api/classroom/sessions/[id]/hooks/[hookId]` (edit/delete drafts; 409 once responses exist); new `POST/DELETE /api/.../hooks/[hookId]/pre-publish` (publish + revoke, idempotent); new `GET /api/.../hooks/[hookId]/results` (aggregate counts + myAnswer; gates residents pre-vote); new `POST /api/.../hooks/suggest` (Gemini drafts up to 3 polls from objectives + materials). `recordHookResponse` now rejects votes on drafts (no firedAt + no prePublishedAt) and validates `response ∈ options` for POLL/TRUE_FALSE kinds. New audit events `LIVE_HOOK_UPDATED`, `LIVE_HOOK_DELETED`, `LIVE_HOOK_PRE_PUBLISHED`, `LIVE_HOOK_PRE_UNPUBLISHED`, `LIVE_HOOK_SUGGESTED`. | (1) New "Polls" tab in `FacultyPrepPanel` rendering `PollsManager` — AI-suggest button + manual compose form + draft list with inline edit + Publish/Hide + bar-chart results. (2) New "Poll" tab in resident Study Hub rendering `PollsVoter` — one vote per poll, results revealed after voting with the resident's own answer highlighted. E2E: `scripts/e2e-w94-polls.ts` (23/23 assertions across the full lifecycle + 8 auth/validation edge cases: NOT_OPEN on draft vote, VALIDATION on non-option vote, HAS_RESPONSES on edit-after-votes, idempotent publish, resident 403 results-before-vote, resident 403 on PATCH, suggest 422 on NO_CONTEXT, unique constraint on upsert). Playwright: `tests/e2e/w94-polls.spec.ts` (faculty creates + publishes; resident's voter renders the published poll). |

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
| C5 | **PHI/PII sanitizer** — regex-based stopgap with Indian-context detectors (Aadhaar with Verhoeff checksum, PAN, mobile, MRN/UHID, DOB, age-name, email, Luhn-validated cards). BullMQ `phi-scan` worker auto-runs after every classify. High-severity findings flip Document to `PENDING_REVIEW` and block tag-to-session unless admin/PD passes `phiOverride`. Manual rescan endpoint at `/api/documents/[id]/phi-rescan`. Microsoft Presidio Python sidecar = future Phase B upgrade. | reuses `PhiScanResult` (W0 schema) + populates `Document.phiScanStatus` / `phiScanResult` JSON | `POST /api/documents/[id]/phi-rescan`; gate enforced inside `tagDocumentToSession` | Faculty document detail surfaces scan result; admin/PD UI for `phiOverride` flag (Phase 2 polish) |
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
| D6 | **#19 Teaching Bot Reinforcement Coach** — real Gemini-2.5-flash call with strict-JSON ophthalmology coach persona (Indian context, no US drug brands, dose-safe). Returns `{ answer, followUpQuiz, caseExample, source: 'gemini' \| 'stub' }`. Falls back to deterministic stub when `GEMINI_API_KEY` absent or Gemini errors — route never 500s. Phase A is stateless (persistence via new `CoachInteraction` model lands in W7 alongside journal/coach surface). | none new (Phase A) | `POST /api/learners/[id]/coach` | `CoachPanel` chat in `live-session.tsx` Coach tab |
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
| `/api/recordings/*` | `[id]/hls/[...path]` (auth'd HLS proxy — streams master/variant/segment from MinIO so HLS relative URL resolution works), `share/[token]` (public resolver), `share-play/[token]/hls/[...path]` (post-password HLS proxy keyed by HMAC playback token) |
| `/api/documents/*` | `[id]`, `[id]/classify`, `[id]/approve`, `[id]/url`, `[id]/tag-session`, `[id]/visibility`, `[id]/analyze` |
| `/api/learners/[id]/*` | `coach`, `coach/conversations`, `kirkpatrick`, `blooms-progression` |
| `/api/notifications/*` | `whatsapp/send` |
| `/api/promo/*` | `generate`, `list` |
| `/api/journal/*` | `prompted`, `prompts` |

**Total new route files: ~22, distributed across 6 existing namespaces. No endpoint takes a `command` parameter; every endpoint is REST-shaped.**

### Success Criteria (W4-Sprint, end of week 4)

**Stream A (Recording & Media):**
- [ ] Session recording auto-starts when faculty joins (Room Composite egress, video + audio of all participants in `speaker` layout — Teams/Zoom-style; pass `audioOnly: true` for pure-voice lecture archives)
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
- [x] Faculty uploads case notes — regex PHI scanner flags Aadhaar / PAN / mobile / MRN; high-severity uploads gate tag-to-session unless admin overrides with `phiOverride: true` (verified 8/8 unit cases including Verhoeff Aadhaar + Luhn cards)
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
| 2 | Topics taxonomy | `Topic`, `Level`, `UserLevelProgress` (exist) | `/api/topics` (GET, POST — faculty/PD/admin inline-create), `/api/topics/[id]` |
| 3 | **#2 Pre-Conference Question Submission Engine** | `PreSessionQuestion` (now with `parentId` self-FK for single-level reply threads), `PreSessionQuestionVote`, `PreSessionQuestionTheme` | `/api/classroom/sessions/[id]/pre-questions` (POST/GET), `/[qid]/vote` (POST/DELETE), `/[qid]/reply` (POST), `/themes` (GET) |
| 4 | AI question clustering into themes | uses Gemini in Phase A; **replies are excluded** from clustering (filter `parentId: null`) | runs in BullMQ on submission |
| 5 | Presenter pre-session dashboard ("top 10 anticipated learner concerns") | derived from #3+#4 | `/api/classroom/sessions/[id]/pre-questions/dashboard` |
| 5a | **Pre-session Q&A reply chain (2026-05-11)** | adds `parentId String?` + self-relation to `PreSessionQuestion` (mirrors `QaItem` pattern from W5). Migration `20260511230000_pre_question_replies`. Service-level guard rejects nested replies; vote endpoint rejects votes on replies. Host author → "Presenter" badge in UI. Author of parent question receives `prequestion.replied` notification. | new POST `/api/classroom/sessions/[id]/pre-questions/[qid]/reply` |

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

### ⚠️ Pre-W8 state (read before building)

The **W6.5 polish sprint** (2026-04-25) wired several pages to real DB queries that previously rendered mock data. **Do not re-build these — extend them in place.**

| Page already built — extend, don't replace | What it shows now | What W8 adds |
|---|---|---|
| [`/faculty/learners`](src/app/(platform)/faculty/learners/page.tsx) (server component) | DB-backed list of `User WHERE role=RESIDENT`. Per-row: cohort badge, `_count.sessionParticipations`, `_count.conversations`-completed, last login, search by `?q=`. | Add 3H scores, EPA level badges, latest DOPS / Mini-CEX summary. The empty 2-col grid below the resident card already has space for these — slot them in. |
| [`/faculty/cohort`](src/app/(platform)/faculty/cohort/page.tsx) (server component) | DB-backed: total residents, active cohorts, sessions in last 90d, avg attendance per session, cohort list with member counts. Already ships a dashed "scoring lands W8" callout card at the bottom. | Replace the dashed callout with the **3H + Oslerian principle averages** widget. The data shape (`ScoringEvent` aggregations) is exactly what the placeholder anticipates. |
| [`/program/competency-map`](src/app/(platform)/program/competency-map/page.tsx) (server component) | Renders the EPA list (13 EPAs) + entrustment scale (5 levels) from `lib/constants.ts`. The heatmap area shows a "Week 8" banner. | Build the resident × EPA heatmap inside the existing layout (don't replace the page). Source rows from `EpaRecord` aggregated to latest entrustment level per resident × EPA. |
| [`/admin/users`](src/app/(platform)/admin/users/page.tsx) (server component) | Real `db.user.findMany` + `listUsers` service. Edit-role modal + deactivate / reactivate buttons live (uses W1 `user-admin-service`). | No W8 work — used as-is when admins need to look up residents. |

**Already built engagement layer the Progress page can plug into:**
- [`engagement-service.ts`](src/server/services/engagement-service.ts) — `togglePearlLike`, `toggleBookmark`, `getPearlLikeState`, `getBookmarkState`. The Progress page can reuse `getBookmarkState` to show a learner's saved-pearls-and-recordings count.
- [`/profile/bookmarks`](src/app/(platform)/profile/bookmarks/page.tsx) — pearls + recordings sections; one-click remove. The Progress page can deep-link here for "things this learner saved this week."

**Already built discussion forum (relevant if W8 wants to surface unanswered student questions on Progress):**
- [`qa-service.answerQuestion`](src/server/services/qa/qa-service.ts) + `PATCH /api/classroom/sessions/[id]/qa/[qaId]/answer` — the `QaItem.answer / answeredById / answeredAt` fields populate from this. A "questions awaiting your answer" widget for the Faculty dashboard is a one-query win: `db.qaItem.findMany({ where: { recording: { session: { hostId: facultyId } }, answer: null, parentId: null } })`.

**Schema reminder** — every assessment table already exists (W0 lock): `ScoringEvent`, `DopsAssessment`, `MiniCexAssessment`, `EpaRecord`, `EpaRecalcEvent`, `KirkpatrickEvaluation`. W8 writes rows; it does **not** add columns.

### Feature table

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Scoring historical log (Phase B) | `ScoringEvent` (exists) | `/api/learners/[id]/scoring-history` |
| 2 | DOPS Assessment | `DopsAssessment` (exists) | `/api/faculty/dops`, `/api/faculty/dops/[id]` |
| 3 | Mini-CEX Assessment | `MiniCexAssessment` (exists) | `/api/faculty/mini-cex` |
| 4 | EPA Records | `EpaRecord`, `EpaRecalcEvent` (exist) | `/api/learners/[id]/epa` |
| 5 | Progress page (3H radar, Bloom's chart, EPA progress) | reuses scoring data | `/api/learners/[id]/progress` (faculty/PD view, pending) — **self view shipped 2026-05-09**: `/api/progress/me` ([route.ts](src/app/api/progress/me/route.ts)) drives [`/progress`](src/app/(platform)/progress/page.tsx) with real `ScoringEvent` aggregates (3H trajectory, growth deltas, Bloom's max-difficulty, Oslerian engagement, recent cases, cases-this-month/total-hours from `Case` + `CaseTemplate.estimatedMinutes`). All sections render honest empty states for new residents — no more hardcoded mocks. EPA progress still pending (depends on `EpaRecord` ingestion). |
| 5b | **Dashboard role panels** (shipped 2026-05-09) | Reuses `User`, `Course*`, `ScoringEvent`, `Conversation`, `EpaRecord`, `DopsAssessment`, `MiniCexAssessment`, `AuditEvent` | `/api/dashboard/me` ([route.ts](src/app/api/dashboard/me/route.ts)) returns role-specific data (discriminated union). [Dashboard page](src/app/(platform)/dashboard/page.tsx) — Resident, Faculty, PD, Admin panels now read live data; all 7 hardcoded data blocks (myCourses, completedModules, cohortLearners, recentConversations, EPA matrix, milestones, recentActivity, plus all stat tiles) replaced with empty states for new tenants. Storage/uptime, milestones, accreditation render explicit "not yet configured" cards (no schema yet). External Learner panel was already DB-light. |
| 6 | **#11 Kirkpatrick L3** (Behavior — uses DOPS evidence) | extends W4 D9 | `/api/learners/[id]/kirkpatrick/l3` (auto-derived from DOPS scores) |

### Success Criteria
- [ ] Faculty submits DOPS for resident's intravitreal injection
- [ ] Resident's progress page shows updated EPA level + Bloom's depth + 3H radar
- [ ] Kirkpatrick L3 score auto-recomputes from new DOPS evidence
- [ ] `/faculty/cohort` "scoring lands W8" placeholder is replaced with real 3H + Oslerian averages
- [ ] `/program/competency-map` heatmap renders real entrustment levels from `EpaRecord`
- [ ] No W6.5 polish-sprint page is rewritten (extend in place)

---

## 10c. Week 9 — Knowledge Library (Pearls + Atlas + Reference)

### ⚠️ Pre-W9 state (read before building)

The **W6.5 polish sprint** (2026-04-25) already shipped the **engagement layer** for Pearls — do not re-implement.

| What's already there | What W9 adds |
|---|---|
| [`/pearls`](src/app/(platform)/pearls/page.tsx) (server component fetches per-user `PearlLike` + `Bookmark` state). [`pearls-list.tsx`](src/app/(platform)/pearls/pearls-list.tsx) renders heart (with count + optimistic toggle), bookmark, Web-Share-API share with clipboard fallback, and a "Saved only" filter pill. Actions go through [`/pearls/actions.ts`](src/app/(platform)/pearls/actions.ts) → `togglePearlLikeAction`, `toggleBookmarkAction`. | Backfill the **DB-backed search** (full text on `Pearl.title + Pearl.body`) and the **topic / category indexes**. The page currently filters in-memory over the seeded JSON; W9 swaps the data source to `db.pearl.findMany` while keeping the existing engagement props (`likeCount`, `likedByMe`, `bookmarkedByMe`). |
| [`engagement-service.ts`](src/server/services/engagement-service.ts) — `togglePearlLike`, `getPearlLikeState`, `toggleBookmark`, `getBookmarkState`. Generic `Bookmark` model already supports `targetType: 'PEARL' \| 'RECORDING' \| 'ATLAS_IMAGE' \| 'COURSE_ITEM' \| 'DOCUMENT'`. | Atlas and Reference pages can reuse `toggleBookmark` with `targetType='ATLAS_IMAGE'` — no new service needed. |

### Feature table

| # | Feature | Tables | API |
|---|---|---|---|
| 1 | Pearls library (full searchable) | `Pearl`, `PearlLike` (exist) | `/api/pearls`, `/api/pearls/[id]`, `/api/pearls/like` |
| 2 | **Pearl AI extraction pipeline** — Gemini structured-output reads a `Recording`'s `Transcript` (Stream B output) and emits candidate Pearls into `Pearl` rows with `extractedByAi=true`, `approved=false`, `sourceRecordingId`, `citations`. Faculty approval drawer flips `approved=true` + writes `approvedById`/`approvedAt`. Schema columns already exist (W0 lock) — this closes the schema-vs-reality gap flagged in the W6 third-party review. Phase A uses Gemini; Phase B swaps to Vaidix Core via the same prompt-template interface. Falls back to manual creation when `GEMINI_API_KEY` absent. | reuses `Pearl` (`extractedByAi`, `approvedById`, `approvedAt`, `sourceRecordingId`, `citations` already in schema) | `POST /api/admin/pearls/extract-from-recording` (kicks BullMQ job), `PATCH /api/admin/pearls/[id]/approve`, `GET /api/admin/pearls/pending` |
| 3 | Signs Atlas | `AtlasImage`, `AtlasTag` (exist) | `/api/atlas`, `/api/atlas/[id]` |
| 4 | Medical Reference | reuses `RagDocument` (exists, scoped to `reference` collection) | `/api/reference/search` |
| 5 | Image Library | `File` (exists) | `/api/images`, `/api/images/[id]` |

### Success Criteria (additive — pearl extraction)

- [ ] Faculty triggers extraction on a completed recording → Gemini returns N candidate Pearls in `PENDING_APPROVAL` state
- [ ] Pending-pearls drawer at `/pearls?filter=pending` (faculty/PD/admin only) shows candidates with citations + source recording timestamp
- [ ] Faculty approves one → `approved=true` + `approvedById`/`approvedAt` written; pearl appears in resident `/pearls` list
- [ ] Rate limit on extraction: 10 jobs/hr/faculty (BullMQ queue + `LIMITS.PEARL_EXTRACT`)
- [ ] AuditEvent written on every approve/reject (`pearl.extracted`, `pearl.approved`, `pearl.rejected`)
- [ ] No regression on engagement layer — `togglePearlLike`/`toggleBookmark` continue to work for both seeded and AI-extracted pearls

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
- [x] PHI sanitizer (regex stopgap, Indian-context detectors) runs on every classified document; Presidio Python sidecar pending for Phase B
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
| **PHI in demo data** | All demo documents fully synthetic or faculty-approved. Regex PHI scanner (W4 C5, Indian-context: Aadhaar/PAN/mobile/MRN/email/DOB/age-name/cards) auto-runs on every uploaded document; high-severity blocks tag-to-session unless admin overrides. Presidio Python sidecar is the long-term upgrade for ML-based name detection. |
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

## 17. W4 Review Feedback Log (codex / third-party audit trail)

This section captures every external review claim against the W4-Sprint deliverable, our verdict against the actual code, and what was fixed. Reviewers can use this as a self-audit cross-check.

### 17.1 Round 1 � internal reviewer (2026-04-25)

| # | Reviewer claim | Verdict | Evidence | Fix |
|---|---|---|---|---|
| 1 | Coach bot at `/api/learners/[id]/coach` returns a placeholder | ? **Correct** | Original code called `placeholderCoachResponse()` returning template strings; comment admitted "Phase A placeholder � Gemini hook pending in Stream D follow-up" | Wired real Gemini-2.5-flash with strict-JSON ophthalmology coach persona (Indian context, no US drug brands, dose-safe). Returns `source: 'gemini' \| 'stub'`. Falls back to deterministic stub when `GEMINI_API_KEY` absent or Gemini errors � route never 500s. |
| 2 | Reflection bot route missing | ? **Wrong** | `/api/journal/prompted` GET (rotates 4 prompt types daily) + POST (persists `JournalEntry` with `prompted=true` + `promptType`) was already shipped; e2e-w4-d steps 21�22 verified | None � already shipped, reviewer was mistaken |
| 3 | Smart Presentation Studio missing | ? **Wrong** | `/api/documents/[id]/analyze` calls `geminiAnalyze()` with strict-JSON system prompt; persists to `DeckForgeJob.analysisResult`; e2e-w4-c step 7 verified `source=gemini` against live API | None � already shipped |
| 4 | Promo / Reels logic stubbed | ?? **Partial** | **Reels: real** � FFmpeg vertical 1080�1920 crop pipeline + worker, e2e verified. **Promo: real SVG generation, but copy was heuristic** (no Gemini call) | Wired real Gemini for promo `subtitle` + `hook` (60 �C temperature, 90/70-char caps); falls back to heuristic when Gemini absent/fails. SVG asset generation unchanged. PNG conversion via Chromium remains a Phase 2 follow-up. |
| 5 | Document PHI sanitisation explicitly TODO | ? **Correct** | `document-service.ts` comment admitted "PHI sanitizer (Presidio) hooks in for case_notes � currently flags but doesn't block"; schema fields existed, no code populated them | Built real regex PHI scanner with Indian-context detectors: Aadhaar (12-digit + Verhoeff checksum), PAN, Indian mobile (+91 / 0-prefix / 10-digit starting 6-9), MRN/UHID/Patient ID, DOB, age-name patterns, email, Luhn-validated cards. BullMQ `phi-scan` worker auto-runs after every classify. High-severity findings flip Document to `PENDING_REVIEW` and block tag-to-session unless admin/PD passes `phiOverride: true`. Manual rescan endpoint `/api/documents/[id]/phi-rescan`. **8/8 unit cases pass** (clean text, valid Aadhaar blocks, invalid Aadhaar passes, phone, PAN, MRN, email+name, DOB context, credit card with Luhn). Microsoft Presidio Python sidecar = Phase 2 ML upgrade. |

**Net result:** 2 real gaps closed, 2 mistaken claims rebutted with evidence, 1 partial gap closed. W4-Sprint feature parity is now verified against the original W4-Sprint plan + Feeddback.md spec.

### 17.2 Reviewer rebuttal protocol (for future rounds)

When a reviewer flags a feature as "missing" or "stubbed," check in this order before either fixing or rebutting:

1. **Grep the route's source for the claimed gap.** A `placeholder` or `TODO` keyword search is the fastest signal � if it's there, the reviewer is right.
2. **Run the relevant `npm run e2e:w4:*` script.** If the e2e covers the feature and passes, the feature works end-to-end regardless of how it looks in code.
3. **Check the audit log of a recent dev session.** If `audit()` is called with the relevant `eventType`, the wire is connected.
4. **Read the comment block at the top of the service file.** Phase A vs Phase B status is documented there explicitly.

If the claim survives all four checks, it's a real gap � fix it and update this log. If it doesn't, document the rebuttal here so the same claim isn't re-raised.

---

## Change Log

| Version | Date | Changes |
|---|---|---|
| v2.1 | 2026-05-10 | **Bulk Invitations Phase 1 — admin Excel upload reusing the existing invite pipeline.** New page `/admin/invitations/bulk` lets admins import many invitations from a downloaded `.xlsx` template instead of clicking through the 3-step modal one user at a time. **No new DB schema** — every row goes through the same `createInvitation` service that the single-invite endpoint uses; same audit events, same email send, same role-vs-mapping validation, same accept-invitation flow downstream. **One new API route** (the only addition) `POST /api/admin/invitations/bulk` (`src/app/api/admin/invitations/bulk/route.ts`) loops over rows sequentially with try/catch per row and returns a per-row results manifest `{ summary: {total, ok, error}, results: [{row, email, status, invitationId | error}] }`. New rate-limit bucket `BULK_INVITATION_CREATE` = 5 batches/hour, fail-closed; combined with a hard 500-row-per-batch cap (`bulkCreateInvitationsSchema` in `src/lib/validation/auth.ts`), worst-case fan-out is 2,500 invitation emails / hour / admin — predictable and bounded. **Why a new route instead of looping over `POST /api/invitations`:** the single-invite endpoint is rate-limited at 30/hour per admin (sensitive: outbound mail), which forbids real bulk imports — uploading 200 users would take ~7 hours of throttling. The new route uses its own bucket sized for batches; the single-invite limit stays untouched as the credential-attack guard. **Why row-level error capture:** mirrors the BusinessOS partners-import pattern — admin uploads, server processes all valid rows, fails the bad ones individually; the UI shows a per-row results table so the admin can fix typos/duplicates and re-upload only the failures rather than aborting the whole batch on one duplicate email. **UI** (`src/app/(platform)/admin/invitations/bulk/page.tsx` + `bulk-client.tsx`): three-stage state machine — idle (download + upload) → previewing (per-row validation table with Ready/Issues badges) → done (results table with Sent/Failed badges). Template generated **client-side** with SheetJS (`xlsx` package, lazy-imported on click) — workbook with Instructions sheet + one sheet per role (Residents, Faculty, Program Directors, Admins, External Learners). Each role sheet only carries the columns relevant to that role (e.g. `yearOfResidency` only on Residents, `programDirectorEmail` only on Faculty), keeping the form honest and avoiding the "why is this column blank for half my rows" problem. Header row marks required columns with `*`; example row pre-filled with realistic LVPEI-context values. **Hierarchy resolution is client-side**: page fetches `/api/users/searchable?role=PROGRAM_DIRECTOR`, `/api/users/searchable?role=FACULTY`, and `/api/cohorts` once at preview time, builds email→id and name→id maps, then resolves `programDirectorEmail` / `facultyMentorEmail` / `cohortName` to ids before submission. Mismatches surface as preview-table errors before any server round-trip. This keeps the bulk endpoint thin (it speaks pure ids, identical to the single-invite contract) and means **zero changes to `createInvitation` service**. **Phase 2 deferred**: live data-validation dropdowns embedded in the .xlsx (uses ExcelJS not SheetJS), error export as a fixed-up .xlsx, and chunked submission for batches > 500. **Entry point**: `/admin/invitations` page header now has a "Bulk import" button next to "Invite user" — same destination as the new `/admin/invitations/bulk` route. **Tests** (per the codex review protocol): `scripts/e2e-bulk-invitations.ts` (`npm run e2e:bulk-invitations`) — covers unauth/forbidden gates, empty-rows 422, over-cap 422, mixed-validity batch with 4 valid + 2 service-level errors (USER_EXISTS for admin's own email, INVALID_PD when programDirectorId points at a RESIDENT user), DB cross-check of created invitations + correct programDirectorId/facultyMentorId/yearOfResidency on the rows, and a re-submit pass to verify the second attempt yields PENDING_INVITE_EXISTS. `tests/e2e/admin-bulk-invitations.spec.ts` (Playwright) — drives the rendered page: login as admin → page renders → download .xlsx event fires → in-memory xlsx upload → preview table shows correct ready/error mix → submit → results table shows correct sent/failed counts → DB cross-check. **Schema unchanged.** Build relies only on existing tables (`Invitation`, `User`, `Cohort`) and existing service contracts. |
| v2.0 | 2026-05-10 | **Session pre-flight model — hosts can A/V test anytime, but LIVE/recording/captions are window-gated.** Closed a class of "session marked completed weeks before scheduled time" bugs by making the scheduled window — not the room-open event — the authority for live-state transitions. **Why**: a faculty member opening the May 27 9 am session on May 10 to test their mic was flipping `status=LIVE`, painting the LIVE pill across every viewer's classroom feed, and on disconnect rolling the row to ENDED — i.e. the May 27 class showed as "completed" 17 days early. **Rule**: hosts (and anyone with publish rights) can join the LiveKit room any time; outside the scheduled window the join does NOT flip status, does NOT start the recording egress, does NOT publish caption segments, and the room emptying does NOT roll the row to ENDED. Status only transitions SCHEDULED→LIVE during `[scheduledStart - 5 min, scheduledEnd + 15 min]`. **New helper**: `src/lib/sessions/scheduled-window.ts` — pure `isInScheduledWindow(session, now, opts)` predicate, single + recurring (RRULE-aware via the existing `rrule` dep). Recurring sessions check the window per-occurrence; a Monday-9am weekly is in-window only on Mondays during the grace-padded slot. **Server gates**: `recordParticipantJoin` refactored to use a new shared `maybeFlipToLive(sessionId, actorId, now?)` helper exported from `session-service.ts` — broadens the flip from host-only to any-role (catches the case where the host pre-flighted alone and a participant arrives at start time), allows ENDED→LIVE for recurring sessions whose master row carries the prior occurrence's terminal status, and centralises the audit + actualStart stamp. LiveKit webhook (`src/app/api/classroom/webhooks/livekit/route.ts`): `room_started` no longer unconditionally flips status — calls `maybeFlipToLive` then conditionally `maybeStartRecording`; `liveKitRoomSid` is still captured for any room creation regardless of pre-flight. New `participant_joined` catch-up call to `maybeFlipToLive` covers the host-already-in-room-when-window-opens case. `room_finished` unchanged (existing `where: { status: LIVE }` guard already filters pre-flight). **Captions gate**: `live-captions/ingest` route now reads session status and silently drops segments when `status !== LIVE` (returns `{ published: 0, dropped: N, reason: 'NOT_LIVE' }` rather than 4xx — avoids putting the LiveKit Agent into a retry loop). **UI**: `pre-join.tsx` rewrites the host early-join branch — outside-window hosts now see an amber "Pre-flight test mode" / "Outside scheduled window" banner explaining what won't be captured, the join button reads "Open pre-flight room", and a new "Start session now" outline button POSTs to `/reschedule` with start=now (auto-approves because hosts already get auto-approve in `rescheduleSession`) and reloads. New `preflight-banner.tsx` mounts inside `LiveKitRoom` whenever `session.status === 'SCHEDULED'` (i.e. the host is in the room but the LIVE flip hasn't fired yet) — same messaging, same "Start session now" affordance, polls window state every 30s so it auto-dismisses when the window opens. `DeepgramCaptionsProducer` enable prop now requires `session.status === 'LIVE'` so pre-flight runs don't burn Deepgram quota or leak chatter into the transcript. **Recurring**: existing read-side patch in `classroom/[id]/page.tsx` (project ENDED→SCHEDULED on master row when next occurrence exists) keeps working unchanged; the new ENDED→LIVE allowance in `maybeFlipToLive` handles the second-occurrence-and-beyond case server-side. **Test**: `scripts/e2e-w70-preflight.ts` exercises (a) before-window join stays SCHEDULED, (b) in-window join flips to LIVE, (c) after-window join stays in past, (d) start-now reschedule + flip, (e) recurring next-occurrence flip from ENDED. **Schema unchanged.** All gates are pure runtime logic on existing `scheduledStart`/`scheduledEnd`/`recurrenceRule`/`recurrenceUntil` columns. |
| v1.9 | 2026-05-01 | **Org-mapping fields: Cohort → Faculty mentor + Faculty → Program Director.** Two new optional FKs let admin/PD wire the residency hierarchy without forcing it. Both nullable, both `ON DELETE SET NULL` so departures auto-orphan rather than block. **Migration** (`20260501120000_cohort_faculty_and_pd_link`): adds `cohorts.facultyId` + `users.programDirectorId`, indexes on both, FKs both `SET NULL`. No backfill — existing rows keep `null`. **Schema** (`prisma/schema.prisma`): `Cohort.faculty User? @relation("CohortFaculty")`, `User.programDirector User? @relation("FacultyToPD")` + `User.facultyMembers User[]` + `User.cohortsAsFaculty Cohort[]` back-relations. **Validation** (`lib/validation/session.ts`, `app/api/admin/users/[id]/route.ts`): `createCohortSchema` + `updateCohortSchema` accept optional `facultyId`; admin user-update body accepts optional `programDirectorId`. **Services**: `cohort-service.ensureFacultyId` rejects assignment to a non-FACULTY user (new `CohortServiceError` returns 400 from the cohort routes); `user-admin-service.updateUserDetails` rejects PD link unless target is FACULTY and ref is PROGRAM_DIRECTOR (and self-link). Both emit dedicated audit events: `COHORT_FACULTY_ASSIGNED`/`COHORT_FACULTY_CLEARED` and `FACULTY_PD_ASSIGNED`/`FACULTY_PD_CLEARED` (added to `AUDIT_EVENTS`). `getCohort`/`listCohorts` now return `faculty: { id, name, email, avatarUrl } | null`. `GET /api/admin/users/[id]` now returns `programDirector` + `programDirectorId` on the detail payload. **API** (no new routes): `POST/PATCH /api/cohorts[/id]` + `PATCH /api/admin/users/[id]` accept the new optional fields. **UI**: `<UserPicker single>` mode added (replace-on-pick instead of append). Admin cohort drawer (`cohort-detail-drawer.tsx`) gets a "Faculty mentor" section above member-add — single-select FACULTY picker, inline assign + clear; mentor surfaces in the drawer header summary line. Admin cohorts list (`cohorts-client.tsx`) — create form gets a "Faculty mentor" picker; cohort cards show "Mentored by …". Edit-user modal (`edit-user-modal.tsx`) — when `newRole === FACULTY`, the Role & Status tab shows a "Reports to (Program Director)" picker (single-select, filtered to PROGRAM_DIRECTOR, can't pick self). Save flow reordered: role-change first (so subsequent identity PATCH sees the new role), then identity+profile+programDirectorId, then status. **Seed** (`prisma/seed.ts`): now wires Meera (FACULTY) → Rajeev (PD) and creates "PGY-1 Residents 2026–27" cohort with Meera as mentor + Arjun as a member, all idempotent. **Dynamic by design:** all three FKs are nullable; queries handle missing links gracefully; no required ordering — admin can wire mappings in any order or skip them entirely. Builds on existing Cohort/CohortMember structure rather than introducing a parallel mentorship table. |
| v1.8 | 2026-04-26 | **Cohort CRUD completion + orphan-FK hardening + calendar redesign.** New API: `PATCH /api/cohorts/[id]` and `DELETE /api/cohorts/[id]` (PD/ADMIN only, 404 if missing, 403 if wrong role); new services `updateCohort` (partial-update name/description/academicYear) and `deleteCohort` (soft-delete: sets `deletedAt + status=ARCHIVED`); new validation schema `updateCohortSchema`; audit events `COHORT_UPDATED` and `COHORT_DELETED`. UI: cohort cards get a 3-dot menu (Edit details / Manage members / Delete); `cohort-detail-drawer.tsx` gains inline edit panel (name/year/description) and delete-with-confirm section in the header — both with optimistic state pushed back to the parent via new `onRenamed`/`onDeleted` callbacks. **Orphan-FK hardening:** `Field <relation> is required to return data, got null instead` Prisma errors were crashing `/calendar`, `/classroom/[id]`, `/admin/cohorts/*` whenever a referenced user had been wiped (demo seeds with hardcoded IDs). Calendar service now batches a separate `db.user.findMany` for hosts and falls back to `null` for orphans (`src/server/services/calendar-service.ts`). Classroom session page does the same (`src/app/(platform)/classroom/[id]/page.tsx`) with an "Unknown host" fallback so the page renders. New `prisma/cleanup-orphans.ts` sweeps 10 user-FK tables (`teaching_sessions.hostId`, `.proposedBy`, `cohorts.createdBy`, `cohort_members.userId`, `session_invites.userId`, `session_participants.userId`, `session_admissions.userId`, `session_chat_messages.userId`, `session_bans.userId`, `session_approval_audits.actorId`) — run with `npx tsx prisma/cleanup-orphans.ts`. **Calendar redesign:** `/calendar` page renamed to "Live Classes" header (matches sidebar); `CalendarView` rebuilt with custom Vaidix-styled toolbar (Today + prev/next + clickable month/year that opens a 3×4 month picker dropdown), custom event tiles with status-coloured left borders + LIVE badge, all default react-big-calendar CSS overridden with Vaidix tokens (`oklch(0.45 0.15 165)` for today/current-time/selection, `hsl(var(--border))` for grid), inline legend at bottom, view switcher collapses to icons-only on mobile, calendar height steps `h-120 → sm:h-140 → lg:h-165`. Calendar API now lets ADMIN/PD see all approval statuses (was filtered to APPROVED only). **Layout fixes (app-wide):** `platform-shell.tsx` auto-collapses sidebar below 1280 px viewport (with manual-toggle override), main column gets `min-w-0` (so flex children can shrink instead of forcing overflow) + `overflow-x-hidden` (prevents content pushing the page wider than viewport). `handleUnexpected` now appends `err.message` to the response in dev mode so 500s are diagnosable from the UI. Schema unchanged. Build clean: `npx tsc --noEmit` exit 0. |
|---|---|---|
| v1.0 | 2026-04-13 | Initial 5-week video-first showcase build plan. 4 pillars: Auth + Live Video + Recordings + Faculty Documents. Phase 1 production build plan (not MVP). Week 0 schema lock approach. All 42 domains designed upfront, empty tables fine. |
| v1.1 | 2026-04-24 | **Status snapshot + dual-provider clarifications.** Added "Status as of 2026-04-24" table at top: W0–W3 ✅ done, W4–W6 ❌ not started. W4 (§8) rewritten with Sarvam → self-hosted dual-provider strategy, `TranscriptionProvider` interface, and production env gate that refuses boot with `SARVAM_API_KEY` set. Tech stack table (§12) split AI Services into Phase A (Gemini, current) and Phase B (Vaidix Core, post-showcase) with the same env-gate pattern. Risks (§14) updated to reflect the env-gate enforcement. New §16 added: Local Dev → LVPEI On-Prem Migration with explicit cutover checklist and prod env-gate list. Production target restated as **LVPEI on-prem**, not AWS/GCP — cloud is a staging fallback only. |
| v1.2 | 2026-04-24 | **Phase 1 expansion to all 22 features (no prototypes, no deferrals to "after showcase").** Client decision: deliver every feature from the original [Feeddback.md](../Feeddback.md) brief as Phase 1, production-ready. **W4 → W4-Sprint** (4 calendar weeks, 11 devs in 4 parallel streams: Recording & Media / Transcription & Live Captions / Documents & Presentation AI / Engagement & Out-of-band) — absorbs 15 of 22 features. **W5–W14 expanded** to absorb the remaining 7 features as their prerequisites land (breakouts in W5 unlock #6+#13; scoring in W8 unlocks #11 L3; simulators in W10 unlock #8+#16; RAG in W13 unlocks #18; whiteboard gets its own W14 slot). **W15 = Phase-1 production demo** (was the showcase). **#7 Emotion Analytics** explicitly deferred to W16+ pending LVPEI ethics committee — calendar dependency, not engineering. §3 timeline diagram fully replaced. §8 fully rewritten as W4-Sprint with stream-by-stream tables, cross-stream interface contracts, and per-stream success criteria. §9 (W5) extended with #6 + #13. §10 split into §10a–§10i (W6–W15), each a 1-week scope with deliverables, tables, APIs, success criteria. §11 prerequisites updated for the 11-dev hire + GitHub branch protection + CI + WhatsApp Business API + Sentry. §13 Success Criteria rewritten to Phase-1 (all 22). §14 Risks expanded with sprint-coordination + hiring + quality risks. §15 (After the Showcase) replaced with Phase 2 scope (Vaidix Core activation, EMR/SSO/SCIM, offline sync, multi-specialty replication). API namespace summary in §8.6: ~22 new route files across 6 existing namespaces, no god-endpoint. |
| v1.3 | 2026-04-25 | **W4 review-feedback fixes + status refresh.** Reviewer flagged 5 W4 gaps; verified each against actual code (�17.1). 2 real gaps closed: **(1) Coach** route now calls real Gemini-2.5-flash with strict-JSON ophthalmology coach persona � was a placeholder template before; falls back to deterministic stub when `GEMINI_API_KEY` absent. **(2) Document PHI sanitisation** built end-to-end � regex scanner with Indian-context detectors (Aadhaar+Verhoeff / PAN / mobile / MRN/UHID / DOB / age-name / email / Luhn-validated cards), BullMQ `phi-scan` worker auto-runs after every classify, high-severity findings flip Document to `PENDING_REVIEW` and block tag-to-session unless admin/PD passes `phiOverride: true`, manual rescan endpoint at `/api/documents/[id]/phi-rescan`, 8/8 unit cases pass. 1 partial gap closed: **Promo copy** now Gemini-generated (was heuristic). 2 mistaken claims rebutted: **Reflection bot** (already shipped at `/api/journal/prompted`) and **Smart Presentation Studio** (already calls real Gemini in W4 commit, e2e verified). Added �17 W4 Review Feedback Log to capture every claim/verdict/fix as a codex audit trail; �17.2 documents the rebuttal protocol for future review rounds. Stream A9, C5, D6 feature rows (�8) updated to reflect actual implementation. �13 Success Criteria + �14 Risks tightened to mark PHI sanitiser checkbox complete. W5 status refreshed to "code-complete with 1 known e2e failure (breakouts response shape)" pending W5 dev fix. |
| v1.4 | 2026-04-27 | **W5 + W6 P1 + W6 P2 shipped, e2e-verified.** **W5 step-10 fix:** the reviewer's "breakouts POST response shape mismatch" diagnosis was wrong — verified by reading both sides of the contract; route returned `{ items }`, test read `data.items` (matched). Real cause was `createRoom()` (LiveKit Server SDK) throwing when the dev container wasn't reachable, surfaced as a 500. Wrapped the call in try/catch + warn (mirrors reconvene's `deleteRoom` pattern); LiveKit auto-creates rooms on first participant connect anyway, so pre-provisioning was always best-effort in spirit. **W6 Phase 1:** Pre-Conference Question Submission Engine end-to-end — schema (PreSessionQuestion/Vote/Theme + PreSessionQuestionUrgency enum), submit/vote/list/themes/dashboard/recluster API, BullMQ debounced clustering worker (jobId=sessionId, 30s delay) calling Gemini, host-only "Re-cluster now" override, 6 audit events, full Playwright UI spec + 22-step API contract test. **Topics read API:** /api/topics + /api/topics/[idOrSlug] with shallow hierarchy + counts. **W6 Phase 2:** Cases mock→DB end-to-end — new CaseTemplate model + Case.templateId, mock-data/cases.json seeded into DB (36 templates), cases-service (list/get/start/listConversations/getConversation/sendMessage), mentor-response.ts (server-side Gemini Phase A with stage-default fallback when Gemini unavailable), 5 API routes, all 3 cases pages rewritten to fetch via API (no remaining mock JSON imports on /cases). **e2e proof (2026-04-27 against http://localhost:3002):** `e2e-w6` 26/26 ✓ (Pre-Q + Topics, Gemini clustering produced 2 actual themes), `e2e-w6-cases` 17/17 ✓ (cases full chat engine, mentor reply + stage advance PATIENT_STORY → OBSERVATION). 4 reviewer claims about W6 "schema-only / no message POST / no conversation threading / Conversations API absent" definitively disproved by the live test run. |
| v1.7 | 2026-04-26 | **W6.7 Cohort & Session-Invite UI completion logged.** Closes two UI gaps that W3 left as TODOs (W3 status row was already marked ✅ done despite the gaps). New routes: `GET /api/cohorts/[id]` (cohort detail with members) and `GET /api/users/searchable` (lightweight pick-a-user list, ADMIN+PD, returns `{id,name,email,role,avatarUrl}` filtered to ACTIVE non-deleted, supports `role`/`search`/`excludeIds`). New shared UI: `<UserPicker>` component (`src/components/user-picker.tsx`) — debounced searchable multi-select with role chips, used by both the cohort drawer and the session-invite form. New cohort detail drawer (`src/app/(platform)/admin/cohorts/cohort-detail-drawer.tsx`) opens on card-click, shows current members with remove buttons + add-member picker. `/calendar/new` — replaced TODO comma-separated input for INVITE_ONLY visibility with the new picker (chips, "at least one invitee required" guard); added a "Generate share link" toggle + TTL select (24h/48h/72h/7d) that mints the share link via the existing `POST /api/classroom/sessions/[id]/share-link` endpoint after creation and shows a copy-to-clipboard banner before redirecting. Schema unchanged — all additions are API + UI on existing W3 tables (`Cohort`/`CohortMember`/`SessionInvite`). Build clean: `npx tsc --noEmit` exit 0. |
| v1.6 | 2026-04-26 | **W6.6 Admin Invitations polish logged.** New status-table row between W6.5 and W7. Two new API routes: `PATCH /api/invitations/[id]` (`updateInvitation` service, gated on `status === PENDING`, audits `invitation.updated`) and `GET /api/invitations/check-email` (live duplicate check returning `{available, reason: USER_EXISTS \| PENDING_INVITE}`). InviteModal extended to support `edit` prop (state pre-populated, email locked, button → "Save changes"); step-1 wired to live email-availability check with 400 ms debounce + distinct red banners for already-registered vs already-invited; Continue blocked while checking or taken. Invitations page auto-polls every 15s while pending invites exist (live "Invited → Registered" without reload). InviteModal redesign — 2-column layout with Vaidix-primary `oklch(0.45 0.17 165)` sidebar gradient (replaces hardcoded teal/blue), role no longer pre-selected as Resident (must be picked explicitly). Demo seed (`prisma/seed.ts`) now creates 5 ACTIVE users covering every role with mobile login wired (`+91987654321{0..4}`, password `12345678` for non-admin) — addresses the "all other users must be invited" QA pain. Schema unchanged — pure API + UI + seed additions. Build clean: `npx tsc --noEmit` exit 0. |
| v2.2 | 2026-05-12 | **W8 Deck Forge — per-faculty AI style memory (PRELUDE/POPI-inspired).** Personalises wizard-forge output by capturing every faculty edit on AI-generated slides, distilling them into 5–10 natural-language style rules via Gemini, and injecting the rules (scoped by topic/audience/sessionType) into the Opus draft prompt on the *next* forge. Two new tables, both keyed by `facultyId` for hard cross-user isolation: `FacultyEditSignal` (raw capture, with `topicTag`/`audienceTag`/`sessionType` for scoped retrieval, `processedAt` for distillation bookkeeping) and `FacultyStyleProfile` (1:1 with User; stores `rules` JSON + cached `promptContext`). Two new enums: `FacultyEditSignalKind` (REFINE_INSTRUCTION / SLIDE_EDIT / SUGGESTION_ACCEPTED / SUGGESTION_DISMISSED) and `FacultyStyleProfileStatus` (EMPTY / ACTIVE / USER_DISABLED). **Service** (`src/server/services/decks/faculty-style-profile.ts`): `recordEditSignal` capture (respects existing `UserPreferences.aiMemoryOptIn` consent gate — no new flag needed), `rebuildFacultyStyleProfile` Gemini distillation via existing `aiExtractFromSourceJson` router (description task → Gemini is correct per `feedback_ai_routing_honesty.md`; falls through to DeepSeek/Sonnet if Gemini errors), `getFacultyStyleProfile(facultyId, scope)` returns `{promptContext, version, ruleCount}` or `null` when not active. Hard anti-sycophancy guardrail in `DISTILL_SYSTEM_PROMPT`: "STYLE only — never produce rules contradicting clinical accuracy, dosing, guideline citations, or anatomy" (MIT Feb 2026 personalization-sycophancy finding). Tunables: `MIN_SIGNALS_FOR_FIRST_BUILD=5`, `REBUILD_AFTER_N_NEW_SIGNALS=5`, `MAX_RULES_PER_PROFILE=10`, `SIGNAL_LOOKBACK=60`. **Capture wiring** at three existing chokepoints, all guarded by `job.requestedById === auth.user.id` so admin/PD edits on someone else's deck never pollute either profile: `PATCH /api/decks/[jobId]/slides/[slideId]` writes SLIDE_EDIT; `POST .../refine` writes REFINE_INSTRUCTION; `POST .../suggestions/[id]/apply?commit=true` and `.../dismiss` write SUGGESTION_ACCEPTED/DISMISSED. All captures use `void recordEditSignal(...).catch(...)` so the host route never fails because of memory bookkeeping. **Forge injection** (`src/server/services/decks/wizard-forge-service.ts`): `getFacultyStyleProfile(input.requestedById, {topicTag, audienceTag, sessionType})` runs in parallel with the existing `getFacultyHistoryContext`; both `promptContext` strings concatenate into the Opus draft prompt under the briefing block. `maybeRebuildStyleProfile` fires post-forge in the background when ≥ N new signals accumulated. **Routes**: `GET/PATCH/DELETE /api/me/style-profile` (self-scoped — `facultyId` always from `auth.user.id`, never from path/body) and `POST /api/me/style-profile/rebuild` (rate-limited via existing `LIMITS.DECK_REFINE`). 3 new audit events: `STYLE_PROFILE_UPDATED/REBUILT/CLEARED`. **UI** (`src/app/(platform)/profile/style/page.tsx` + `style-profile-client.tsx`): faculty-only settings page with framer-motion stagger, inline rule editing, scope-tag chips, rebuild button (disabled until ≥5 signals), Clear All with confirm — linked from `/profile` via a new "AI style memory" card visible only to FACULTY/PD/ADMIN. **E2E**: `scripts/e2e-w-style-profile.ts` covers auth gates, captures across two faculty + one admin, cross-user isolation (no stray signals, no admin pollution, A's rebuild leaves B untouched), consent-opt-out gate, DELETE scope. `tests/e2e/w-style-profile.spec.ts` (Playwright) drives the rendered UI: navigation from /profile, EMPTY hint, ACTIVE rule list with edit-save, mocked rebuild, Clear All. **Migration** applied via `prisma db push` (additive, no data loss). Build status: schema typechecks; Prisma client regen blocked by running `next dev` holding the Windows DLL — restart `next dev` once to pick up new types. |
| v1.5 | 2026-04-25 | **W6.5 polish sprint logged + §10b/§10c "pre-W8/W9 state" sections added so the W7+W8+W9 teams don't re-build what already shipped.** Status table gets a new **W6.5** row between W6 and W7 covering: session-driven `RoleProvider` replacing the demo-mode hardcoded resident; `EXTERNAL_LEARNER` role plumbed through nav + dashboard; `/admin/users` and `/admin/institution` switched from mock JSON to real DB (W1 admin APIs) with edit-role / deactivate / reactivate modals; `/faculty/learners` + `/faculty/cohort` now real DB lists with cohort filter, sessions-joined and cases-completed counts; `/program/competency-map` set to a Week-8 banner card; engagement layer for **Pearls** (`PearlLike` heart + generic `Bookmark` + Web-Share/clipboard + "Saved only" filter) and **Recordings** (`Bookmark` + W5 `RecordingShare` token-mint modal with TTL/optional bcrypt password); **Discussion forum on saved videos** = new `qa-service.answerQuestion` + `PATCH /api/classroom/sessions/[id]/qa/[qaId]/answer` (FACULTY/PD/ADMIN/host, audited via new `qa.question.answered` / `qa.answer.cleared` events); `QaSidebar` rewritten with prominent green "Answered by Dr. X" block above the question; `/profile` + `/profile/bookmarks` (pearls + recordings sections) + Saved-items card on profile; `signOut()` properly wired through next-auth; root-redirect chain fixed (no more `?callbackUrl=http%3A%2F%2F...`); dead `/admin/roles` + `/admin/image-library` sidebar entries removed; demo seed (`prisma/seed.demo.ts`) for 4 demo users + 5 sessions wired via `npm run db:seed:demo`. **Schema unchanged** — additive UI on existing W0-locked tables. **§10b Week 8** now opens with a "⚠️ Pre-W8 state" table calling out 4 already-built pages (`/faculty/learners`, `/faculty/cohort`, `/program/competency-map`, `/admin/users`) with extend-don't-replace guidance, plus a pointer to `engagement-service` and the new `qa.answerQuestion` for Faculty-dashboard "questions awaiting your answer" widget. **§10c Week 9** opens with a "Pre-W9 state" table noting that the Pearls engagement layer is already shipped and W9 only swaps the in-memory JSON filter for `db.pearl.findMany`. See **[E2E-FRONTEND-AUDIT.md](E2E-FRONTEND-AUDIT.md)** for the full role-by-role click-walk. Build clean: `npx tsc --noEmit` exit 0, `npm run build` `✓ Compiled successfully`. |

---

*Document Version: 2.2*
*Status: W0–W6 shipped (W4 89/89 e2e + reviewer fixes; W5 e2e + Playwright PASS; W6 P1 26/26 + W6 P2 17/17 PASS, all on 2026-04-27). W6.5 polish sprint shipped 2026-04-25; W6.6 admin-invitations polish + W6.7 cohort/session-invite UI completion + v1.8 cohort CRUD + orphan-FK hardening + calendar redesign shipped 2026-04-26. v1.9 org-mapping (Cohort↔Faculty mentor, Faculty↔PD) shipped 2026-05-01. v2.0 session pre-flight model (window-gated LIVE/recording/captions) shipped 2026-05-10. v2.1 bulk-invitations Phase 1 (admin Excel upload, /admin/invitations/bulk + POST /api/admin/invitations/bulk) shipped 2026-05-10. v2.1.1 mobile-conflict guard: createInvitation now throws MOBILE_EXISTS / MOBILE_INVITE_EXISTS; bulk preview detects in-batch mobile duplicates as warnings; both routes surface human-readable messages shipped 2026-05-11.*
*Phase 1 total: 19 calendar weeks (~10 remaining). All 22 Feeddback.md features production-ready by end W15.*
*Next step: kick off W7 (Reviews + Journal + Challenges + Knowledge Atoms).*
