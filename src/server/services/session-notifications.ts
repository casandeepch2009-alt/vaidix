// ════════════════════════════════════════════════════════════════════════════
// Session Notifications — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Sends proposed / approved / rejected / rescheduled / cancelled / reminder
// emails with a matching .ics attachment. Resolves the recipient set
// (host, proposer, attendees) from the session's visibility rules.

import { db } from '@/lib/db';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import {
  renderSessionProposedEmail,
  renderSessionApprovedEmail,
  renderSessionRejectedEmail,
  renderSessionRescheduledEmail,
  renderSessionCancelledEmail,
  renderSessionReminderEmail,
} from '@/lib/email-templates';
import { buildSessionIcs, sessionJoinUrl } from './ics-service';
import { env } from '@/lib/env';
import { SessionVisibility, UserStatus } from '@prisma/client';

const CALENDAR_URL = `${env.NEXTAUTH_URL.replace(/\/$/, '')}/calendar`;
const APPROVAL_INBOX_URL = `${env.NEXTAUTH_URL.replace(/\/$/, '')}/inbox/approvals`;

type SessionWithRels = Awaited<ReturnType<typeof loadSession>>;

async function loadSession(sessionId: string) {
  return db.teachingSession.findUnique({
    where: { id: sessionId },
    include: {
      host: { select: { id: true, name: true, email: true, status: true } },
      proposer: { select: { id: true, name: true, email: true, status: true } },
    },
  });
}

function icsAttachmentForSession(
  session: NonNullable<SessionWithRels>,
  opts: { cancelled?: boolean } = {}
): EmailAttachment {
  const icsText = buildSessionIcs({
    id: session.id,
    title: session.title,
    description: session.description,
    start: session.scheduledStart,
    end: session.scheduledEnd,
    host: { name: session.host.name, email: session.host.email },
    joinUrl: sessionJoinUrl(session.id),
    recurrenceRule: session.recurrenceRule,
    recurrenceUntil: session.recurrenceUntil,
    status: opts.cancelled ? 'CANCELLED' : 'CONFIRMED',
  });
  return {
    filename: `vaidix-${session.id}.ics`,
    content: icsText,
    contentType: 'text/calendar; method=PUBLISH; charset=utf-8',
  };
}

function sharedVarsFor(session: NonNullable<SessionWithRels>) {
  return {
    sessionTitle: session.title,
    sessionType: session.sessionType,
    start: session.scheduledStart,
    end: session.scheduledEnd,
    hostName: session.host.name,
    proposerName: session.proposer.name,
    sessionUrl: sessionJoinUrl(session.id),
    calendarUrl: CALENDAR_URL,
  };
}

// ----------------------------------------------------------------------------
// Recipient resolution — mirrors calendar visibility rules but returns users,
// not prisma-where clauses, so we can email them.
// ----------------------------------------------------------------------------
async function resolveAttendees(
  session: NonNullable<SessionWithRels>
): Promise<{ id: string; name: string; email: string }[]> {
  if (session.visibility === SessionVisibility.PRIVATE) {
    return [];
  }

  if (session.visibility === SessionVisibility.INVITE_ONLY) {
    const invites = await db.sessionInvite.findMany({
      where: { sessionId: session.id, status: { in: ['INVITED', 'ACCEPTED'] } },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });
    return invites
      .filter((i) => i.user.status === UserStatus.ACTIVE)
      .map((i) => ({ id: i.user.id, name: i.user.name, email: i.user.email }));
  }

  if (session.visibility === SessionVisibility.COHORT && session.cohortId) {
    const members = await db.cohortMember.findMany({
      where: { cohortId: session.cohortId, user: { status: UserStatus.ACTIVE } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }));
  }

  // OPEN_TO_ALL — residents + faculty in institution. Keep the blast radius
  // honest: large lectures should be COHORT-scoped. Here we email every ACTIVE
  // RESIDENT and FACULTY member except the host.
  const users = await db.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      role: { in: ['RESIDENT', 'FACULTY'] },
      id: { not: session.host.id },
    },
    select: { id: true, name: true, email: true },
  });
  return users;
}

// ----------------------------------------------------------------------------
// Low-level sender — swallows per-recipient errors to avoid blocking the
// lifecycle transaction; logs + returns summary for the caller to audit.
// ----------------------------------------------------------------------------
async function safeSend(to: string, subject: string, html: string, attachments?: EmailAttachment[]) {
  try {
    await sendEmail({ to, subject, html, attachments });
    return { to, ok: true };
  } catch (err) {
    console.error('[session-notifications] send failed', { to, subject, err: (err as Error).message });
    return { to, ok: false, error: (err as Error).message };
  }
}

// ----------------------------------------------------------------------------
// Public API — one function per lifecycle event.
// ----------------------------------------------------------------------------

export async function notifySessionProposed(sessionId: string) {
  const session = await loadSession(sessionId);
  if (!session) return;
  if (session.host.status !== UserStatus.ACTIVE) return;

  const inviteCount = await db.sessionInvite.count({ where: { sessionId } });
  const { subject, html } = renderSessionProposedEmail({
    ...sharedVarsFor(session),
    recipientName: session.host.name,
    approvalUrl: APPROVAL_INBOX_URL,
    inviteCount,
  });

  await safeSend(session.host.email, subject, html);
}

export async function notifySessionApproved(sessionId: string) {
  const session = await loadSession(sessionId);
  if (!session) return;
  const attachment = icsAttachmentForSession(session);
  const shared = sharedVarsFor(session);

  // Proposer confirmation (skip if proposer == host; the host just accepted)
  if (session.proposer.id !== session.host.id && session.proposer.status === UserStatus.ACTIVE) {
    const { subject, html } = renderSessionApprovedEmail({
      ...shared,
      recipientName: session.proposer.name,
      recipientRole: 'PROPOSER',
    });
    await safeSend(session.proposer.email, subject, html, [attachment]);
  }

  // Attendees
  const attendees = await resolveAttendees(session);
  await Promise.all(
    attendees.map((u) => {
      const { subject, html } = renderSessionApprovedEmail({
        ...shared,
        recipientName: u.name,
        recipientRole: 'ATTENDEE',
      });
      return safeSend(u.email, subject, html, [attachment]);
    })
  );
}

export async function notifySessionRejected(sessionId: string, reason: string) {
  const session = await loadSession(sessionId);
  if (!session) return;
  if (session.proposer.id === session.host.id) return; // self-rejection is a UI-only case
  if (session.proposer.status !== UserStatus.ACTIVE) return;

  const { subject, html } = renderSessionRejectedEmail({
    ...sharedVarsFor(session),
    recipientName: session.proposer.name,
    reason,
  });
  await safeSend(session.proposer.email, subject, html);
}

export async function notifySessionRescheduled(
  sessionId: string,
  previous: { start: Date; end: Date },
  requiresApproval: boolean
) {
  const session = await loadSession(sessionId);
  if (!session) return;
  const attachment = icsAttachmentForSession(session);
  const shared = sharedVarsFor(session);

  // Host gets one
  if (session.host.status === UserStatus.ACTIVE) {
    const { subject, html } = renderSessionRescheduledEmail({
      ...shared,
      recipientName: session.host.name,
      recipientRole: 'HOST',
      previousStart: previous.start,
      previousEnd: previous.end,
      requiresApproval,
      approvalUrl: APPROVAL_INBOX_URL,
    });
    await safeSend(session.host.email, subject, html, [attachment]);
  }

  // Attendees only see the updated .ics if the session is already APPROVED
  // (i.e. visibility rules have them on the attendee list). If requiresApproval,
  // wait until re-approval to re-notify attendees.
  if (!requiresApproval) {
    const attendees = await resolveAttendees(session);
    await Promise.all(
      attendees.map((u) => {
        const { subject, html } = renderSessionRescheduledEmail({
          ...shared,
          recipientName: u.name,
          recipientRole: 'ATTENDEE',
          previousStart: previous.start,
          previousEnd: previous.end,
          requiresApproval: false,
        });
        return safeSend(u.email, subject, html, [attachment]);
      })
    );
  }
}

export async function notifySessionCancelled(sessionId: string, reason?: string | null) {
  const session = await loadSession(sessionId);
  if (!session) return;
  const attachment = icsAttachmentForSession(session, { cancelled: true });
  const shared = sharedVarsFor(session);

  const toNotify: { id: string; name: string; email: string }[] = [];
  if (session.host.status === UserStatus.ACTIVE) {
    toNotify.push({ id: session.host.id, name: session.host.name, email: session.host.email });
  }
  if (
    session.proposer.id !== session.host.id &&
    session.proposer.status === UserStatus.ACTIVE
  ) {
    toNotify.push({
      id: session.proposer.id,
      name: session.proposer.name,
      email: session.proposer.email,
    });
  }
  const attendees = await resolveAttendees(session);
  for (const a of attendees) {
    if (!toNotify.some((u) => u.id === a.id)) toNotify.push(a);
  }

  await Promise.all(
    toNotify.map((u) => {
      const { subject, html } = renderSessionCancelledEmail({
        ...shared,
        recipientName: u.name,
        reason: reason ?? null,
      });
      return safeSend(u.email, subject, html, [attachment]);
    })
  );
}

export async function notifySessionReminder(sessionId: string, leadTime: '24H' | '15MIN') {
  const session = await loadSession(sessionId);
  if (!session) return;
  if (session.approvalStatus !== 'APPROVED') return; // don't remind pending/cancelled sessions
  if (session.status === 'CANCELLED' || session.status === 'ENDED') return;

  const shared = sharedVarsFor(session);
  const recipients: { name: string; email: string }[] = [];
  if (session.host.status === UserStatus.ACTIVE) {
    recipients.push({ name: session.host.name, email: session.host.email });
  }
  const attendees = await resolveAttendees(session);
  recipients.push(...attendees.map((a) => ({ name: a.name, email: a.email })));

  await Promise.all(
    recipients.map((u) => {
      const { subject, html } = renderSessionReminderEmail({
        ...shared,
        recipientName: u.name,
        leadTime,
      });
      return safeSend(u.email, subject, html);
    })
  );
}
