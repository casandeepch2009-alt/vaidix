// ════════════════════════════════════════════════════════════════════════════
// Audit Log Helper — SERVER-ONLY
// ════════════════════════════════════════════════════════════════════════════
// Writes to audit_events table. Used by auth, invitation, admin action flows.

import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

export interface AuditInput {
  actorId?: string | null;
  actorRole?: Role | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        details: input.details ? (input.details as object) : undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        success: input.success ?? true,
      },
    });
  } catch (err) {
    // Audit failures should not break user flow. Log to server console.
    console.error('[audit] failed to write:', err, 'input:', input.eventType);
  }
}

export const AUDIT_EVENTS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_LOCKED: 'auth.login.locked',
  LOGOUT: 'auth.logout',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset.requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset.completed',
  PASSWORD_CHANGED: 'auth.password.changed',

  // Invitations
  INVITATION_CREATED: 'invitation.created',
  INVITATION_SENT: 'invitation.sent',
  INVITATION_RESENT: 'invitation.resent',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_DELETED: 'invitation.deleted',
  INVITATION_ACCEPTED: 'invitation.accepted',
  INVITATION_EXPIRED: 'invitation.expired',

  // User management
  USER_CREATED: 'user.created',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_STATUS_CHANGED: 'user.status_changed',
  USER_MODULES_UPDATED: 'user.modules_updated',

  // Module permissions
  MODULE_GRANTED: 'module.granted',
  MODULE_REVOKED: 'module.revoked',

  // ─── W4-Sprint events ────────────────────────────────────────────────
  // Stream A — Recording
  RECORDING_EGRESS_STARTED: 'recording.egress.started',
  RECORDING_EGRESS_COMPLETED: 'recording.egress.completed',
  RECORDING_EGRESS_FAILED: 'recording.egress.failed',
  RECORDING_TRANSCODE_DONE: 'recording.transcode.done',
  RECORDING_TRANSCRIBE_DONE: 'recording.transcribe.done',
  RECORDING_VIEWED: 'recording.viewed',

  // Stream C — Documents
  DOCUMENT_UPLOAD_INITIATED: 'document.upload.initiated',
  DOCUMENT_CLASSIFIED: 'document.classified',
  DOCUMENT_APPROVED: 'document.approved',
  DOCUMENT_TAGGED_TO_SESSION: 'document.tagged_to_session',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_ANALYZED: 'document.analyzed',

  // Stream D — Engagement / Hooks / Alerts
  LIVE_HOOK_CREATED: 'live_hook.created',
  LIVE_HOOK_FIRED: 'live_hook.fired',
  LIVE_HOOK_RESPONDED: 'live_hook.responded',
  PRESENTER_ALERT_RAISED: 'presenter_alert.raised',
  PRESENTER_ALERT_ACKED: 'presenter_alert.acknowledged',
  KIRKPATRICK_RECORDED: 'kirkpatrick.recorded',

  // Stream D — WhatsApp out-of-band
  WHATSAPP_PEARL_SENT: 'whatsapp.pearl.sent',
  WHATSAPP_PEARL_BLOCKED: 'whatsapp.pearl.blocked',
  WHATSAPP_PEARLS_SCHEDULED: 'whatsapp.pearls.scheduled',
} as const;

export function extractRequestMetadata(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent') ?? null;
  return { ipAddress, userAgent };
}
