'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export function AuthShell({
  heroTitle,
  heroSubtitle,
  heroDescription,
  children,
}: {
  heroTitle?: React.ReactNode;
  heroSubtitle?: React.ReactNode;
  heroDescription?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* LEFT brand panel */}
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
            {heroTitle && (
              <h1 className="mb-7 text-6xl font-black leading-none tracking-tight text-white xl:text-7xl">
                {heroTitle}
              </h1>
            )}
            {heroSubtitle && (
              <p
                className="text-xl font-black leading-snug tracking-tight xl:text-2xl"
                style={{ color: '#5EEAD4' }}
              >
                {heroSubtitle}
              </p>
            )}
            {heroDescription && (
              <p
                className="mt-4 text-sm leading-relaxed"
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                {heroDescription}
              </p>
            )}
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

      {/* RIGHT form panel */}
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
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Form primitives used by all auth pages ──────────────────────────────────
export function AuthInput({
  id,
  type = 'text',
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled,
  icon: Icon,
  suffix,
  autoComplete,
  helpText,
}: {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called on blur with the current value — typically runs single-field
   *  zod validation so the user sees inline errors on tab-out. */
  onBlur?: (v: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  suffix?: React.ReactNode;
  autoComplete?: string;
  /** Optional helper text shown beneath the field when there's no error. */
  helpText?: string;
}) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          className={`w-full rounded-xl border bg-white py-3 ${Icon ? 'pl-10' : 'pl-3'} ${
            suffix ? 'pr-10' : 'pr-3'
          } text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 ${
            error ? 'border-red-300' : 'border-slate-200'
          }`}
        />
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : helpText ? (
        <p id={helpId} className="mt-1.5 text-xs text-slate-500">{helpText}</p>
      ) : null}
    </div>
  );
}

export function AuthSubmit({
  loading,
  children,
  disabled,
}: {
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-teal-600 to-blue-600 py-3 font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:shadow-xl hover:shadow-teal-500/30 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <>
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Please wait...
        </>
      ) : (
        children
      )}
    </button>
  );
}
