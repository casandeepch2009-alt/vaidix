// ════════════════════════════════════════════════════════════════════════════
// Validation primitives — reusable Zod fragments
// ════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .max(254)
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

// Names may include digits (suffixes like "John Smith III", initialisms) and
// Unicode letters for Indian names in various scripts.
export const fullNameSchema = z
  .string()
  .min(2, 'Name is too short')
  .max(120, 'Name is too long')
  .regex(/^[\p{L}0-9\s.,'&()-]+$/u, 'Name contains invalid characters')
  .transform((v) => v.trim());

// Indian mobile: +91 followed by 10 digits starting 6-9, or plain 10 digits
export const mobileSchema = z
  .string()
  .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, 'Invalid Indian mobile number')
  .transform((v) => v.replace(/\s|-/g, ''));

export const mciRegSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9-]+$/i, 'Invalid MCI registration number')
  .transform((v) => v.toUpperCase());

export const tokenSchema = z.string().min(16).max(256);

export const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/i, 'Invalid ID');
