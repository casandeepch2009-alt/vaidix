'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';

export default function LoginPage() {
  // useSearchParams must be wrapped in Suspense so this page can be prerendered.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password, rememberMe } satisfies LoginInput);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: flat.email?.[0] ?? '',
        password: flat.password?.[0] ?? '',
      });
      return;
    }

    setLoading(true);
    const result = await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    setLoading(false);

    if (!result) {
      setFormError('Network error. Please try again.');
      return;
    }
    if (result.error) {
      setFormError('Invalid email or password.');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* LEFT — brand hero panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[45%]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(145deg, #042F2E 0%, #0F2D3F 25%, #1E1B4B 60%, #312E81 90%, #1E1B4B 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="absolute -left-20 top-[8%] h-96 w-96 rounded-full blur-[120px]"
          style={{ background: 'rgba(20,184,166,0.35)' }}
        />
        <div
          className="absolute right-[5%] top-[42%] h-80 w-80 rounded-full blur-[100px]"
          style={{ background: 'rgba(124,58,237,0.32)' }}
        />

        <div className="relative z-10 flex w-full flex-col justify-between px-12 py-12 text-white xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(20,184,166,0.35) 0%, rgba(124,58,237,0.25) 100%)',
                border: '1.5px solid rgba(94,234,212,0.5)',
                boxShadow: '0 0 20px rgba(20,184,166,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <svg viewBox="0 0 36 36" fill="none" width="22" height="22">
                <circle cx="18" cy="18" r="14" stroke="url(#vlogo)" strokeWidth="3" fill="none" />
                <circle cx="18" cy="18" r="6" fill="url(#vlogo2)" />
                <defs>
                  <linearGradient id="vlogo" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#5EEAD4" />
                    <stop offset="1" stopColor="#A78BFA" />
                  </linearGradient>
                  <linearGradient id="vlogo2" x1="12" y1="12" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FCD34D" />
                    <stop offset="1" stopColor="#5EEAD4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white">
                Vai<span style={{ color: '#5EEAD4' }}>dix</span>
              </span>
              <p className="mt-0.5 text-xs" style={{ color: 'rgba(94,234,212,0.6)' }}>
                Clinical Learning Intelligence
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-md"
          >
            <h1 className="mb-7 text-6xl font-black leading-none tracking-tight text-white xl:text-7xl">
              Welcome
              <br />
              back.
            </h1>
            <p className="text-xl font-black leading-snug tracking-tight xl:text-2xl" style={{ color: '#5EEAD4' }}>
              We don&rsquo;t simulate knowledge.
              <br />
              We cultivate it.
            </p>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(226,232,240,0.6)' }}>
              Every case. Every conversation. Every scoring event — preserved as part of your
              clinical reasoning journey at LVPEI.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center gap-3 text-xs"
            style={{ color: 'rgba(226,232,240,0.5)' }}
          >
            <ShieldCheck className="size-4" />
            DPDPA 2023 compliant · All data stays at LVPEI
          </motion.div>
        </div>
      </div>

      {/* RIGHT — login form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:w-[55%] lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-2xl font-bold">
              Vai<span className="text-teal-600">dix</span>
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter your credentials to access the platform.
          </p>

          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lvpei.org"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 ${
                    fieldErrors.email ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-teal-600 hover:text-teal-700"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  className={`w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 ${
                    fieldErrors.password ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Keep me signed in for 8 hours
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-br from-teal-600 to-blue-600 py-3 font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:shadow-xl hover:shadow-teal-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Access is invite-only. Contact your program administrator.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
