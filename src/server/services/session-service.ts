// ════════════════════════════════════════════════════════════════════════════
// Session Service — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Teaching session lifecycle: create/draft, submit for approval, approve/reject,
// reschedule, cancel. Conflict checks, recurrence expansion, invite management.

import { randomBytes, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { audit } from './audit';
import { sessionAudit, SESSION_AUDIT } from './session-audit';
import { getUserCohortIds } from './cohort-service';
import {
  notifySessionProposed,
  notifySessionApproved,
  notifySessionRejected,
  notifySessionRescheduled,
  notifySessionCancelled,
} from './session-notifications';
import {
  scheduleSessionReminders,
  cancelSessionReminders,
} from './reminder-scheduler';
import {
  SessionApprovalStatus,
  SessionApprovalAction,
  SessionStatus,
  SessionVisibility,
  Role,
  Prisma,
} from '@prisma/client';
import type {
  CreateSessionInput,
  RescheduleInput,
  UpdateSessionInput,
  ObjectiveInput,
} from '@/lib/validation/session';

// Stamps a server-generated id on every objective lacking one. Curators can
// reorder freely on the client; the id is what resident achievements key on.
export function normaliseObjectives(input: ObjectiveInput[] | null | undefined) {
  if (!input || input.length === 0) return null;
  return input.map((o) => ({
    id: o.id ?? randomUUID(),
    text: o.text.trim(),
    blooms: o.blooms,
    epaTag: o.epaTag ?? null,
  }));
}

// Runs async side effects without letting their errors surface to the caller.
// Lifecycle transitions must not roll back when a downstream email or queue
// job fails.
function runSideEffects(task: Promise<unknown>, label: string): void {
  task.catch((err) => {
    console.error(`[session-service] side-effect failed: ${label}`, err);
  });
}

// ----------------------------------------------------------------------------
// Conflict detection — application-layer. The Postgres EXCLUDE USING GIST
// constraint is the race-free backstop; this gives human-readable errors first.
// ----------------------------------------------------------------------------
export async function findHostConflicts(opts: {
  hostId: string;
  start: Date;
  end: Date;
  excludeSessionId?: string;
}) {
  return db.teachingSession.findMany({
    where: {
      hostId: opts.hostId,
      approvalStatus: SessionApprovalStatus.APPROVED,
      status: { in: [SessionStatus.SCHEDULED, SessionStatus.LIVE] },
      deletedAt: null,
      id: opts.excludeSessionId ? { not: opts.excludeSessionId } : undefined,
      // Two ranges overlap iff start1 < end2 AND end1 > start2
      scheduledStart: { lt: opts.end },
      scheduledEnd: { gt: opts.start },
    },
    select: {
      id: true,
      title: true,
      scheduledStart: true,
      scheduledEnd: true,
    },
  });
}

// ----------------------------------------------------------------------------
// Create session (PD drafts)
// Auto-approve when the proposer is also the host.
// ----------------------------------------------------------------------------
export async function createSession(input: CreateSessionInput, proposedBy: string, proposerRole: Role) {
  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);

  // FACULTY / PD / ADMIN may propose; host must be FACULTY, PD, or ADMIN.
  // Faculty proposing for themselves auto-approves below; faculty proposing
  // for another faculty goes to PENDING_FACULTY for the host to approve.
  if (
    proposerRole !== Role.FACULTY &&
    proposerRole !== Role.PROGRAM_DIRECTOR &&
    proposerRole !== Role.ADMIN
  ) {
    throw new Error('FORBIDDEN_PROPOSER_ROLE');
  }

  const host = await db.user.findUnique({
    where: { id: input.hostId },
    select: { id: true, role: true, status: true, name: true, email: true },
  });
  if (!host || host.status !== 'ACTIVE') throw new Error('HOST_NOT_FOUND');
  if (host.role !== Role.FACULTY && host.role !== Role.PROGRAM_DIRECTOR && host.role !== Role.ADMIN) {
    throw new Error('HOST_NOT_FACULTY');
  }

  // Cohort / invitee validation
  if (input.visibility === SessionVisibility.COHORT && input.cohortId) {
    const cohort = await db.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true } });
    if (!cohort) throw new Error('COHORT_NOT_FOUND');
  }

  // Auto-approve when proposer == host
  const autoApprove = proposedBy === input.hostId;
  const approvalStatus = autoApprove ? SessionApprovalStatus.APPROVED : SessionApprovalStatus.PENDING_FACULTY;

  // Pre-check host conflicts only if auto-approving; pending sessions don't lock time.
  if (autoApprove) {
    const conflicts = await findHostConflicts({ hostId: input.hostId, start, end });
    if (conflicts.length > 0) {
      const err = new Error('HOST_CONFLICT');
      (err as Error & { conflicts?: unknown }).conflicts = conflicts;
      throw err;
    }
  }

  const session = await db.$transaction(async (tx) => {
    const created = await tx.teachingSession.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        sessionType: input.sessionType,
        hostId: input.hostId,
        proposedBy,
        status: SessionStatus.SCHEDULED,
        approvalStatus,
        approvedBy: autoApprove ? proposedBy : null,
        approvedAt: autoApprove ? new Date() : null,
        visibility: input.visibility,
        cohortId: input.cohortId ?? null,
        scheduledStart: start,
        scheduledEnd: end,
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceUntil: input.recurrenceUntil ? new Date(input.recurrenceUntil) : null,
        maxParticipants: input.maxParticipants,
        recordingEnabled: input.recordingEnabled,
        consentRequired: input.consentRequired,
        topicId: input.topicId ?? null,
        tags: input.tags,
        objectives: normaliseObjectives(input.objectives) ?? Prisma.JsonNull,
        // Prereq config lives under metadata.prereq so we don't add columns
        // for a feature that isn't queried from SQL.
        metadata: input.prereq ? { prereq: input.prereq } : Prisma.JsonNull,
      },
    });

    // Invitees for INVITE_ONLY
    if (input.visibility === SessionVisibility.INVITE_ONLY && input.inviteeIds?.length) {
      await tx.sessionInvite.createMany({
        data: input.inviteeIds.map((userId) => ({
          sessionId: created.id,
          userId,
          invitedBy: proposedBy,
        })),
        skipDuplicates: true,
      });
    }

    await tx.sessionApprovalAudit.create({
      data: {
        sessionId: created.id,
        actorId: proposedBy,
        action: autoApprove ? SessionApprovalAction.AUTO_APPROVED : SessionApprovalAction.PROPOSED,
      },
    });

    return created;
  });

  await audit({
    actorId: proposedBy,
    eventType: autoApprove ? 'SESSION_AUTO_APPROVED' : 'SESSION_PROPOSED',
    entityType: 'teaching_session',
    entityId: session.id,
    summary: `${autoApprove ? 'Auto-approved' : 'Proposed'} session "${session.title}"`,
  });

  if (autoApprove) {
    // Auto-approved (PD hosting own session) — skip proposal email, go straight
    // to attendee notifications + reminders.
    runSideEffects(notifySessionApproved(session.id), 'notify auto-approved');
    runSideEffects(scheduleSessionReminders(session.id), 'schedule reminders (auto-approved)');
  } else {
    runSideEffects(notifySessionProposed(session.id), 'notify proposed');
  }

  return session;
}

// ----------------------------------------------------------------------------
// Approval flow
// ----------------------------------------------------------------------------
export async function approveSession(sessionId: string, actorId: string, actorRole: Role) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      hostId: true,
      approvalStatus: true,
      scheduledStart: true,
      scheduledEnd: true,
      title: true,
    },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.approvalStatus !== SessionApprovalStatus.PENDING_FACULTY) {
    throw new Error('NOT_PENDING');
  }
  // Only the designated host (or an admin) can approve
  if (session.hostId !== actorId && actorRole !== Role.ADMIN) {
    throw new Error('NOT_DESIGNATED_HOST');
  }

  // Conflict check at approval time (hard — Postgres exclusion constraint will enforce)
  const conflicts = await findHostConflicts({
    hostId: session.hostId,
    start: session.scheduledStart,
    end: session.scheduledEnd,
    excludeSessionId: sessionId,
  });
  if (conflicts.length > 0) {
    const err = new Error('HOST_CONFLICT');
    (err as Error & { conflicts?: unknown }).conflicts = conflicts;
    throw err;
  }

  try {
    await db.$transaction([
      db.teachingSession.update({
        where: { id: sessionId },
        data: {
          approvalStatus: SessionApprovalStatus.APPROVED,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
      }),
      db.sessionApprovalAudit.create({
        data: { sessionId, actorId, action: SessionApprovalAction.APPROVED },
      }),
    ]);
  } catch (e) {
    // Postgres exclusion constraint violation (race with another approval)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2010') {
      throw new Error('HOST_CONFLICT');
    }
    throw e;
  }

  await audit({
    actorId,
    eventType: 'SESSION_APPROVED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Approved "${session.title}"`,
  });

  runSideEffects(notifySessionApproved(sessionId), 'notify approved');
  runSideEffects(scheduleSessionReminders(sessionId), 'schedule reminders (approved)');

  return db.teachingSession.findUniqueOrThrow({ where: { id: sessionId } });
}

export async function rejectSession(sessionId: string, actorId: string, actorRole: Role, reason: string) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, hostId: true, approvalStatus: true, title: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.approvalStatus !== SessionApprovalStatus.PENDING_FACULTY) throw new Error('NOT_PENDING');
  if (session.hostId !== actorId && actorRole !== Role.ADMIN) throw new Error('NOT_DESIGNATED_HOST');

  await db.$transaction([
    db.teachingSession.update({
      where: { id: sessionId },
      data: {
        approvalStatus: SessionApprovalStatus.REJECTED,
        rejectedReason: reason,
      },
    }),
    db.sessionApprovalAudit.create({
      data: { sessionId, actorId, action: SessionApprovalAction.REJECTED, reason },
    }),
  ]);

  await audit({
    actorId,
    eventType: 'SESSION_REJECTED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Rejected "${session.title}": ${reason}`,
  });

  runSideEffects(notifySessionRejected(sessionId, reason), 'notify rejected');

  return db.teachingSession.findUniqueOrThrow({ where: { id: sessionId } });
}

// ----------------------------------------------------------------------------
// Reschedule — reverts approved session to PENDING_FACULTY
// ----------------------------------------------------------------------------
export async function rescheduleSession(
  sessionId: string,
  actorId: string,
  actorRole: Role,
  input: RescheduleInput
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      proposedBy: true,
      hostId: true,
      approvalStatus: true,
      title: true,
      scheduledStart: true,
      scheduledEnd: true,
    },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.proposedBy !== actorId && actorRole !== Role.ADMIN) throw new Error('NOT_PROPOSER');
  if (session.approvalStatus === SessionApprovalStatus.CANCELLED) throw new Error('ALREADY_CANCELLED');

  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);
  const autoApprove = actorId === session.hostId;
  const previousStart = session.scheduledStart;
  const previousEnd = session.scheduledEnd;

  await db.$transaction([
    db.teachingSession.update({
      where: { id: sessionId },
      data: {
        scheduledStart: start,
        scheduledEnd: end,
        approvalStatus: autoApprove ? SessionApprovalStatus.APPROVED : SessionApprovalStatus.PENDING_FACULTY,
        approvedBy: autoApprove ? actorId : null,
        approvedAt: autoApprove ? new Date() : null,
        rejectedReason: null,
      },
    }),
    db.sessionApprovalAudit.create({
      data: {
        sessionId,
        actorId,
        action: SessionApprovalAction.RESCHEDULED,
        reason: input.reason ?? null,
      },
    }),
  ]);

  await audit({
    actorId,
    eventType: 'SESSION_RESCHEDULED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Rescheduled "${session.title}"`,
  });

  // Drain stale reminder jobs; re-schedule only if the session is still approved.
  runSideEffects(cancelSessionReminders(sessionId), 'cancel stale reminders');
  runSideEffects(
    notifySessionRescheduled(
      sessionId,
      { start: previousStart, end: previousEnd },
      !autoApprove,
    ),
    'notify rescheduled'
  );
  if (autoApprove) {
    runSideEffects(scheduleSessionReminders(sessionId), 'schedule reminders (rescheduled)');
  }

  return db.teachingSession.findUniqueOrThrow({ where: { id: sessionId } });
}

// ----------------------------------------------------------------------------
// Cancel session (soft cancel — status only)
// ----------------------------------------------------------------------------
export async function cancelSession(
  sessionId: string,
  actorId: string,
  actorRole: Role,
  reason?: string
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, proposedBy: true, hostId: true, title: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (
    session.proposedBy !== actorId &&
    session.hostId !== actorId &&
    actorRole !== Role.ADMIN
  ) {
    throw new Error('NOT_AUTHORIZED');
  }

  await db.$transaction([
    db.teachingSession.update({
      where: { id: sessionId },
      data: {
        approvalStatus: SessionApprovalStatus.CANCELLED,
        status: SessionStatus.CANCELLED,
      },
    }),
    db.sessionApprovalAudit.create({
      data: { sessionId, actorId, action: SessionApprovalAction.CANCELLED, reason: reason ?? null },
    }),
  ]);

  await audit({
    actorId,
    eventType: 'SESSION_CANCELLED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Cancelled "${session.title}"`,
  });

  runSideEffects(cancelSessionReminders(sessionId), 'cancel reminders (cancelled)');
  runSideEffects(notifySessionCancelled(sessionId, reason), 'notify cancelled');
}

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------
export async function getSession(id: string) {
  return db.teachingSession.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, email: true, role: true } },
      proposer: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
      cohort: { select: { id: true, name: true } },
      invites: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      approvalAudits: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { participants: true } },
    },
  });
}

// ----------------------------------------------------------------------------
// W2 — Live room helpers
// ----------------------------------------------------------------------------

/**
 * Returns the effective LiveKit role for a user in a session.
 * HOST: user is the designated host.
 * CO_HOST: user has a SessionParticipant row with role=CO_HOST (host-promoted).
 * PARTICIPANT: user passes visibility rules.
 * VIEWER: null = cannot join (caller must also check admission flow).
 */
export async function getEffectiveSessionRole(
  sessionId: string,
  userId: string,
  userRole: Role
): Promise<'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER' | null> {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: {
      hostId: true,
      proposedBy: true,
      visibility: true,
      cohortId: true,
      approvalStatus: true,
    },
  });
  if (!session) return null;
  if (session.approvalStatus !== SessionApprovalStatus.APPROVED) return null;

  if (session.hostId === userId) return 'HOST';

  // Admin audits as viewer (no publish) unless they are host
  if (userRole === Role.ADMIN) return 'VIEWER';

  // Check co-host designation in SessionParticipant
  const part = await db.sessionParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { role: true },
  });
  if (part?.role === 'CO_HOST') return 'CO_HOST';

  // Visibility check
  if (session.visibility === SessionVisibility.OPEN_TO_ALL) return 'PARTICIPANT';

  if (session.visibility === SessionVisibility.COHORT && session.cohortId) {
    const myCohorts = await getUserCohortIds(userId);
    if (myCohorts.includes(session.cohortId)) return 'PARTICIPANT';
  }

  if (session.visibility === SessionVisibility.INVITE_ONLY) {
    const invite = await db.sessionInvite.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { id: true },
    });
    if (invite) return 'PARTICIPANT';
  }

  // PD who proposed the session — treat as viewer (auditing role, not host)
  if (session.proposedBy === userId) return 'VIEWER';

  return null;
}

/**
 * Upserts a SessionParticipant row when a user enters the LiveKit room.
 * Also starts the session (SCHEDULED → LIVE) on first join if host.
 */
export async function recordParticipantJoin(args: {
  sessionId: string;
  userId: string;
  livekitIdentity: string;
  role: 'HOST' | 'CO_HOST' | 'PARTICIPANT' | 'VIEWER';
}) {
  await db.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId: args.sessionId, userId: args.userId } },
    create: {
      sessionId: args.sessionId,
      userId: args.userId,
      role: args.role,
      livekitIdentity: args.livekitIdentity,
      joinedAt: new Date(),
    },
    update: {
      role: args.role,
      livekitIdentity: args.livekitIdentity,
      joinedAt: new Date(),
      leftAt: null,
    },
  });

  // Start session on host join
  if (args.role === 'HOST') {
    const updated = await db.teachingSession.updateMany({
      where: {
        id: args.sessionId,
        status: SessionStatus.SCHEDULED,
      },
      data: {
        status: SessionStatus.LIVE,
        actualStart: new Date(),
      },
    });
    if (updated.count > 0) {
      await sessionAudit({
        sessionId: args.sessionId,
        eventType: SESSION_AUDIT.SESSION_STARTED,
        actorId: args.userId,
      });
    }
  }

  await sessionAudit({
    sessionId: args.sessionId,
    eventType: SESSION_AUDIT.PARTICIPANT_JOINED,
    actorId: args.userId,
    targetUserId: args.userId,
    details: { role: args.role },
  });
}

export async function recordParticipantLeave(args: {
  sessionId: string;
  userId: string;
}) {
  await db.sessionParticipant.updateMany({
    where: { sessionId: args.sessionId, userId: args.userId, leftAt: null },
    data: { leftAt: new Date() },
  });
  await sessionAudit({
    sessionId: args.sessionId,
    eventType: SESSION_AUDIT.PARTICIPANT_LEFT,
    actorId: args.userId,
    targetUserId: args.userId,
  });
}

export async function endSession(sessionId: string, actorId: string, actorRole: Role) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, title: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.hostId !== actorId && actorRole !== Role.ADMIN) throw new Error('NOT_HOST');

  await db.teachingSession.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.ENDED,
      actualEnd: new Date(),
    },
  });
  await audit({
    actorId,
    eventType: 'SESSION_ENDED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Ended "${session.title}"`,
  });
  await sessionAudit({
    sessionId,
    eventType: SESSION_AUDIT.SESSION_ENDED,
    actorId,
  });
}

export async function promoteToCoHost(
  sessionId: string,
  targetUserId: string,
  actorId: string,
  actorRole: Role
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.hostId !== actorId && actorRole !== Role.ADMIN) throw new Error('NOT_HOST');

  await db.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId, userId: targetUserId } },
    create: { sessionId, userId: targetUserId, role: 'CO_HOST' },
    update: { role: 'CO_HOST' },
  });
  await audit({
    actorId,
    eventType: 'SESSION_COHOST_PROMOTED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Promoted ${targetUserId} to co-host`,
  });
  await sessionAudit({
    sessionId,
    eventType: SESSION_AUDIT.COHOST_PROMOTED,
    actorId,
    targetUserId,
  });
}

export async function demoteFromCoHost(
  sessionId: string,
  targetUserId: string,
  actorId: string,
  actorRole: Role
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.hostId !== actorId && actorRole !== Role.ADMIN) throw new Error('NOT_HOST');

  await db.sessionParticipant.updateMany({
    where: { sessionId, userId: targetUserId, role: 'CO_HOST' },
    data: { role: 'PARTICIPANT' },
  });
  await audit({
    actorId,
    eventType: 'SESSION_COHOST_DEMOTED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Demoted ${targetUserId} from co-host`,
  });
  await sessionAudit({
    sessionId,
    eventType: SESSION_AUDIT.COHOST_DEMOTED,
    actorId,
    targetUserId,
  });
}

/**
 * Generate (or refresh) a share token for a session. Only host or proposer
 * may call. Default TTL = 24 hours, capped at 7 days.
 */
export async function generateShareToken(
  sessionId: string,
  actorId: string,
  actorRole: Role,
  ttlHours = 24
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, proposedBy: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (
    session.hostId !== actorId &&
    session.proposedBy !== actorId &&
    actorRole !== Role.ADMIN
  ) {
    throw new Error('NOT_AUTHORIZED');
  }

  const hours = Math.min(Math.max(1, ttlHours), 24 * 7);
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

  await db.teachingSession.update({
    where: { id: sessionId },
    data: { shareToken: token, shareTokenExpiresAt: expiresAt },
  });
  return { token, expiresAt };
}

export async function revokeShareToken(
  sessionId: string,
  actorId: string,
  actorRole: Role
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, proposedBy: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (
    session.hostId !== actorId &&
    session.proposedBy !== actorId &&
    actorRole !== Role.ADMIN
  ) {
    throw new Error('NOT_AUTHORIZED');
  }
  await db.teachingSession.update({
    where: { id: sessionId },
    data: { shareToken: null, shareTokenExpiresAt: null },
  });
}

export async function verifyShareToken(sessionId: string, token: string): Promise<boolean> {
  const s = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { shareToken: true, shareTokenExpiresAt: true },
  });
  if (!s?.shareToken || s.shareToken !== token) return false;
  if (s.shareTokenExpiresAt && s.shareTokenExpiresAt < new Date()) return false;
  return true;
}

export async function updateSession(
  sessionId: string,
  actorId: string,
  actorRole: Role,
  input: UpdateSessionInput
) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, proposedBy: true, title: true, metadata: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (
    session.hostId !== actorId &&
    session.proposedBy !== actorId &&
    actorRole !== Role.ADMIN
  ) {
    throw new Error('NOT_AUTHORIZED');
  }

  // Objectives semantic: undefined → leave untouched; null or [] → clear; array → replace.
  let objectivesPatch: { objectives: Prisma.InputJsonValue | typeof Prisma.JsonNull } | Record<string, never> = {};
  if (input.objectives === undefined) {
    objectivesPatch = {};
  } else if (input.objectives === null) {
    objectivesPatch = { objectives: Prisma.JsonNull };
  } else {
    const normalised = normaliseObjectives(input.objectives);
    objectivesPatch = normalised === null
      ? { objectives: Prisma.JsonNull }
      : { objectives: normalised as unknown as Prisma.InputJsonValue };
  }

  // Merge prereq config into existing metadata so we don't clobber unrelated keys.
  let metadataPatch: { metadata: Prisma.InputJsonValue } | Record<string, never> = {};
  if (input.prereq !== undefined) {
    const existing =
      session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {};
    metadataPatch = {
      metadata: { ...existing, prereq: input.prereq } as unknown as Prisma.InputJsonValue,
    };
  }

  const updated = await db.teachingSession.update({
    where: { id: sessionId },
    data: {
      title: input.title ?? undefined,
      description: input.description === undefined ? undefined : input.description,
      maxParticipants: input.maxParticipants ?? undefined,
      recordingEnabled: input.recordingEnabled ?? undefined,
      consentRequired: input.consentRequired ?? undefined,
      tags: input.tags ?? undefined,
      ...objectivesPatch,
      ...metadataPatch,
    },
  });
  await audit({
    actorId,
    eventType: 'SESSION_UPDATED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Updated "${session.title}"`,
    details: input as unknown as Record<string, unknown>,
  });
  return updated;
}

// ----------------------------------------------------------------------------
// Invite management — add / list / remove invitees on INVITE_ONLY sessions
// ----------------------------------------------------------------------------

async function assertInviteEditor(sessionId: string, actorId: string, actorRole: Role) {
  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, hostId: true, proposedBy: true, visibility: true },
  });
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.visibility !== SessionVisibility.INVITE_ONLY) {
    throw new Error('NOT_INVITE_ONLY');
  }
  if (
    session.hostId !== actorId &&
    session.proposedBy !== actorId &&
    actorRole !== Role.ADMIN
  ) {
    throw new Error('NOT_AUTHORIZED');
  }
  return session;
}

export async function listSessionInvitees(sessionId: string, actorId: string, actorRole: Role) {
  await assertInviteEditor(sessionId, actorId, actorRole);
  return db.sessionInvite.findMany({
    where: { sessionId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
    orderBy: { invitedAt: 'asc' },
  });
}

export async function addSessionInvitees(
  sessionId: string,
  userIds: string[],
  actorId: string,
  actorRole: Role
) {
  await assertInviteEditor(sessionId, actorId, actorRole);

  // Keep only users that exist and are ACTIVE; silently drop the rest.
  const users = await db.user.findMany({
    where: { id: { in: userIds }, status: 'ACTIVE' },
    select: { id: true },
  });
  if (users.length === 0) return { added: 0 };

  const result = await db.sessionInvite.createMany({
    data: users.map((u) => ({
      sessionId,
      userId: u.id,
      invitedBy: actorId,
    })),
    skipDuplicates: true,
  });

  await audit({
    actorId,
    eventType: 'SESSION_INVITES_ADDED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Added ${result.count} invitee(s)`,
    details: { userIds: users.map((u) => u.id) },
  });

  return { added: result.count };
}

export async function removeSessionInvitee(
  sessionId: string,
  targetUserId: string,
  actorId: string,
  actorRole: Role
) {
  await assertInviteEditor(sessionId, actorId, actorRole);
  const existing = await db.sessionInvite.findUnique({
    where: { sessionId_userId: { sessionId, userId: targetUserId } },
  });
  if (!existing) throw new Error('INVITE_NOT_FOUND');

  await db.sessionInvite.delete({
    where: { sessionId_userId: { sessionId, userId: targetUserId } },
  });

  await audit({
    actorId,
    eventType: 'SESSION_INVITE_REMOVED',
    entityType: 'teaching_session',
    entityId: sessionId,
    summary: `Removed invite for ${targetUserId}`,
  });
}

export async function listSessionsPendingApproval(facultyUserId: string) {
  return db.teachingSession.findMany({
    where: {
      hostId: facultyUserId,
      approvalStatus: SessionApprovalStatus.PENDING_FACULTY,
      deletedAt: null,
    },
    include: {
      proposer: { select: { id: true, name: true, email: true } },
      cohort: { select: { id: true, name: true } },
      _count: { select: { invites: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}
