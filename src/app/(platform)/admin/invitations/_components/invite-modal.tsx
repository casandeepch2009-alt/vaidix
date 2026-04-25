'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  ShieldCheck,
  LayoutGrid,
  Mail,
  Phone,
  IdCard,
  Send,
} from 'lucide-react';
import { Role } from '@prisma/client';
import { MODULES, CATEGORY_LABELS, defaultModulesForRole, type ModuleDef, type ModuleCategory } from '@/lib/modules';
import { createInvitationSchema } from '@/lib/validation/auth';

type Step = 1 | 2 | 3;

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string }> = [
  { value: Role.RESIDENT, label: 'Resident', description: 'Ophthalmology resident in training' },
  { value: Role.FACULTY, label: 'Faculty', description: 'Consultant / teaching faculty' },
  { value: Role.PROGRAM_DIRECTOR, label: 'Program Director', description: 'Residency program leadership' },
  { value: Role.ADMIN, label: 'Admin', description: 'Platform administrator' },
  { value: Role.EXTERNAL_LEARNER, label: 'External Learner', description: 'Non-LVPEI invited learner' },
];

function defaultModuleMap(role: Role): Record<string, boolean> {
  const defaults = defaultModulesForRole(role);
  const map: Record<string, boolean> = {};
  for (const m of MODULES) map[m.key] = defaults.includes(m.key);
  return map;
}

function InviteModalBody({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — basic details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [mciRegNumber, setMciRegNumber] = useState('');

  // Step 2 — role & scope
  const [role, setRoleState] = useState<Role>(Role.RESIDENT);
  const [subspecialty, setSubspecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [yearOfResidency, setYearOfResidency] = useState<number | ''>(1);
  const [expiresInHours, setExpiresInHours] = useState(48);

  // Step 3 — module overrides (modulekey → enabled?)
  const [moduleMap, setModuleMap] = useState<Record<string, boolean>>(() => defaultModuleMap(Role.RESIDENT));

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function setRole(next: Role) {
    setRoleState(next);
    setModuleMap(defaultModuleMap(next));
  }

  function step1Valid(): boolean {
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 2) errs.fullName = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Valid email required';
    if (mobile && !/^(\+91[-\s]?)?[6-9]\d{9}$/.test(mobile.replace(/\s|-/g, '')))
      errs.mobile = 'Invalid Indian mobile number';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function step2Valid(): boolean {
    const errs: Record<string, string> = {};
    if (role === Role.RESIDENT && !yearOfResidency) {
      errs.yearOfResidency = 'Year required for residents';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);
    const roleDefaults = new Set(defaultModulesForRole(role));
    const granted: string[] = [];
    const revoked: string[] = [];
    for (const [key, enabled] of Object.entries(moduleMap)) {
      const isDefault = roleDefaults.has(key);
      if (enabled && !isDefault) granted.push(key);
      else if (!enabled && isDefault) revoked.push(key);
    }

    const payload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim() || undefined,
      mciRegNumber: mciRegNumber.trim() || undefined,
      role,
      subspecialty: subspecialty.trim() || undefined,
      department: department.trim() || undefined,
      yearOfResidency: role === Role.RESIDENT && typeof yearOfResidency === 'number' ? yearOfResidency : undefined,
      moduleOverrides: { granted, revoked },
      expiresInHours,
    };

    const parsed = createInvitationSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError('Validation failed. Please check highlighted fields.');
      setFieldErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, (v as string[])?.[0] ?? ''])
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        setFormError(body?.error?.message ?? 'Failed to create invitation');
      }
    } catch {
      setFormError('Network error. Please try again.');
    }
    setSubmitting(false);
  }

  function handleNext() {
    if (step === 1 && !step1Valid()) return;
    if (step === 2 && !step2Valid()) return;
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Invite a new user</h2>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>Step {step} of 3</span>
                  <span>&middot;</span>
                  <span>
                    {step === 1 ? 'Basic details' : step === 2 ? 'Role & scope' : 'Module access'}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </header>

            {/* Step indicator */}
            <div className="flex items-center gap-0 border-b border-slate-100 px-6 py-3">
              {[1, 2, 3].map((n, i) => (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <StepDot
                    active={step === n}
                    completed={step > n}
                    icon={n === 1 ? UserCircle : n === 2 ? ShieldCheck : LayoutGrid}
                  />
                  {i < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-teal-500' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {step === 1 && (
                <Step1
                  fullName={fullName}
                  email={email}
                  mobile={mobile}
                  mciRegNumber={mciRegNumber}
                  errors={fieldErrors}
                  onChange={(patch) => {
                    if ('fullName' in patch) setFullName(patch.fullName!);
                    if ('email' in patch) setEmail(patch.email!);
                    if ('mobile' in patch) setMobile(patch.mobile!);
                    if ('mciRegNumber' in patch) setMciRegNumber(patch.mciRegNumber!);
                  }}
                />
              )}

              {step === 2 && (
                <Step2
                  role={role}
                  subspecialty={subspecialty}
                  department={department}
                  yearOfResidency={yearOfResidency}
                  expiresInHours={expiresInHours}
                  errors={fieldErrors}
                  onRoleChange={setRole}
                  onSubspecialtyChange={setSubspecialty}
                  onDepartmentChange={setDepartment}
                  onYearChange={setYearOfResidency}
                  onExpiryChange={setExpiresInHours}
                />
              )}

              {step === 3 && (
                <Step3
                  role={role}
                  moduleMap={moduleMap}
                  onToggle={(key) => setModuleMap((m) => ({ ...m, [key]: !m[key] }))}
                  onResetToRoleDefaults={() => setModuleMap(defaultModuleMap(role))}
                />
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                  disabled={submitting}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <ChevronLeft className="size-4" /> Back
                </button>
              ) : (
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 rounded-xl bg-linear-to-br from-teal-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 hover:shadow-xl"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-linear-to-br from-teal-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 hover:shadow-xl disabled:opacity-70"
                >
                  <Send className="size-4" />
                  {submitting ? 'Sending...' : 'Send invitation'}
                </button>
              )}
            </footer>
          </motion.div>
    </>
  );
}

export function InviteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <InviteModalBody onClose={onClose} onCreated={onCreated} />}
    </AnimatePresence>
  );
}

function StepDot({
  active,
  completed,
  icon: Icon,
}: {
  active: boolean;
  completed: boolean;
  icon: typeof UserCircle;
}) {
  return (
    <div
      className={`flex size-8 items-center justify-center rounded-full transition ${
        completed
          ? 'bg-teal-500 text-white'
          : active
          ? 'bg-linear-to-br from-teal-600 to-blue-600 text-white'
          : 'bg-slate-100 text-slate-400'
      }`}
    >
      <Icon className="size-4" />
    </div>
  );
}

// ─── Step 1: basic details ────────────────────────────────────────────────────
function Step1({
  fullName,
  email,
  mobile,
  mciRegNumber,
  errors,
  onChange,
}: {
  fullName: string;
  email: string;
  mobile: string;
  mciRegNumber: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<{ fullName: string; email: string; mobile: string; mciRegNumber: string }>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Full name" icon={UserCircle} required error={errors.fullName}>
        <input
          value={fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          placeholder="Dr. Priya Nair"
          className="input"
        />
      </Field>
      <Field label="Email address" icon={Mail} required error={errors.email}>
        <input
          type="email"
          value={email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="priya@lvpei.org"
          className="input"
        />
      </Field>
      <Field label="Mobile (optional)" icon={Phone} error={errors.mobile}>
        <input
          value={mobile}
          onChange={(e) => onChange({ mobile: e.target.value })}
          placeholder="+91 98765 43210"
          className="input"
        />
      </Field>
      <Field label="MCI registration (optional)" icon={IdCard} error={errors.mciRegNumber}>
        <input
          value={mciRegNumber}
          onChange={(e) => onChange({ mciRegNumber: e.target.value })}
          placeholder="TSMC-12345"
          className="input"
        />
      </Field>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }
      `}</style>
    </div>
  );
}

// ─── Step 2: role + scope ─────────────────────────────────────────────────────
function Step2({
  role,
  subspecialty,
  department,
  yearOfResidency,
  expiresInHours,
  errors,
  onRoleChange,
  onSubspecialtyChange,
  onDepartmentChange,
  onYearChange,
  onExpiryChange,
}: {
  role: Role;
  subspecialty: string;
  department: string;
  yearOfResidency: number | '';
  expiresInHours: number;
  errors: Record<string, string>;
  onRoleChange: (r: Role) => void;
  onSubspecialtyChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onYearChange: (v: number | '') => void;
  onExpiryChange: (v: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Role</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                role === opt.value
                  ? 'border-teal-500 bg-teal-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => onRoleChange(opt.value)}
                className="mt-0.5 size-4"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                <div className="text-xs text-slate-500">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subspecialty">
          <input
            value={subspecialty}
            onChange={(e) => onSubspecialtyChange(e.target.value)}
            placeholder="Vitreoretinal Surgery"
            className="input"
          />
        </Field>
        <Field label="Department">
          <input
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder="Department name"
            className="input"
          />
        </Field>

        {role === Role.RESIDENT && (
          <Field label="Year of Residency" required error={errors.yearOfResidency}>
            <select
              value={yearOfResidency}
              onChange={(e) => onYearChange(e.target.value ? parseInt(e.target.value) : '')}
              className="input"
            >
              <option value="">Select year</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  PGY-{y}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Invitation valid for">
          <select
            value={expiresInHours}
            onChange={(e) => onExpiryChange(parseInt(e.target.value))}
            className="input"
          >
            <option value={24}>24 hours</option>
            <option value={48}>48 hours (recommended)</option>
            <option value={72}>72 hours</option>
            <option value={168}>7 days</option>
          </select>
        </Field>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }
      `}</style>
    </div>
  );
}

// ─── Step 3: module access ────────────────────────────────────────────────────
function Step3({
  role,
  moduleMap,
  onToggle,
  onResetToRoleDefaults,
}: {
  role: Role;
  moduleMap: Record<string, boolean>;
  onToggle: (key: string) => void;
  onResetToRoleDefaults: () => void;
}) {
  const byCategory = useMemo(() => {
    const groups: Record<ModuleCategory, ModuleDef[]> = {
      learning: [], assessment: [], faculty: [], program: [], admin: [],
    };
    for (const m of MODULES) groups[m.category].push(m);
    return groups;
  }, []);

  const enabledCount = Object.values(moduleMap).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm">
        <div className="text-teal-900">
          Default modules for <strong>{humanRole(role)}</strong> are pre-selected.
          <br />
          <span className="text-xs text-teal-700">
            Uncheck to restrict access, or check others to grant extra modules.
          </span>
        </div>
        <button
          onClick={onResetToRoleDefaults}
          type="button"
          className="shrink-0 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
        >
          Reset
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {enabledCount} of {MODULES.length} modules enabled for this user.
      </div>

      {(['learning', 'assessment', 'faculty', 'program', 'admin'] as ModuleCategory[]).map((cat) => (
        <div key={cat}>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {CATEGORY_LABELS[cat]}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {byCategory[cat].map((m) => {
              const enabled = moduleMap[m.key] ?? false;
              const isDefault = m.defaultRoles.includes(role);
              return (
                <label
                  key={m.key}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                    enabled
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggle(m.key)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{m.label}</span>
                      {!isDefault && enabled && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                          EXTRA
                        </span>
                      )}
                      {isDefault && !enabled && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          REMOVED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{m.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon?: typeof UserCircle;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {Icon && <Icon className="size-3.5 text-slate-400" />}
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function humanRole(role: string): string {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
