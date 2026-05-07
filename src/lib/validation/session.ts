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

// Learning objective shape — id is server-assigned (UUID v4) on first save and
// must round-trip on subsequent edits so resident achievement marks survive
// reorders. We deliberately don't reuse cuidSchema here because the id is
// internal — clients never construct it, and the server uses crypto.randomUUID
// (no extra dep) rather than Prisma's @default(cuid()) since the value lives
// inside a Json column, not a primary key.
export const objectiveIdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const objectiveInputSchema = z.object({
  id: objectiveIdSchema.optional(),
  text: z.string().min(3).max(280),
  blooms: z.number().int().min(1).max(6),
  epaTag: z.string().max(40).nullable().optional(),
});

export const objectivesArraySchema = z
  .array(objectiveInputSchema)
  .max(10)
  .nullable()
  .optional();

export type ObjectiveInput = z.infer<typeof objectiveInputSchema>;

export const objectiveAchievementSchema = z.object({
  objectiveId: z.string().min(1).max(40),
  status: z.enum(['YES', 'PARTLY', 'NO']),
  note: z.string().max(500).nullable().optional(),
});
export type ObjectiveAchievementInput = z.infer<typeof objectiveAchievementSchema>;

// Prerequisite gate — controls whether residents must complete prep work before
// the "Join now" button unlocks. Stored under TeachingSession.metadata.prereq
// (existing JSON field) so we don't add columns for a feature that isn't
// queried from SQL. `mode = NONE` is default and matches legacy behaviour.
export const PREREQ_MODES = ['NONE', 'OPTIONAL', 'MANDATORY'] as const;
export const prereqConfigSchema = z.object({
  mode: z.enum(PREREQ_MODES).default('NONE'),
  requirePreQuestions: z.boolean().default(false),
  minPreQuestions: z.number().int().min(1).max(20).default(1),
  requireStudyPack: z.boolean().default(false),
  requireReadinessAck: z.boolean().default(false),
});
export type PrereqConfig = z.infer<typeof prereqConfigSchema>;

export const DEFAULT_PREREQ_CONFIG: PrereqConfig = {
  mode: 'NONE',
  requirePreQuestions: false,
  minPreQuestions: 1,
  requireStudyPack: false,
  requireReadinessAck: false,
};

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
    objectives: objectivesArraySchema,
    prereq: prereqConfigSchema.optional(),
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
  objectives: objectivesArraySchema,
  prereq: prereqConfigSchema.optional(),
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
  // Optional faculty mentor — service layer enforces target.role === FACULTY.
  facultyId: cuidSchema.nullable().optional(),
});

export type CreateCohortInput = z.infer<typeof createCohortSchema>;

export const updateCohortSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  academicYear: z.string().max(20).optional().or(z.literal('')),
  // null clears the mentor; absent leaves it untouched.
  facultyId: cuidSchema.nullable().optional(),
});

export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;

export const addCohortMemberSchema = z.object({
  userIds: z.array(cuidSchema).min(1).max(200),
});

export const addSessionInviteesSchema = z.object({
  userIds: z.array(cuidSchema).min(1).max(200),
});
export type AddSessionInviteesInput = z.infer<typeof addSessionInviteesSchema>;
