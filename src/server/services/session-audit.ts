// ════════════════════════════════════════════════════════════════════════════
// Session Audit — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Thin wrapper around SessionAuditEvent model. Per-session audit trail
// complementary to the global AuditEvent stream.

import { db } from '@/lib/db';

export const SESSION_AUDIT = {
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
  PARTICIPANT_JOINED: 'JOIN',
  PARTICIPANT_LEFT: 'LEAVE',
  PARTICIPANT_MUTED: 'MUTE',
  PARTICIPANT_UNMUTED: 'UNMUTE',
  PARTICIPANT_KICKED: 'KICK',
  PARTICIPANT_BANNED: 'BAN',
  COHOST_PROMOTED: 'COHOST_PROMOTED',
  COHOST_DEMOTED: 'COHOST_DEMOTED',
  ADMISSION_GRANTED: 'ADMISSION_GRANTED',
  ADMISSION_DENIED: 'ADMISSION_DENIED',
  SCREEN_SHARE_START: 'SCREEN_SHARE_START',
  SCREEN_SHARE_STOP: 'SCREEN_SHARE_STOP',
} as const;

export type SessionAuditEventType = (typeof SESSION_AUDIT)[keyof typeof SESSION_AUDIT];

export async function sessionAudit(args: {
  sessionId: string;
  eventType: SessionAuditEventType;
  actorId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.sessionAuditEvent.create({
      data: {
        sessionId: args.sessionId,
        eventType: args.eventType,
        actorId: args.actorId ?? null,
        targetUserId: args.targetUserId ?? null,
        details: args.details ? (args.details as object) : undefined,
      },
    });
  } catch (err) {
    console.error('[session-audit] failed:', err, 'event:', args.eventType);
  }
}
