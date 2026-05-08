// ════════════════════════════════════════════════════════════════════════════
// Session visibility helpers — shared across W6.8 services
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the same rules used by pre-questions-service.userCanSeeSession.
// Extracted here so study-pack, pre-case, readiness services share one
// implementation. We deliberately did NOT refactor pre-questions to use this
// module to avoid touching shipped W6 code; the rules are identical and
// covered by pre-questions e2e tests so drift would surface immediately.

import { db } from '@/lib/db';
import { Role, SessionApprovalStatus, SessionVisibility, type Prisma } from '@prisma/client';
import { getUserCohortIds } from '../cohort-service';

export interface SessionVisibilityActor {
  userId: string;
  role: Role;
  /**
   * W6.11 — actor's currently active program. Optional for backwards-compat
   * during the W6.11 rollout: the listing entry-point routes (classroom,
   * calendar, dashboard upcoming) MUST pass it so admins/PDs are scoped to
   * their active tenant; deeper paths (visibility checks on a known sessionId)
   * tolerate omission since the session id is the security boundary there.
   *
   * Once every caller passes it (Phase-2 audit), the optional marker drops.
   */
  activeProgramId?: string;
}

/**
 * W6.11 — build the program-scoping fragment. Returns an empty fragment if
 * the actor has no active program (defensive — should not happen in
 * authenticated requests because requireAuthWithProgram fails first).
 */
export function buildProgramScope(actor: SessionVisibilityActor): Prisma.TeachingSessionWhereInput {
  return actor.activeProgramId ? { programId: actor.activeProgramId } : {};
}

/**
 * Build a Prisma `TeachingSessionWhereInput` fragment encoding "which sessions
 * is this actor allowed to see in their calendar/listing surfaces". Caller
 * composes it into a wider query (time window, approval status, search, etc.).
 *
 *   - ADMIN / PROGRAM_DIRECTOR — program-scope only (full access within tenant)
 *   - FACULTY — cohort-member OR invited OR host OR proposer (within tenant)
 *   - RESIDENT / EXTERNAL_LEARNER — cohort-member OR invited (within tenant)
 *
 * OPEN_TO_ALL is intentionally NOT a list-surface match: those sessions are
 * link-shareable (anyone with the URL can join via `userCanSeeSession` below)
 * but should not auto-populate every user's calendar. The detail-page check
 * still admits them so a shared link works.
 *
 * The returned fragment is meant to be composed under AND with `buildProgramScope`.
 */
export async function buildSessionVisibilityWhere(
  actor: SessionVisibilityActor
): Promise<Prisma.TeachingSessionWhereInput> {
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) {
    return {};
  }

  const cohortIds = await getUserCohortIds(actor.userId);

  const visibilityOptions: Prisma.TeachingSessionWhereInput[] = [
    { visibility: SessionVisibility.COHORT, cohortId: { in: cohortIds } },
    { visibility: SessionVisibility.INVITE_ONLY, invites: { some: { userId: actor.userId } } },
  ];

  if (actor.role === Role.FACULTY) {
    visibilityOptions.push({ hostId: actor.userId }, { proposedBy: actor.userId });
  }

  return { OR: visibilityOptions };
}

/**
 * Build the approval-status gate for session listings.
 *
 *   - ADMIN / PROGRAM_DIRECTOR — `{}` (see all approval states; they need
 *     drafts + pending visible to act on them).
 *   - Everyone else — APPROVED only, OR sessions where they are the host or
 *     proposer (so users see their own pending sessions and can act on them).
 *
 * Returns `{}` (a no-op fragment) for privileged roles so callers can
 * unconditionally compose under `AND`. Always compose under `AND`, never
 * spread at the top level — non-privileged returns an `OR` key that will
 * collide with other top-level OR clauses (e.g. visibility, time-window).
 */
export function buildApprovalGate(actor: SessionVisibilityActor): Prisma.TeachingSessionWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) {
    return {};
  }
  return {
    OR: [
      { approvalStatus: SessionApprovalStatus.APPROVED },
      { hostId: actor.userId },
      { proposedBy: actor.userId },
    ],
  };
}

/**
 * Visibility check matching the calendar-listing rules (W3 §10g):
 *   - ADMIN / PROGRAM_DIRECTOR see everything
 *   - Host or proposer of the session sees it
 *   - OPEN_TO_ALL — anyone with a login sees it
 *   - COHORT — cohort members see it
 *   - INVITE_ONLY — invited users see it
 *   - FACULTY role acts as a fallback "can see anything" for review purposes
 */
export async function userCanSeeSession(
  actor: SessionVisibilityActor,
  sessionId: string
): Promise<boolean> {
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) return true;
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      hostId: true,
      proposedBy: true,
      visibility: true,
      cohortId: true,
      invites: { where: { userId: actor.userId }, select: { userId: true } },
    },
  });
  if (!session) return false;
  if (session.hostId === actor.userId || session.proposedBy === actor.userId) return true;
  if (session.visibility === 'OPEN_TO_ALL') return true;
  if (session.visibility === 'COHORT' && session.cohortId) {
    const member = await db.cohortMember.findUnique({
      where: { cohortId_userId: { cohortId: session.cohortId, userId: actor.userId } },
      select: { userId: true },
    });
    if (member) return true;
  }
  if (session.visibility === 'INVITE_ONLY' && session.invites.length > 0) return true;
  return actor.role === Role.FACULTY;
}

/** Host of the session, or PD/Admin. Used for curator endpoints (study-pack
 *  curation, pre-case attachment, readiness viewing). */
export async function userIsHostOrPrivileged(
  actor: SessionVisibilityActor,
  sessionId: string
): Promise<boolean> {
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) return true;
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });
  return !!session && session.hostId === actor.userId;
}

/** Compute the canonical learner roster for a session. Used by the readiness
 *  predictor to decide whose readiness to score. Order:
 *  1. INVITE_ONLY → the invitees
 *  2. COHORT      → the cohort members
 *  3. OPEN_TO_ALL → all RESIDENT users (capped, see implementation)
 *  Always excludes the host + proposer (they're presenters, not learners). */
export async function listSessionLearners(sessionId: string): Promise<Array<{
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}>> {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, proposedBy: true, visibility: true, cohortId: true },
  });
  if (!session) return [];
  const exclude = new Set([session.hostId, session.proposedBy]);

  if (session.visibility === 'INVITE_ONLY') {
    const invites = await db.sessionInvite.findMany({
      where: { sessionId },
      select: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
    });
    return invites
      .map((i) => i.user)
      .filter((u) => !exclude.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }));
  }

  if (session.visibility === 'COHORT' && session.cohortId) {
    const members = await db.cohortMember.findMany({
      where: { cohortId: session.cohortId },
      select: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
    });
    return members
      .map((m) => m.user)
      .filter((u) => !exclude.has(u.id) && u.role === Role.RESIDENT)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }));
  }

  // OPEN_TO_ALL — return all active residents (LVPEI cohorts are hundreds, not
  // thousands; if this becomes a perf issue we'll add a hard cap + UI pager).
  const residents = await db.user.findMany({
    where: { role: Role.RESIDENT, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return residents.filter((u) => !exclude.has(u.id));
}
