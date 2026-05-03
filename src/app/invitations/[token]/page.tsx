'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Mail, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthShell, AuthInput, AuthSubmit } from '@/components/auth/auth-shell';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { acceptInvitationSchema } from '@/lib/validation/auth';

interface InvitationDetail {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  subspecialty: string | null;
  department: string | null;
  yearOfResidency: number | null;
  status: string;
  expiresAt: string;
  invitedBy: { name: string; email: string };
}

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invitations/verify/${params.token}`);
        const body = await res.json();
        if (res.ok && body.ok) {
          setInvitation(body.data.invitation);
        } else {
          setLoadError(body?.error?.message ?? 'Invalid or expired invitation.');
        }
      } catch {
        setLoadError('Network error. Please try again.');
      }
      setLoadingInit(false);
    })();
  }, [params.token]);

  function validateField(name: 'password' | 'confirmPassword' | 'acceptTerms') {
    const r = acceptInvitationSchema.safeParse({
      token: params.token,
      password,
      confirmPassword,
      acceptTerms,
    });
    if (r.success) {
      setFieldErrors((p) => ({ ...p, [name]: '' }));
      return;
    }
    const flat = r.error.flatten().fieldErrors;
    setFieldErrors((p) => ({ ...p, [name]: flat[name]?.[0] ?? '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = acceptInvitationSchema.safeParse({
      token: params.token,
      password,
      confirmPassword,
      acceptTerms,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        password: flat.password?.[0] ?? '',
        confirmPassword: flat.confirmPassword?.[0] ?? '',
        acceptTerms: flat.acceptTerms?.[0] ?? '',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/accept/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setFormError(body?.error?.message ?? 'Unable to complete registration.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    }
    setSubmitting(false);
  }

  return (
    <AuthShell
      heroTitle={
        <>
          You&rsquo;re
          <br />
          invited.
        </>
      }
      heroSubtitle="Set your password and join the clinical learning journey."
      heroDescription="Your Vaidix account is waiting for you. Residents, faculty, and program leadership at LVPEI use Vaidix to preserve every case, every conversation, every learning moment."
    >
      {loadingInit ? (
        <div className="flex min-h-50 items-center justify-center text-slate-400">
          Loading your invitation...
        </div>
      ) : loadError ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-200 bg-red-50 p-6"
        >
          <AlertCircle className="mb-3 size-10 text-red-600" />
          <h2 className="text-xl font-bold text-slate-900">Invitation unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <p className="mt-4 text-xs text-slate-500">
            Ask your program administrator to send a new invitation.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            Back to sign in &rarr;
          </Link>
        </motion.div>
      ) : submitted ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-green-200 bg-green-50 p-6"
        >
          <CheckCircle2 className="mb-3 size-10 text-green-600" />
          <h2 className="text-xl font-bold text-slate-900">Welcome to Vaidix!</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your account has been created. Redirecting you to sign in...
          </p>
        </motion.div>
      ) : invitation ? (
        <>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Accept invitation</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Hello <strong>{invitation.fullName ?? invitation.email}</strong>, complete your account.
          </p>

          {/* Invitation details card */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Your invitation
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-slate-400" />
                <span className="text-slate-500">Email</span>
                <span className="font-semibold text-slate-900">{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCircle className="size-4 text-slate-400" />
                <span className="text-slate-500">Role</span>
                <span className="font-semibold text-slate-900">
                  {humanRole(invitation.role)}
                </span>
              </div>
              {invitation.subspecialty && (
                <div className="pl-6 text-xs text-slate-500">
                  Subspecialty &middot;{' '}
                  <span className="text-slate-700">{invitation.subspecialty}</span>
                </div>
              )}
              <div className="pl-6 text-xs text-slate-500">
                Invited by{' '}
                <span className="text-slate-700">{invitation.invitedBy.name}</span>
              </div>
            </dl>
          </div>

          {formError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <AuthInput
                id="password"
                type={showPw ? 'text' : 'password'}
                label="Create password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
                }}
                onBlur={() => validateField('password')}
                placeholder="At least 8 characters"
                error={fieldErrors.password}
                disabled={submitting}
                icon={Lock}
                autoComplete="new-password"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <AuthInput
              id="confirmPassword"
              type={showPw ? 'text' : 'password'}
              label="Confirm password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              onBlur={() => validateField('confirmPassword')}
              placeholder="Re-enter password"
              error={fieldErrors.confirmPassword}
              disabled={submitting}
              icon={Lock}
              autoComplete="new-password"
            />

            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (fieldErrors.acceptTerms) setFieldErrors((p) => ({ ...p, acceptTerms: '' }));
                }}
                onBlur={() => validateField('acceptTerms')}
                className="mt-0.5 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>
                I accept Vaidix&rsquo;s usage terms and acknowledge that all clinical data I
                contribute is covered under LVPEI&rsquo;s DPDPA consent framework.
              </span>
            </label>
            {fieldErrors.acceptTerms && (
              <p className="text-xs text-red-600">{fieldErrors.acceptTerms}</p>
            )}

            <AuthSubmit loading={submitting} disabled={!acceptTerms}>
              Accept &amp; create account
            </AuthSubmit>
          </form>
        </>
      ) : null}
    </AuthShell>
  );
}

function humanRole(role: string): string {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
