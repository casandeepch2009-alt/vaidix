// ════════════════════════════════════════════════════════════════════════════
// Authentication + Invitation validation schemas
// ════════════════════════════════════════════════════════════════════════════
// Shared between frontend (react-hook-form + zodResolver) and backend
// (API route body parsing). Format validation only — business rules live in
// src/server/services/ and are never imported by client code.

import { z } from 'zod';
import { Role } from '@prisma/client';
import {
  emailSchema,
  passwordSchema,
  fullNameSchema,
  mobileSchema,
  mciRegSchema,
  tokenSchema,
  cuidSchema,
} from './primitives';
import { MODULE_KEYS } from '../modules';

// ─── Login ──────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ─── Forgot Password ────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password (from emailed token) ────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    token: tokenSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Change Password (authenticated user) ───────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from current',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── Admin: list users (search + paginate) ──────────────────────────────────
export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  status: z.enum(['PENDING_INVITE', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  search: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

// ─── Create Invitation (admin) ──────────────────────────────────────────────
const moduleOverridesSchema = z
  .object({
    granted: z.array(z.enum(MODULE_KEYS as [string, ...string[]])).default([]),
    revoked: z.array(z.enum(MODULE_KEYS as [string, ...string[]])).default([]),
  })
  .default({ granted: [], revoked: [] });

export const createInvitationSchema = z
  .object({
    email: emailSchema,
    fullName: fullNameSchema,
    mobile: mobileSchema.optional().or(z.literal('').transform(() => undefined)),
    mciRegNumber: mciRegSchema.optional().or(z.literal('').transform(() => undefined)),
    role: z.nativeEnum(Role),
    subspecialty: z.string().min(2).max(80).optional(),
    department: z.string().min(2).max(80).optional(),
    yearOfResidency: z.number().int().min(1).max(5).optional(),
    moduleOverrides: moduleOverridesSchema,
    expiresInHours: z.number().int().min(1).max(168).default(48),
  })
  .refine(
    (d) => d.role !== Role.RESIDENT || d.yearOfResidency !== undefined,
    { path: ['yearOfResidency'], message: 'Year of residency required for residents' }
  );
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// ─── Accept Invitation (public endpoint) ────────────────────────────────────
export const acceptInvitationSchema = z
  .object({
    token: tokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

// ─── Invitation Query (admin list) ──────────────────────────────────────────
export const listInvitationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']).optional(),
  role: z.nativeEnum(Role).optional(),
  invitedById: cuidSchema.optional(),
  search: z.string().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;

// ─── Revoke / Delete Invitation ─────────────────────────────────────────────
export const revokeInvitationSchema = z.object({
  reason: z.string().max(500).optional(),
  notifyUser: z.boolean().optional().default(false),
});

export const deleteInvitationSchema = z.object({
  confirm: z.literal(true, {
    message: 'Confirmation required for permanent deletion',
  }),
  reason: z.string().max(500).optional(),
});

// ─── User Module Permissions Update (admin) ─────────────────────────────────
export const updateUserModulesSchema = z.object({
  grants: z.array(z.enum(MODULE_KEYS as [string, ...string[]])).default([]),
  revokes: z.array(z.enum(MODULE_KEYS as [string, ...string[]])).default([]),
  reason: z.string().max(500).optional(),
});
export type UpdateUserModulesInput = z.infer<typeof updateUserModulesSchema>;

// ─── Admin: Update User Role / Status ───────────────────────────────────────
export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
  reason: z.string().min(3).max(500),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().min(3).max(500),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
