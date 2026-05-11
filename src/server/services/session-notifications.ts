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
import { NotificationChannel, UserStatus } from '@prisma/client';
import { emit, emitToMany } from './notifications-service';

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
// Recipient resolution — union of explicit audiences (cohort members + named
// invitees), deduped. `openToAll` deliberately does NOT add recipients: a
// link-only session has no broadcast list. If a host wants to email a wide
// group they must also pick a cohort (or invite individuals). This stops the
// silent "blast every resident + faculty in the institution" path the old
// OPEN_TO_ALL default had.
// ----------------------------------------------------------------------------
async function resolveAttendees(
  session: NonNullable<SessionWithRels>
): Promise<{ id: string; name: string; email: string }[]> {
  const byId = new Map<string, { id: string; name: string; email: string }>();

  if (session.cohortId) {
    const members = await db.cohortMember.findMany({
      where: { cohortId: session.cohortId, user: { status: UserStatus.ACTIVE } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    for (const m of members) {
      byId.set(m.user.id, { id: m.user.id, name: m.user.name, email: m.user.email });
    }
  }

  const invites = await db.sessionInvite.findMany({
    where: { sessionId: session.id, status: { in: ['INVITED', 'ACCEPTED'] } },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  for (const i of invites) {
    if (i.user.status !== UserStatus.ACTIVE) continue;
    byId.set(i.user.id, { id: i.user.id, name: i.user.name, email: i.user.email });
  }

  return Array.from(byId.values());
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

  // In-app notification — drives the bell/badge in the header. Email may be
  // delayed or filtered; this row is the source of truth for the inbox UI.
  await db.notification.create({
    data: {
      userId: session.host.id,
      channel: NotificationChannel.IN_APP,
      kind: 'session.proposed',
      title: `${session.proposer.name} proposed a session for your approval`,
      body: `${session.title} — ${session.scheduledStart.toLocaleString()}`,
      payload: {
        sessionId: session.id,
        scheduledStart: session.scheduledStart.toISOString(),
        scheduledEnd: session.scheduledEnd.toISOString(),
        proposerId: session.proposer.id,
        approvalUrl: APPROVAL_INBOX_URL,
      },
    },
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
    await db.notification.create({
      data: {
        userId: session.proposer.id,
        channel: NotificationChannel.IN_APP,
        kind: 'session.approved',
        title: `${session.host.name} approved your session`,
        body: `${session.title} — ${session.scheduledStart.toLocaleString()}`,
        payload: {
          sessionId: session.id,
          scheduledStart: session.scheduledStart.toISOString(),
          scheduledEnd: session.scheduledEnd.toISOString(),
        },
      },
    });

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

  await emit({
    userId: session.proposer.id,
    kind: 'session.rejected',
    title: `${session.host.name} declined your session`,
    body: `${session.title} — ${session.scheduledStart.toLocaleString()}${reason ? `: ${reason}` : ''}`,
    payload: { sessionId: session.id, reason },
  });
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

  const notifPayload = {
    sessionId: session.id,
    previousStart: previous.start.toISOString(),
    previousEnd: previous.end.toISOString(),
    scheduledStart: session.scheduledStart.toISOString(),
    scheduledEnd: session.scheduledEnd.toISOString(),
    requiresApproval,
  };

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
    await emit({
      userId: session.host.id,
      kind: 'session.rescheduled',
      title: `Session rescheduled: ${session.title}`,
      body: `New time: ${session.scheduledStart.toLocaleString()}`,
      payload: notifPayload,
    });
  }

  // Attendees only see the updated .ics if the session is already APPROVED.
  // If requiresApproval, wait until re-approval to notify attendees.
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
    await emitToMany(
      attendees.map((u) => ({
        userId: u.id,
        kind: 'session.rescheduled',
        title: `Session rescheduled: ${session.title}`,
        body: `New time: ${session.scheduledStart.toLocaleString()}`,
        payload: notifPayload,
      }))
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

  await emitToMany(
    toNotify.map((u) => ({
      userId: u.id,
      kind: 'session.cancelled',
      title: `Session cancelled: ${session.title}`,
      body: reason ?? `Scheduled for ${session.scheduledStart.toLocaleString()}`,
      payload: {
        sessionId: session.id,
        scheduledStart: session.scheduledStart.toISOString(),
        reason: reason ?? null,
      },
    }))
  );
}

export async function notifySessionReminder(sessionId: string, leadTime: '24H' | '15MIN') {
  const session = await loadSession(sessionId);
  if (!session) return;
  if (session.approvalStatus !== 'APPROVED') return; // don't remind pending/cancelled sessions
  if (session.status === 'CANCELLED' || session.status === 'ENDED') return;

  const shared = sharedVarsFor(session);
  const recipients: { id: string; name: string; email: string }[] = [];
  if (session.host.status === UserStatus.ACTIVE) {
    recipients.push({ id: session.host.id, name: session.host.name, email: session.host.email });
  }
  const attendees = await resolveAttendees(session);
  recipients.push(...attendees);

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

  const leadLabel = leadTime === '24H' ? '24 hours' : '15 minutes';
  await emitToMany(
    recipients.map((u) => ({
      userId: u.id,
      kind: 'session.reminder',
      title: `${session.title} starts in ${leadLabel}`,
      body: `Hosted by ${session.host.name} — ${session.scheduledStart.toLocaleString()}`,
      payload: {
        sessionId: session.id,
        scheduledStart: session.scheduledStart.toISOString(),
        scheduledEnd: session.scheduledEnd.toISOString(),
        leadTime,
      },
    }))
  );
}
