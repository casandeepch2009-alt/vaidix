// ════════════════════════════════════════════════════════════════════════════
// Cohort Service — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Cohort CRUD + membership management. Used by Session Scheduling for
// COHORT-visibility sessions.

import { db } from '@/lib/db';
import { audit } from './audit';
import { CohortStatus } from '@prisma/client';
import type { CreateCohortInput } from '@/lib/validation/session';

export async function listCohorts(opts?: { includeArchived?: boolean }) {
  return db.cohort.findMany({
    where: {
      deletedAt: null,
      status: opts?.includeArchived ? undefined : CohortStatus.ACTIVE,
    },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCohort(id: string) {
  return db.cohort.findFirst({
    where: { id, deletedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { addedAt: 'desc' },
      },
      _count: { select: { members: true, sessions: true } },
    },
  });
}

export async function createCohort(input: CreateCohortInput, createdBy: string) {
  const cohort = await db.cohort.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      academicYear: input.academicYear ?? null,
      createdBy,
    },
  });
  await audit({
    actorId: createdBy,
    eventType: 'COHORT_CREATED',
    entityType: 'cohort',
    entityId: cohort.id,
    summary: `Created cohort "${cohort.name}"`,
  });
  return cohort;
}

export async function addMembers(cohortId: string, userIds: string[], addedBy: string) {
  const added = await db.$transaction(
    userIds.map((userId) =>
      db.cohortMember.upsert({
        where: { cohortId_userId: { cohortId, userId } },
        create: { cohortId, userId, addedBy },
        update: {},
      })
    )
  );
  await audit({
    actorId: addedBy,
    eventType: 'COHORT_MEMBERS_ADDED',
    entityType: 'cohort',
    entityId: cohortId,
    summary: `Added ${added.length} member(s)`,
    details: { userIds },
  });
  return added;
}

export async function removeMember(cohortId: string, userId: string, removedBy: string) {
  await db.cohortMember.delete({
    where: { cohortId_userId: { cohortId, userId } },
  });
  await audit({
    actorId: removedBy,
    eventType: 'COHORT_MEMBER_REMOVED',
    entityType: 'cohort',
    entityId: cohortId,
    summary: `Removed member ${userId}`,
  });
}

export async function archiveCohort(id: string, actorId: string) {
  await db.cohort.update({
    where: { id },
    data: { status: CohortStatus.ARCHIVED },
  });
  await audit({
    actorId,
    eventType: 'COHORT_ARCHIVED',
    entityType: 'cohort',
    entityId: id,
    summary: 'Cohort archived',
  });
}

export async function getUserCohortIds(userId: string): Promise<string[]> {
  const rows = await db.cohortMember.findMany({
    where: { userId, cohort: { status: CohortStatus.ACTIVE, deletedAt: null } },
    select: { cohortId: true },
  });
  return rows.map((r) => r.cohortId);
}
