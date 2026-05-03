// ════════════════════════════════════════════════════════════════════════════
// Session visibility helpers — shared across W6.8 services
// ════════════════════════════════════════════════════════════════════════════
// Mirrors the same rules used by pre-questions-service.userCanSeeSession.
// Extracted here so study-pack, pre-case, readiness services share one
// implementation. We deliberately did NOT refactor pre-questions to use this
// module to avoid touching shipped W6 code; the rules are identical and
// covered by pre-questions e2e tests so drift would surface immediately.

import { db } from '@/lib/db';
import { Role, SessionVisibility, type Prisma } from '@prisma/client';
import { getUserCohortIds } from '../cohort-service';

export interface SessionVisibilityActor {
  userId: string;
  role: Role;
}

/**
 * Build a Prisma `TeachingSessionWhereInput` fragment encoding "which sessions
 * is this actor allowed to see". Caller composes it into a wider query (time
 * window, approval status, search, etc.).
 *
 * Rules mirror the per-session `userCanSeeSession` check below so the listing
 * and detail surfaces stay in sync. Any drift between them is a privacy bug.
 *
 *   - ADMIN / PROGRAM_DIRECTOR — empty fragment (full access)
 *   - FACULTY — open-to-all OR cohort-member OR invited OR host OR proposer
 *   - RESIDENT / EXTERNAL_LEARNER — open-to-all OR cohort-member OR invited
 *
 * NOTE: returns `{}` for ADMIN/PD so the spread is a no-op. Callers can
 * unconditionally `...await buildSessionVisibilityWhere(actor)`.
 */
export async function buildSessionVisibilityWhere(
  actor: SessionVisibilityActor
): Promise<Prisma.TeachingSessionWhereInput> {
  if (actor.role === Role.ADMIN || actor.role === Role.PROGRAM_DIRECTOR) {
    return {};
  }

  const cohortIds = await getUserCohortIds(actor.userId);

  const visibilityOptions: Prisma.TeachingSessionWhereInput[] = [
    { visibility: SessionVisibility.OPEN_TO_ALL },
    { visibility: SessionVisibility.COHORT, cohortId: { in: cohortIds } },
    { visibility: SessionVisibility.INVITE_ONLY, invites: { some: { userId: actor.userId } } },
  ];

  if (actor.role === Role.FACULTY) {
    visibilityOptions.push({ hostId: actor.userId }, { proposedBy: actor.userId });
  }

  return { OR: visibilityOptions };
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
