# Vaidix — Identity, Role-Awareness & Classroom Empty-State Fix Plan

| Field | Value |
|---|---|
| **Document status** | v1.0 — pre-implementation, drafted for Codex adversarial review |
| **Date** | 2026-04-25 |
| **Owner** | Symbiosys Technologies |
| **Audience** | Codex review → engineering implementation |
| **Severity** | **P0 — every authenticated user lands on the resident view regardless of their actual `Role`** |
| **Pilot impact** | LVPEI go-live blocker. Faculty/PDs cannot reach `/admin/users`, `/program/*`, faculty cohort tools through the UI shell. |

---

## 1. Executive summary

The auth pipeline (NextAuth v5 → JWT → `session.user.role`) correctly stores each user's Prisma `Role`. The **UI shell does not consume it**. Sidebar, header avatar, and `DashboardPage` all read from `RoleContext`, a client provider seeded with `useState<UserRole>('resident')` and a hardcoded `DEMO_USERS` map. Result: an `ADMIN` login sees the Resident sidebar and Resident dashboard until they manually use the (publicly visible) "Switch Role" dropdown.

This plan replaces the demo-mode `RoleProvider` with a session-driven identity provider, adds the missing `EXTERNAL_LEARNER` shell, gates role-switching to admins (and behind a build flag), and seeds demo `TeachingSession` rows so the Classroom page is not empty on first launch.

**Scope: 11 file changes, 1 new file, 2 deletions, 1 seed expansion. No schema migration. No new dependencies.**

---

## 2. Root-cause analysis

### 2.1 The identity bridge is missing

```
NextAuth v5
  ├─ auth.ts            : authorize() returns { id, email, name, role, passwordVersion }
  ├─ auth.config.ts     : jwt() and session() callbacks copy role onto session.user.role
  └─ session.user.role  : Prisma `Role` enum, available server-side via auth() and client-side via useSession()
                                              │
                                   ── MISSING WIRE ──
                                              │
RoleProvider (src/contexts/role-context.tsx)
  ├─ useState<UserRole>('resident')   ← hardcoded initial
  └─ DEMO_USERS[currentRole]          ← fictitious profiles baked into client bundle
                                              │
       ┌──────────────────────────────────────┼──────────────────────────────┐
       ▼                                      ▼                              ▼
  AppSidebar reads currentRole       Header reads currentUser/role      DashboardPage switches on currentRole
```

Every authenticated route under `(platform)/` resolves identity through `RoleContext`, which has no upstream from the session. Any consistency between session role and UI is coincidental (`'resident'` initial happens to equal Prisma `RESIDENT` lowercased).

### 2.2 Confirmed blast radius — every callsite of `useRole` / `currentUser` / `currentRole`

| File | Line(s) | Reads | Notes |
|---|---|---|---|
| `src/contexts/role-context.tsx` | 7-78 | source of truth | replace |
| `src/components/layout/app-sidebar.tsx` | 100 | `currentRole`, `currentUser` | nav lookup |
| `src/components/layout/header.tsx` | 43 | all 4 fields + `switchRole` | display + dropdown |
| `src/components/layout/role-switcher.tsx` | 22 | all 4 fields | unused — delete |
| `src/app/(platform)/dashboard/page.tsx` | 157, 591, 756, 906, 999-1006 | `currentUser`, `currentRole` | 4 dashboards + router |
| `src/app/(platform)/topics/[topicId]/review/page.tsx` | 1720, 1766 | `currentUser.name` only | demo banner copy |
| `src/components/layout/app-sidebar.tsx.bak` | — | — | committed backup, delete |

Classroom components (`live-session.tsx`, `chat-panel.tsx`, etc.) take `currentUser` as a **prop from server-fetched data**, not from `RoleContext`. They are correct already and out of scope.

### 2.3 Profile fields the dashboard reads but the real schema does not have

`DEMO_USERS` invents fields the Prisma schema never defines. Real columns:

| UI reference | DEMO_USERS field | Real schema source |
|---|---|---|
| `currentUser.designation` | `designation: 'Senior Resident'` | **does not exist** — derive from `Role` label |
| `currentUser.department` | `department: 'Vitreoretinal Surgery'` | **does not exist** — closest is `UserProfile.subspecialty` (free text) or `UserProfile.affiliation` |
| `currentUser.yearOfTraining` | `'PGY-3'` | derive from `UserProfile.yearOfResidency: Int?` → `\`PGY-${n}\`` |
| `currentUser.specialization` | `'Ophthalmology'` | `UserProfile.subspecialty` |

This is why we need to load `User` **with** `profile` server-side, not just trust the JWT.

### 2.4 Why Classroom is empty (not broken)

`src/app/(platform)/classroom/page.tsx:38-51` queries `db.teachingSession.findMany` with filters: `deletedAt: null`, `approvalStatus: APPROVED`, `scheduledStart < +30d`, `scheduledEnd > -90d`. The query is correct. There are zero rows because `prisma/seed.ts` only creates the super admin user — no sessions, no cohorts, no participants. First-deploy production sees the same empty screen.

The empty state currently offers no CTA. PD/ADMIN users staring at it have no obvious path to `/calendar/new`.

### 2.5 Out-of-shell gaps surfaced

| # | Gap | Severity |
|---|---|---|
| a | `EXTERNAL_LEARNER` has no `SIDEBAR_NAV` entry, no `ROLE_LABELS` entry, no dashboard branch. `modules.ts:38,47` already grants them Pearls/Atlas/Classroom. | P1 — invitation code path exists but the UI is dead-on-arrival |
| b | `Switch Role` dropdown in `header.tsx:152-176` is rendered for every user. Server routes still gate, but the affordance leaks all admin labels to residents. | P1 — UX leak / surprise-factor; not a security boundary |
| c | `DEMO_USERS` constant ships fictitious names/emails into the client bundle for all users. | P2 — content hygiene |
| d | `app-sidebar.tsx.bak` committed. | P2 — repo hygiene |

---

## 3. Fix strategy (decisions + rationale)

| Decision | Why | Rejected alternative |
|---|---|---|
| **Move `RoleProvider` from root `layout.tsx` → `(platform)/layout.tsx`.** Root layout serves `/login`, which doesn't need identity. | Login page should not be wrapped in an identity context that has no session. | Keep at root + add session check: more re-renders, more null-handling. |
| **`(platform)/layout.tsx` becomes a server component** that calls `auth()` + `db.user.findUnique({ include: { profile: true } })`, then passes a typed `IdentityBootstrap` object to a thin client `RoleProvider`. | Fetch once per navigation, type-safe, no duplicate session round-trips. Existing pages under `(platform)` already redirect to `/login` if no session, so the auth call is not new work. | Adopt `<SessionProvider>` from `next-auth/react`: pulls `useSession()` hook into every consumer, but doesn't give us `profile.yearOfResidency` etc. without a second fetch. |
| **Delete `DEMO_USERS`. Identity = `{ id, name, email, role, designation, department, yearOfTraining, avatarUrl }`** derived from real DB row. `designation` becomes the localized `ROLE_LABELS[role]` (no DB column). `department` = `profile.subspecialty ?? null`. `yearOfTraining` = `profile.yearOfResidency ? \`PGY-${n}\` : null`. | Field-mapping is explicit and centralized in one helper (`mapUserToIdentity`). UI keeps its existing field names. | Add new columns to `User` for `designation`/`department`: schema bloat, requires migration. |
| **Add `EXTERNAL_LEARNER` to `UserRole`, `ROLE_LABELS`, `SIDEBAR_NAV`, dashboard switch.** Sidebar = Dashboard, Cases, Pearls, Atlas, Classroom, Calendar (matches `modules.ts` defaults already in code). Dashboard = a slim `ExternalLearnerDashboard` reusing `ResidentDashboard`'s components without DOPS/Reviews widgets. | Closes the dead-on-arrival gap with minimum surface area. Nav source remains `SIDEBAR_NAV` (no refactor to `modules.ts`-driven nav). | Generate sidebar from `modules.ts` registry: bigger refactor, would need icon/badge fields added to `ModuleDef`. Defer. |
| **Replace `Switch Role` dropdown with admin-only "Impersonate (dev)" gated behind `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === 'true'`.** When active, set a banner: "Viewing as <role> — Stop". Backed by an `?as=<role>` URL param read by the provider; admin-only enforcement via session check before applying. **No server-side impersonation** — purely a client display override, server routes still enforce real role. | Lets demos keep working; removes the leak in production builds; explicit "this is dev/demo only" labelling. Avoids building a real impersonation system (audit trail, separate JWT claim) which would be a P1 product feature, not a fix. | Keep it everywhere: ships demoware to prod. Build full audited impersonation: out of scope, large. |
| **Seed `TeachingSession` demo rows in a separate `prisma/seed.demo.ts` runnable via `npm run db:seed:demo`.** Default `npm run db:seed` keeps to the super-admin-only minimum. | Prod-safe by default; demo data opt-in. | Add demo rows to `seed.ts`: pollutes prod first-deploy with fake sessions. |
| **Add a "Schedule a session →" CTA to the Classroom empty state**, visible only when `session.user.role` ∈ `{PROGRAM_DIRECTOR, ADMIN}` (matching `/classroom/new` redirect logic at line 10-12). | Closes the discoverability gap surfaced in the audit. One-line server-side conditional. | Auto-redirect PDs/admins to `/calendar/new`: surprising; some PDs land on /classroom intentionally to monitor. |
| **Delete `role-switcher.tsx` and `app-sidebar.tsx.bak`.** | Dead code; the header dropdown is the only switcher actually rendered. | Keep "just in case": violates code-hygiene rule for production-bound branch. |

---

## 4. Implementation phases

The plan is **one PR**. Splitting it would leave the tree in a broken intermediate state (RoleProvider still hardcoded while sidebar moved). Phases below are suggested commit boundaries within the PR.

### Phase 1 — Identity primitives (no UI change yet)
1. `src/lib/types.ts`: add `'external_learner'` to `UserRole` union.
2. `src/lib/constants.ts`:
   - extend `ROLE_LABELS` with `external_learner: 'External Learner'`.
   - extend `SIDEBAR_NAV` with `external_learner` entry (Dashboard, Cases, Pearls, Atlas, Classroom, Calendar).
3. `src/lib/identity.ts` (new): export `mapPrismaRoleToUserRole(role: Role): UserRole` and `mapUserToIdentity(user: User & { profile?: UserProfile | null }): Identity`. Single source of truth for the field-mapping table in §2.3.

### Phase 2 — Session-driven `RoleProvider`
4. `src/contexts/role-context.tsx`: rewrite.
   - Remove `DEMO_USERS`, remove `useState` initial-resident hack.
   - Accept `initialIdentity: Identity` via props from the `(platform)/layout.tsx` server boundary.
   - `currentUser`, `currentRole` derived from `initialIdentity`.
   - `switchRole`: only mutates state when `process.env.NEXT_PUBLIC_ENABLE_ROLE_SWITCHER === 'true'` **and** `initialIdentity.role === 'admin'`. Otherwise no-op (can be a thrown dev warning in non-prod).
   - `allRoles`: only returned when admin + flag both true. Otherwise empty.
5. `src/app/layout.tsx`: remove `RoleProvider` wrapper.
6. `src/app/(platform)/layout.tsx`: convert to server component. Call `auth()`, redirect to `/login` if absent (defense-in-depth; middleware also enforces). Fetch `db.user.findUnique({ where: { id }, include: { profile: true } })`. Map to `Identity`. Pass to a new `<PlatformShell initialIdentity={...}>` client component which holds the existing sidebar/header/main markup and wraps children in the rewritten `RoleProvider`.

### Phase 3 — UI shell consumers
7. `src/components/layout/header.tsx`:
   - Initials, name, email, role badge — all sourced from new `currentUser`.
   - `Switch Role` block: render only when `allRoles.length > 0` (admin + dev flag).
   - When impersonation active, render a thin banner above the dropdown: "Viewing as <Role> · Reset".
8. `src/components/layout/app-sidebar.tsx`: no signature change, but now `currentRole` reflects real session. Add fallback when `SIDEBAR_NAV[currentRole]` is undefined (defensive — should never happen post-Phase 1).
9. `src/app/(platform)/dashboard/page.tsx`:
   - Replace dummy `'PGY-3 · Vitreoretinal Surgery'` strings with the mapped identity. Where `yearOfTraining`/`department` are null, fall back to `ROLE_LABELS[role]` so the banner never shows "null".
   - Add `case 'external_learner': return <ExternalLearnerDashboard />` to the role switch. Implement `ExternalLearnerDashboard` as a slim resident-style dashboard (welcome banner, recent sessions, suggested cases). No DOPS/EPA widgets.
10. `src/app/(platform)/topics/[topicId]/review/page.tsx`: keep `useRole` import; behavior unchanged because `currentUser.name` is now real. No code edit needed once Phase 2 lands.

### Phase 4 — Cleanup + Classroom polish
11. Delete `src/components/layout/role-switcher.tsx`.
12. Delete `src/components/layout/app-sidebar.tsx.bak`.
13. `src/app/(platform)/classroom/page.tsx`:
    - Add the conditional CTA to `Empty` component for `PROGRAM_DIRECTOR | ADMIN`: link to `/calendar/new`.
    - Keep the existing copy for residents/faculty/external learners.

### Phase 5 — Demo data
14. `prisma/seed.demo.ts` (new):
    - Idempotent. `npm run db:seed:demo` runs after the base seed.
    - Inserts: 2 cohorts, 6 invited+activated users (one per role except admin, plus `external_learner`), 2 SCHEDULED sessions in next 14 days, 1 LIVE-flagged session (status overridden), 2 ENDED sessions in past 30 days, all with `approvalStatus: APPROVED`.
    - Wire to `package.json` scripts: `"db:seed:demo": "tsx prisma/seed.demo.ts"`.

---

## 5. Test plan

**No new test framework. Reuses existing `scripts/e2e-w*.ts` harness pattern + Playwright suite already in `tests/`.**

### 5.1 Manual smoke (must pass before merge)

For each role, create one user via `/admin/invitations` (or seed via demo), log in, verify:

| Role | Sidebar items | Dashboard branch | Header badge |
|---|---|---|---|
| `RESIDENT` | 8 (Dashboard, Topics, My Progress, Reviews, Journal, Classroom, Calendar, Challenges) | `ResidentDashboard` | "Resident / Fellow" teal |
| `FACULTY` | 9 (Dashboard, Learners, Assess, Cases, AI Audit, Cohort Analytics, Classroom, Calendar, Approvals) | `FacultyDashboard` | "Faculty" violet |
| `PROGRAM_DIRECTOR` | 8 (Dashboard, Competency Map, Milestones, Accreditation, Learners, Cohort Analytics, Calendar, Cohorts) | `ProgramDirectorDashboard` | "Program Director" amber |
| `ADMIN` | 11 (Dashboard, Institution, Users, Cohorts, Calendar, Roles, Knowledge Base, ML Training Queue, Image Library, Settings, Audit Logs) | `AdminDashboard` | "Admin" rose |
| `EXTERNAL_LEARNER` | 6 (Dashboard, Cases, Pearls, Atlas, Classroom, Calendar) | `ExternalLearnerDashboard` | "External Learner" slate |

### 5.2 Switch-role isolation

- With `NEXT_PUBLIC_ENABLE_ROLE_SWITCHER` **unset** in `.env.local`, log in as ADMIN: confirm "Switch Role" block in profile dropdown is **absent**.
- With the flag set to `'true'`, log in as admin: dropdown appears, switching to "Resident" updates sidebar/dashboard but the header shows the "Viewing as Resident · Reset" banner.
- With the flag set, log in as resident: dropdown is **still absent** (admin-only guard).
- Switch to admin then navigate to `/admin/users`: works. Switch to resident then navigate to `/admin/users`: server-side `requireAuth` check rejects (existing behavior — verify still holds because session JWT is unchanged).

### 5.3 New automated coverage in `scripts/e2e-w6.ts` style

- `e2e-identity.ts`:
  1. Seed 5 users (one per role).
  2. For each, programmatic NextAuth sign-in (reuse pattern from `e2e-w1.ts`).
  3. Hit `/dashboard` and assert HTML contains role-specific marker (e.g., admin dashboard's "Total Users" stat card; PD dashboard's "Competency" heading).
  4. Hit `/classroom` and assert empty-state copy renders.
  5. As ADMIN, hit `/classroom` and assert "Schedule a session" CTA renders. As RESIDENT, assert it does not.

### 5.4 Playwright regression

- Add one spec under `tests/identity.spec.ts`:
  - Login flow for each of the 5 roles → screenshot the sidebar → assert nav item count.
  - Asserts negative test: login as resident, profile dropdown does **not** contain text "Switch Role".

### 5.5 Build / type / lint

- `npm run build` must pass with no `'external_learner'` exhaustiveness warnings.
- `npm run lint` must pass.
- `tsc --noEmit` for the dashboard's switch must remain exhaustive (TypeScript will error if `external_learner` is added to the union without a `case` — this is intentional belt-and-braces).

### 5.6 Database / seed

- `npm run db:seed` (production seed): assert exactly 1 user row (`sandeep@vaidix.local`), 0 sessions.
- `npm run db:seed:demo`: assert ≥6 users, ≥5 sessions, no duplicate emails on re-run.

---

## 6. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `db.user.findUnique({ include: profile })` adds latency to every `(platform)` page render. | Medium | Low — single indexed PK lookup, ~3ms locally, ~10ms on LVPEI Postgres. | Wrap in `React.cache()` so the same render does not re-query. Acceptable; auth() already hits the DB for password-version check. |
| Existing Playwright tests assume hardcoded "Dr. Ananya Krishnan" in header. | Low — searched `tests/` for "Ananya" yields zero hits, but verify pre-merge. | Test breakage. | Run full Playwright suite locally; update any string assertions to use the seeded test user's name. |
| Removing `DEMO_USERS` breaks any storybook/dev-only consumer. | Low — `DEMO_USERS` only imported inside `role-context.tsx`. | None. | Confirmed via grep. |
| `EXTERNAL_LEARNER` dashboard has no real implementation backing some widgets (no DOPS records etc.). | Medium | Low — by design we render only the universal widgets (welcome, sessions, cases). | Implement as composition of existing `<WelcomeBanner>`, `<RecentActivity>`-style components. ~80 lines. |
| Admin signs in with `?as=resident` URL param crafted by a bystander. | Low | None — the param only changes UI display. Server routes still see ADMIN in JWT. | Document this explicitly in the PR description so reviewers don't think it's an auth bypass. |
| Seeding `TeachingSession` rows with `approvalStatus: APPROVED` skips the audit trail expected for real sessions. | Low | Demo-only; flagged by `seed.demo.ts` filename. | Add a `seedSource: 'demo'` tag in the session metadata so they're filterable/removable. |
| `useSession()` is **not** used here, so a future contributor who reaches for it will create a parallel identity path. | Medium over time | Code drift. | Add a 6-line comment in the new `role-context.tsx` documenting the chosen pattern and pointing future contributors at it. |

---

## 7. Out of scope (deliberate)

These are surfaced in the audit but **deferred**:

1. **Real audited impersonation system** — separate "audit-imp-001" feature; needs `Impersonation` table, JWT claim, banner enforced server-side, audit log entries. Not blocking pilot.
2. **Sidebar generated from `modules.ts` registry instead of `SIDEBAR_NAV` constant** — would unify nav with permission system, but doubles the surface of this PR. Open as separate ticket "nav-from-modules-registry".
3. **Per-user module overrides on the sidebar** (`UserModulePermission` model already exists in schema). Sidebar currently respects role defaults only. Out of scope.
4. **Mid-session role change reflection** — if an admin demotes a logged-in user, the user's JWT keeps the old role until next sign-in. Pre-existing, not introduced by this PR.
5. **Avatar uploads** — `User.avatarUrl` is on the schema but no upload UI exists. Initials fallback is fine for pilot.

---

## 8. Acceptance criteria (binary)

- [ ] Login as `sandeep@vaidix.local` lands on **Admin** sidebar (11 items) and **Admin** dashboard.
- [ ] Login as a `RESIDENT` lands on **Resident** sidebar (8 items) and **Resident** dashboard.
- [ ] Login as a `FACULTY` lands on **Faculty** sidebar (9 items) and **Faculty** dashboard.
- [ ] Login as a `PROGRAM_DIRECTOR` lands on **Program Director** sidebar and dashboard.
- [ ] Login as an `EXTERNAL_LEARNER` lands on a 6-item sidebar and a non-empty dashboard.
- [ ] The header avatar/name reflects the **logged-in** user, never `Dr. Ananya Krishnan` from `DEMO_USERS`.
- [ ] In production-style build (`NEXT_PUBLIC_ENABLE_ROLE_SWITCHER` unset), the "Switch Role" dropdown is absent for **all** roles, including admin.
- [ ] `Classroom` page shows ≥1 upcoming session after `db:seed:demo`. As `RESIDENT` the empty state shows the bare message; as `ADMIN`/`PROGRAM_DIRECTOR` it shows the "Schedule a session →" CTA.
- [ ] `app-sidebar.tsx.bak` and `role-switcher.tsx` are deleted.
- [ ] `npm run build`, `npm run lint`, `tsc --noEmit`, and the new `e2e-identity.ts` all pass.
- [ ] No new schema migration. Diff in `prisma/schema.prisma` is zero.

---

## 9. Files changed (summary)

| Path | Change | LoC delta (est.) |
|---|---|---|
| `src/contexts/role-context.tsx` | rewrite | -45 / +65 |
| `src/lib/types.ts` | extend union | +1 |
| `src/lib/constants.ts` | extend label + nav maps | +12 |
| `src/lib/identity.ts` | **new** | +60 |
| `src/app/layout.tsx` | remove provider | -2 |
| `src/app/(platform)/layout.tsx` | server-fetch + provider boundary | -10 / +35 |
| `src/components/layout/header.tsx` | gate switcher, banner | -10 / +25 |
| `src/components/layout/app-sidebar.tsx` | defensive null nav | +4 |
| `src/components/layout/role-switcher.tsx` | **delete** | -57 |
| `src/components/layout/app-sidebar.tsx.bak` | **delete** | -N |
| `src/app/(platform)/dashboard/page.tsx` | identity field mapping + ext-learner branch | +90 |
| `src/app/(platform)/classroom/page.tsx` | empty-state CTA | +12 |
| `prisma/seed.demo.ts` | **new** | +180 |
| `package.json` | new script | +1 |
| `scripts/e2e-identity.ts` | **new** | +120 |
| `tests/identity.spec.ts` | **new** | +90 |

**Net: ~+700 LoC, ~−180 LoC, 4 new files, 2 deletions, 0 schema migrations.**

---

## 10. References

- Auth pipeline: `src/auth.ts:11-36`, `src/auth.config.ts:21-37`
- Broken provider: `src/contexts/role-context.tsx:55-71`
- Hardcoded demo users: `src/contexts/role-context.tsx:7-44`
- Sidebar consumer: `src/components/layout/app-sidebar.tsx:100`
- Dashboard router: `src/app/(platform)/dashboard/page.tsx:998-1007`
- Classroom query: `src/app/(platform)/classroom/page.tsx:38-51`
- Module registry already aware of `EXTERNAL_LEARNER`: `src/lib/modules.ts:38,47`
- Prisma `Role` enum: `prisma/schema.prisma:24-30`
- Existing seed: `prisma/seed.ts:114-137`

## 11. Change log

| Version | Date | Author | Note |
|---|---|---|---|
| v1.0 | 2026-04-25 | Claude (Opus 4.7) | Initial draft for Codex review |
