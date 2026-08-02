import { useState } from 'react';
import type { FormEvent } from 'react';

export interface WorkspaceSetupValues {
  /** Selected role option value (brand | agency | freelancer | other). */
  role: string;
  website: string;
}

interface WorkspaceSetupModalProps {
  /** Called with the form values when the user submits. May be async. */
  onSubmit: (values: WorkspaceSetupValues) => void | Promise<void>;
}

export const WORKSPACE_ROLE_OPTIONS = [
  { value: 'brand', label: 'Brand — I market my own company' },
  { value: 'agency', label: 'Agency — I manage marketing for clients' },
  { value: 'freelancer', label: 'Freelancer / consultant' },
  { value: 'other', label: 'Other' },
] as const;

const INPUT_CLASS =
  'w-full h-12 rounded-xl px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#aaa] outline-none transition-colors';

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.9)',
    border: hasError ? '1.5px solid #7f1d1d' : '1.5px solid #d1d5db',
  };
}

/**
 * One-time workspace setup dialog shown after first successful login.
 * Captures how the user works (own brand vs agency managing client brands) and
 * the website of the brand they market — the website seeds their first Brand Kit.
 * Deliberately non-dismissible: no close button, backdrop, or Escape handling —
 * the workspace needs this profile before continuing.
 */
export function WorkspaceSetupModal({ onSubmit }: WorkspaceSetupModalProps) {
  const [role, setRole] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<{ role?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors: typeof errors = {};
    if (!role) nextErrors.role = 'Select your role';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        role,
        website: website.trim(),
      });
    } catch {
      setSubmitError("Couldn't save your details. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,18,25,0.38)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-setup-title"
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] rounded-[24px] p-7"
        style={{
          background: 'rgba(245,245,245,0.94)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7), 0 12px 48px rgba(0,0,0,0.22)',
        }}
      >
        <h2 id="workspace-setup-title" className="text-[20px] font-bold text-[#0d1117] mb-1">
          Set up your workspace
        </h2>
        <p className="text-[13px] text-[#6b7280] mb-5">
          Tell us how you work — and the brand you market.
        </p>

        <div className="mb-3.5">
          <label htmlFor="ws-role" className="block text-[14px] font-semibold text-[#1a1a1a] mb-1.5">
            Role
          </label>
          <select
            id="ws-role"
            value={role}
            onChange={(e) => { setRole(e.target.value); setErrors((p) => ({ ...p, role: undefined })); }}
            disabled={submitting}
            aria-invalid={!!errors.role}
            className="w-full h-12 rounded-xl px-3 text-[14px] outline-none transition-colors"
            style={{ ...inputStyle(!!errors.role), color: role ? '#1a1a1a' : '#aaa' }}
          >
            <option value="" disabled>
              Select your role
            </option>
            {WORKSPACE_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.role && <p className="text-[12px] text-[#991b1b] mt-1">{errors.role}</p>}
        </div>

        <div className="mb-5">
          <label htmlFor="ws-website" className="block text-[14px] font-semibold text-[#1a1a1a] mb-1.5">
            Website
          </label>
          <input
            id="ws-website"
            type="url"
            autoComplete="url"
            placeholder="https://yourbrand.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
            style={inputStyle(false)}
          />
          <p className="text-[12px] text-[#6b7280] mt-1.5">
            The brand you market — we&apos;ll use this to build your Brand Kit.
          </p>
        </div>

        {submitError && <p className="text-[12px] text-[#991b1b] mb-3 text-center">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-full text-white text-[15px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ background: '#4b5563' }}
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
