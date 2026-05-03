# Vaidix — End-to-End Frontend Audit

| Field | Value |
|---|---|
| **Document status** | v1.0 — post Phase 1/2/3 + Discussion forum + Bookmarks |
| **Date** | 2026-04-25 |
| **Scope** | Walk every role's journey as a real user. Mark ✅ wired / ⚠️ partial-by-design / ❌ broken. |
| **Verification** | Static code audit — every interactive control traced to its handler. `npx tsc --noEmit` exit 0, `npm run build` `✓ Compiled successfully`. |

---

## 1. Authentication flow

| Step | Status | Notes |
|---|---|---|
| `GET /` signed-out → `/login` | ✅ | Server-side, no `?callbackUrl=` noise (added `/` to public list). |
| `GET /` signed-in → `/dashboard` | ✅ | Auth-aware redirect. |
| `GET /login` signed-in → `/dashboard` | ✅ | Server component bounces. |
| Sign-in with email/mobile/username + password | ✅ | NextAuth + bcrypt + lockout + audit. |
| Failed attempts | ✅ | Account locks after 5 attempts (30 min). |
| Sign-out | ✅ | `signOut({ callbackUrl: '/login' })` — cookie cleared. |

---

## 2. Resident journey

Login as `RESIDENT` → 8-item sidebar (Dashboard, Topics, My Progress, Reviews, Journal, Classroom, Calendar, Challenges).

| Click path | Status | Notes |
|---|---|---|
| **Dashboard** → `ResidentDashboard` | ✅ | Real session-driven name. Mock stats (W7-W11 scope). |
| **Topics** → `/topics` | ✅ | DB-backed (W6). |
| **Topics → [topic]** | ✅ | Topic landing pages. |
| **My Progress** → `/progress` | ⚠️ | Mock charts. W8 scoring data lights this up. |
| **Reviews** → `/reviews` | ⚠️ | Spaced-repetition queue stub. W7 scope. |
| **Journal** → `/journal` | ✅ | DB-backed. New entry form works. |
| **Classroom** → `/classroom` | ✅ | DB-backed list (Live/Upcoming/Past tabs). |
| **Classroom → join live session** | ✅ | LiveKit room, chat, hand raise, breakouts. |
| **Classroom → past recording** | ✅ | Vidstack HLS player + Q&A sidebar + bookmark + share button. |
| **Classroom → ask Q&A** | ✅ | Posts at current playback timestamp. |
| **Recording → bookmark** | ✅ | Toggle bookmark, optimistic UI. |
| **Calendar** → `/calendar` | ✅ | react-big-calendar, ICS subscribe, RRULE. |
| **Challenges** → `/challenges` | ⚠️ | Stub. W7 scope. |
| **Header avatar → View Profile** | ✅ | `/profile` shows real session-driven user data. |
| **Header avatar → Sign out** | ✅ | Real `signOut()`. |
| **Profile → Saved items** | ✅ | `/profile/bookmarks` shows pearls + recordings; remove button works. |
| **Pearls (via topic-detail or direct URL)** | ✅ | Heart, Bookmark, Share (Web Share / clipboard). "Saved only" filter. |

---

## 3. Faculty journey

Login as `FACULTY` → 9-item sidebar (Dashboard, Learners, Assess, Cases, AI Audit, Cohort Analytics, Classroom, Calendar, Approvals).

| Click path | Status | Notes |
|---|---|---|
| **Dashboard** → `FacultyDashboard` | ✅ | Real session-driven name. Mock stats W8 scope. |
| **Learners** → `/faculty/learners` | ✅ **(new in this round)** | Real DB list + cohort filter + sessions joined + cases completed. URL search `?q=` persists. |
| **Assess → DOPS** → `/faculty/assess/dops` | ⚠️ | Form-only stub. W8 ships full DOPS write path. |
| **Cases** → `/faculty/cases` | ✅ | Faculty-authored case management. |
| **AI Audit** → `/faculty/ai-audit` | ✅ | LLM moderation review queue. |
| **Cohort Analytics** → `/faculty/cohort` | ✅ **(new in this round)** | Real counts (residents, cohorts, sessions 90d, avg attendance). Scoring section banner W8. |
| **Classroom → schedule** | ✅ | "Schedule a session" CTA visible (faculty=host). |
| **Classroom → live session faculty controls** | ✅ | Mute all, disable chat, stop recording, breakout management. |
| **Recording → mark Q&A as Answered** | ✅ **(new in this round)** | Faculty sees "Mark answered" button on every question. Composer accepts up to 8000 chars. Audited. |
| **Recording → edit existing answer** | ✅ | Pencil icon on answered questions. |
| **Recording → clear answer** | ✅ | "Clear answer" button on the edit composer. |
| **Recording → share** | ✅ | TTL 1/7/14/30 days, optional bcrypt password. Token shown once, sha256-hashed at rest. |
| **Recording → bookmark** | ✅ | Same toggle as residents. |
| **Calendar** → `/calendar` | ✅ | Same component as residents. |
| **Calendar → New session** | ✅ | RRULE recurring, cohort visibility, send invites. |
| **Approvals** → `/inbox/approvals` | ✅ | PD-proposed sessions awaiting faculty approval. |

---

## 4. Program Director journey

Login as `PROGRAM_DIRECTOR` → 8-item sidebar (Dashboard, Competency Map, Milestones, Accreditation, Learners, Cohort Analytics, Calendar, Cohorts).

| Click path | Status | Notes |
|---|---|---|
| **Dashboard** → `ProgramDirectorDashboard` | ✅ | Real session-driven name. EPA/heatmap mock. |
| **Competency Map** → `/program/competency-map` | ⚠️ **(updated)** | Clear "Week 8" banner. Real EPA list + entrustment scale rendered. Heatmap populates from real DOPS/EPA records when W8 ships. |
| **Milestones** → `/program/milestones` | ⚠️ | Mock. W8 scope. |
| **Accreditation** → `/program/accreditation` | ⚠️ | Mock. W8 scope. |
| **Learners** → `/faculty/learners` | ✅ | Same DB-backed page faculty uses. |
| **Cohort Analytics** → `/faculty/cohort` | ✅ | Real counts. |
| **Calendar → New session** | ✅ | PD can propose for any faculty (PD→Faculty approval flow per W3). |
| **Cohorts** → `/admin/cohorts` | ✅ | Read access; create flow is admin-only at API level. |
| **Recording → mark Q&A as Answered** | ✅ | PD has same authority as faculty. |
| **Recording → share / pin** | ✅ | PD-level authority. |

---

## 5. Admin journey

Login as `ADMIN` (e.g. `sandeep@vaidix.local`) → 11-item sidebar.

| Click path | Status | Notes |
|---|---|---|
| **Dashboard** → `AdminDashboard` | ✅ | Mock activity feed. W12 scope for real audit feed. |
| **Institution** → `/admin/institution` | ✅ **(new in this round)** | Read-only LVPEI metadata + live counts: total/active users, cohorts, sessions, role breakdown. |
| **Users** → `/admin/users` | ✅ **(new in this round)** | Real DB list. Add User opens InviteModal. Pencil opens role-change modal (audited via `UserRoleHistory`). UserX deactivates (bumps `passwordVersion` to invalidate sessions, sends email, audited). UserCheck reactivates suspended/deactivated users. Cannot self-modify. |
| **Cohorts** → `/admin/cohorts` | ✅ | DB-backed. Create/edit/archive cohorts. |
| **Calendar** → `/calendar` | ✅ | Admin can schedule on behalf of any faculty. |
| **Roles** → `/admin/roles` | ❌ | Route not present. **Bug → see fixes below.** |
| **Knowledge Base** → `/admin/knowledge-base` | ✅ | DB-backed CRUD. |
| **ML Training Queue** → `/admin/training-queue` | ✅ | BullMQ queue inspection. |
| **Image Library** → `/admin/image-library` | ❌ | Route not present. **Bug → see fixes below.** |
| **Settings** → `/admin/settings` | ✅ | DB-backed. |
| **Audit Logs** → `/admin/audit-logs` | ✅ | Real `AuditEvent` query, filterable. |
| **Header → Settings shortcut** | ✅ **(new in this round)** | Visible only to admins. |
| **Profile / Saved items** | ✅ | Same as resident; counts admin's bookmarks too. |

---

## 6. External Learner journey

Login as `EXTERNAL_LEARNER` → 6-item sidebar (Dashboard, Cases, Pearls, Atlas, Classroom, Calendar).

| Click path | Status | Notes |
|---|---|---|
| **Dashboard** → `ExternalLearnerDashboard` | ✅ | Slim quick-link grid (Cases, Pearls, Atlas, Live Sessions). |
| **Cases / Pearls / Atlas / Classroom / Calendar** | ✅ | Same routes as residents. |
| **Recording → Q&A** | ✅ | Can post questions. Cannot mark as answered (correct). |
| **Pearls → Like/Bookmark/Share** | ✅ | Engagement same as residents. |
| **Profile / Saved items** | ✅ | Bookmarks page works. |

---

## 7. Cross-cutting infrastructure (W1–W6 features)

| Feature | Status | Notes |
|---|---|---|
| **Live video conferencing** (W2) | ✅ | LiveKit-backed. Tokens, screen share, hand raise, chat, faculty controls, admissions/waiting room, share-link. |
| **Recording → MinIO HLS playback** (W4) | ✅ | Vidstack player. Multi-language captions. |
| **Live captions** (W4) | ✅ | LiveKit Agent ingest. |
| **Document upload + AI classify** (W4) | ✅ | At `/faculty/documents`. PHI scanner gates session-tagging. |
| **WhatsApp pearl delivery** (W4) | ✅ | Worker scheduled. |
| **Live leaderboards** (W4) | ✅ | In-session sidebar. |
| **Coach + Reflection bots** (W4) | ✅ | Gemini-backed. |
| **Bloom's analytics + Kirkpatrick L1/L2** (W4) | ✅ | Per-session post-event metrics. |
| **Q&A — post, like, pin, reply** (W5) | ✅ | Pre-existing. |
| **Q&A — official answer** (added) | ✅ **(new in this round)** | `answerQuestion` service + `PATCH /api/.../qa/:qaId/answer` + audited (`qa.question.answered` / `qa.answer.cleared`). UI shows green-bordered "Answered by Dr. X" block above the question. |
| **Breakouts** (W5) | ✅ | Random + self-select. AI grouping deferred to W11. |
| **Recording share token** (W5) | ✅ **(now wired in UI)** | Share modal mints W5 token, optional bcrypt password, TTL clamped 1–30 days. |
| **Cases full chat engine** (W6) | ✅ | Socratic 5-stage dialogue. Gemini Phase-A. |
| **Pre-Conference Q&A** (W6) | ✅ | Submit / vote / themes / dashboard. |
| **Pearl like (PearlLike)** | ✅ **(now wired in UI)** | Heart toggle, optimistic count. |
| **Bookmarks (generic)** | ✅ **(now wired in UI)** | Toggle on pearl + recording. `/profile/bookmarks` page lists both. |
| **Web Share API** (Pearls) | ✅ | Falls back to clipboard copy. |
| **Audit log coverage** | ✅ | All sensitive actions write `AuditEvent` rows. |

---

## 8. Real bugs found (not in build plan)

### 8.1 Sidebar nav links to routes that don't exist

The admin sidebar advertises **two routes that 404**:

| Sidebar entry | Href | Route file | Status |
|---|---|---|---|
| **Roles** | `/admin/roles` | none | ❌ 404 |
| **Image Library** | `/admin/image-library` | none | ❌ 404 |

Either build minimal pages or remove the entries from `SIDEBAR_NAV.admin`. Recommendation: remove for now (Roles is implicit in user-management; Image Library is W4 stream-C deliverable that didn't ship a UI yet).

### 8.2 Pre-existing lint errors in `/classroom/page.tsx`

`Date.now()` calls inside the server component — flagged by `react-hooks/purity`. Pre-existing (not from any recent change). Fix by extracting `const NOW = Date.now()` once outside the query construction. Cosmetic; doesn't affect functionality.

### 8.3 Mock-data still backing some content pages

Acceptable per build plan (W7-W11 wiring), but should be flagged:

| Page | Mock data? | Build-plan week |
|---|---|---|
| `/atlas` | content from JSON; DB has same IDs seeded | content overlap, no fix needed |
| `/topics/[id]/learn` | content scaffolding | W7 |
| `/topics/[id]/review` | content scaffolding | W7 |
| `/faculty/assess/dops` | form-only | W8 |

These are **content** mocks, not user-data mocks — they don't fabricate user activity. Distinct from the bugs we already fixed (`/admin/users` showing fake "Dr. Pathengay" rows alongside the real DB).

---

## 9. Recommended Tier-2 fixes (next session)

If you want to clear the last 404s and make every sidebar entry resolve:

1. **Remove or build `/admin/roles` and `/admin/image-library`** — 2-line edit to `SIDEBAR_NAV.admin` to remove, or a 60-line stub for each.
2. **Clean up `Date.now()` in `/classroom/page.tsx`** — purity lint, cosmetic.
3. **Wire faculty `/faculty/assess/dops` to write a real `DopsAssessment` row** — pre-empts W8.
4. **Add `/profile/bookmarks` to the resident dashboard** as a "Recently saved" widget.

---

## 10. Summary

**What works end-to-end as a frontend user:**

1. Admin invites learner via `/admin/users` "Add User" button → email goes out → learner accepts at `/invitations/[token]` → password set → can log in.
2. Admin (or PD) creates cohort at `/admin/cohorts` and assigns the learner.
3. PD (or admin) schedules live session at `/calendar/new`. Faculty approves at `/inbox/approvals`.
4. Learner sees session at `/classroom`. Joins at the scheduled time → LiveKit room, chat, hand raise, breakouts.
5. Recording auto-saves (W4 egress → MinIO → HLS).
6. After class, learner returns to `/classroom/[id]/recording`. Plays back, asks questions at timestamps, **bookmarks** the recording.
7. Faculty answers timestamped questions, **marks as answered** (green block prominently shown to all viewers). Faculty can also generate a **share link** with TTL + optional password.
8. Learner browses `/pearls`, **likes**, **bookmarks**, **shares** clinical wisdom. Filters by "Saved only" to find theirs.
9. Learner visits `/profile` → **Saved items** → sees all bookmarks (pearls + recordings) in one place. Click to open; trash icon to remove.
10. Learner signs out. JWT cleared, lands on `/login`.

This is the production demo flow you asked for. Schema unchanged, audit log clean, no new dependencies.
