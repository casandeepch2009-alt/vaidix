// ════════════════════════════════════════════════════════════════════════════
// Session Scheduling & Calendar — Zod validation
// ════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { SessionType, SessionVisibility } from '@prisma/client';
import { cuidSchema } from './primitives';

const isoDateTime = z.string().datetime({ offset: true });

const rruleSchema = z
  .string()
  .min(8)
  .max(500)
  .regex(/^FREQ=/, 'RRULE must start with FREQ=')
  .optional();

export const createSessionSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    sessionType: z.nativeEnum(SessionType),
    hostId: cuidSchema,
    scheduledStart: isoDateTime,
    scheduledEnd: isoDateTime,
    visibility: z.nativeEnum(SessionVisibility).default('OPEN_TO_ALL'),
    cohortId: cuidSchema.optional(),
    inviteeIds: z.array(cuidSchema).max(500).optional(),
    recurrenceRule: rruleSchema,
    recurrenceUntil: isoDateTime.optional(),
    maxParticipants: z.number().int().min(2).max(500).default(100),
    recordingEnabled: z.boolean().default(true),
    consentRequired: z.boolean().default(true),
    topicId: cuidSchema.optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  })
  .refine((v) => new Date(v.scheduledEnd) > new Date(v.scheduledStart), {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  })
  .refine((v) => v.visibility !== 'COHORT' || !!v.cohortId, {
    message: 'cohortId is required when visibility is COHORT',
    path: ['cohortId'],
  })
  .refine((v) => v.visibility !== 'INVITE_ONLY' || (v.inviteeIds && v.inviteeIds.length > 0), {
    message: 'At least one invitee is required for INVITE_ONLY',
    path: ['inviteeIds'],
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const rescheduleSchema = z
  .object({
    scheduledStart: isoDateTime,
    scheduledEnd: isoDateTime,
    reason: z.string().min(3).max(500).optional(),
  })
  .refine((v) => new Date(v.scheduledEnd) > new Date(v.scheduledStart), {
    message: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  });

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

export const rejectSessionSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const cancelSessionSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  maxParticipants: z.number().int().min(2).max(500).optional(),
  recordingEnabled: z.boolean().optional(),
  consentRequired: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const calendarQuerySchema = z.object({
  from: isoDateTime,
  to: isoDateTime,
  mine: z.enum(['true', 'false']).optional(),
});

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;

export const createCohortSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  academicYear: z.string().max(20).optional(),
});

export type CreateCohortInput = z.infer<typeof createCohortSchema>;

export const addCohortMemberSchema = z.object({
  userIds: z.array(cuidSchema).min(1).max(200),
});

export const addSessionInviteesSchema = z.object({
  userIds: z.array(cuidSchema).min(1).max(200),
});
export type AddSessionInviteesInput = z.infer<typeof addSessionInviteesSchema>;
