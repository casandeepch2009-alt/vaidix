// ════════════════════════════════════════════════════════════════════════════
// Calendar Service — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Role-scoped calendar event feed + recurrence expansion.

import { RRule, rrulestr } from 'rrule';
import { db } from '@/lib/db';
import { getUserCohortIds } from './cohort-service';
import {
  SessionApprovalStatus,
  SessionStatus,
  SessionVisibility,
  Role,
  type TeachingSession,
} from '@prisma/client';

export interface CalendarEvent {
  id: string;                  // session id (or `${sessionId}@${iso}` for recurrence occurrence)
  sessionId: string;
  title: string;
  start: string;               // ISO
  end: string;                 // ISO
  status: SessionStatus;
  approvalStatus: SessionApprovalStatus;
  visibility: SessionVisibility;
  host: { id: string; name: string } | null;
  isRecurring: boolean;
  isOccurrence: boolean;       // true when expanded from an RRULE
  cohortId: string | null;
}

// ----------------------------------------------------------------------------
// Visibility filter. Returns a Prisma `where` clause describing sessions the
// given user may see on their calendar for the given date range.
// ----------------------------------------------------------------------------
async function buildVisibilityWhere(userId: string, role: Role, from: Date, to: Date) {
  const timeWindow = {
    scheduledStart: { lt: to },
    // Use `OR` with recurrence: single sessions must overlap window; recurring
    // masters may start before `from` but still have occurrences inside window.
  };

  const baseFilter = {
    deletedAt: null,
    approvalStatus: SessionApprovalStatus.APPROVED,
    ...timeWindow,
  };

  // Admin / PD see everything
  if (role === Role.ADMIN || role === Role.PROGRAM_DIRECTOR) {
    return {
      ...baseFilter,
      OR: [
        { scheduledEnd: { gt: from } },
        // Recurring masters always included (we filter occurrences in JS)
        { recurrenceRule: { not: null } },
      ],
    };
  }

  const myCohorts = await getUserCohortIds(userId);

  // Faculty — see open-to-all + cohort (if member) + invites + hosted + proposed
  if (role === Role.FACULTY) {
    return {
      ...baseFilter,
      OR: [
        { scheduledEnd: { gt: from } },
        { recurrenceRule: { not: null } },
      ],
      AND: [
        {
          OR: [
            { visibility: SessionVisibility.OPEN_TO_ALL },
            { visibility: SessionVisibility.COHORT, cohortId: { in: myCohorts } },
            { visibility: SessionVisibility.INVITE_ONLY, invites: { some: { userId } } },
            { hostId: userId },
            { proposedBy: userId },
          ],
        },
      ],
    };
  }

  // Resident / external learner
  return {
    ...baseFilter,
    OR: [{ scheduledEnd: { gt: from } }, { recurrenceRule: { not: null } }],
    AND: [
      {
        OR: [
          { visibility: SessionVisibility.OPEN_TO_ALL },
          { visibility: SessionVisibility.COHORT, cohortId: { in: myCohorts } },
          { visibility: SessionVisibility.INVITE_ONLY, invites: { some: { userId } } },
        ],
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// Expand recurring sessions into individual occurrences within [from, to].
// ----------------------------------------------------------------------------
function expandOccurrences(
  session: Pick<
    TeachingSession,
    'id' | 'title' | 'scheduledStart' | 'scheduledEnd' | 'recurrenceRule' | 'recurrenceUntil' | 'status' | 'approvalStatus' | 'visibility' | 'cohortId'
  > & { host: { id: string; name: string } | null },
  from: Date,
  to: Date
): CalendarEvent[] {
  const durationMs = session.scheduledEnd.getTime() - session.scheduledStart.getTime();

  if (!session.recurrenceRule) {
    // Single event — only include if it intersects the window
    if (session.scheduledEnd <= from || session.scheduledStart >= to) return [];
    return [
      {
        id: session.id,
        sessionId: session.id,
        title: session.title,
        start: session.scheduledStart.toISOString(),
        end: session.scheduledEnd.toISOString(),
        status: session.status,
        approvalStatus: session.approvalStatus,
        visibility: session.visibility,
        host: session.host,
        isRecurring: false,
        isOccurrence: false,
        cohortId: session.cohortId,
      },
    ];
  }

  let rule: RRule;
  try {
    const full = `DTSTART:${formatICalDate(session.scheduledStart)}\nRRULE:${session.recurrenceRule}`;
    rule = rrulestr(full, { forceset: false }) as RRule;
  } catch {
    return [];
  }

  const windowEnd = session.recurrenceUntil
    ? new Date(Math.min(to.getTime(), session.recurrenceUntil.getTime()))
    : to;

  const occurrences = rule.between(from, windowEnd, true);
  return occurrences.map((occStart) => {
    const occEnd = new Date(occStart.getTime() + durationMs);
    return {
      id: `${session.id}@${occStart.toISOString()}`,
      sessionId: session.id,
      title: session.title,
      start: occStart.toISOString(),
      end: occEnd.toISOString(),
      status: session.status,
      approvalStatus: session.approvalStatus,
      visibility: session.visibility,
      host: session.host,
      isRecurring: true,
      isOccurrence: true,
      cohortId: session.cohortId,
    };
  });
}

function formatICalDate(d: Date): string {
  // RRULE DTSTART format: YYYYMMDDTHHMMSSZ
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// ----------------------------------------------------------------------------
// Public: list events for user in range, with recurrence expansion applied.
// ----------------------------------------------------------------------------
export async function listCalendarEvents(
  userId: string,
  role: Role,
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const where = await buildVisibilityWhere(userId, role, from, to);
  const sessions = await db.teachingSession.findMany({
    where,
    select: {
      id: true,
      title: true,
      scheduledStart: true,
      scheduledEnd: true,
      recurrenceRule: true,
      recurrenceUntil: true,
      status: true,
      approvalStatus: true,
      visibility: true,
      cohortId: true,
      host: { select: { id: true, name: true } },
    },
    orderBy: { scheduledStart: 'asc' },
  });

  return sessions.flatMap((s) => expandOccurrences(s, from, to));
}
