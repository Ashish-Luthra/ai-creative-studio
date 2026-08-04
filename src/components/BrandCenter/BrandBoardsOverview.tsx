/**
 * Brand Center "Overview" tab: one summary board per Brand Kit (logo, website
 * preview, typography, palette) with an Add Brand Kit action. Multiple kits per
 * workspace cover master brand + sub-brands.
 *
 * Currently renders mock kits; Stage 3 swaps in useBrandKits
 * (GET /v1/brand/kits + POST /v1/brand/kits/from-domain).
 */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@martechos/ui';
import { Palette, Plus, Globe } from 'lucide-react';
import { BrandBoard } from './BrandBoard';
import type { BrandKitBoardData } from './BrandBoard';
import { BrandKitSummary, TrashIcon } from './BrandKitSummary';
import { MOCK_BRAND_KITS } from './mockBrandKits';

/** Small dialog for creating a kit from a website domain. */
function AddBrandKitDialog({
  defaultDomain,
  onCreate,
  onClose,
}: {
  defaultDomain: string;
  /** Runs live extraction; resolves to an error message, or null on success. */
  onCreate: (domain: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [domain, setDomain] = useState(defaultDomain);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);

  // Deep extraction takes ~30–90s; cycle honest progress copy while waiting.
  const STAGES = [
    'Thinking…',
    'Rendering the site…',
    'Extracting colors & typography…',
    'Capturing fonts & screenshots…',
    'Writing brand guidelines…',
  ];
  useEffect(() => {
    if (!busy) {
      setStage(0);
      return;
    }
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const cleaned = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleaned || !cleaned.includes('.')) {
      setError('Enter a website domain, e.g. yourbrand.com');
      return;
    }
    setBusy(true);
    setError('');
    const err = await onCreate(cleaned);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(15,18,25,0.38)' }} onClick={busy ? undefined : onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-brand-kit-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl overflow-hidden"
      >
        {/* Build-progress vignette (Allyvate "Modern - 1" element): covers the
            dialog while the kit is being built; status copy lives here, not on
            the button. */}
        {busy && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6"
            style={{
              backgroundImage: "url('/elements/modern-1.svg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            role="status"
            aria-live="polite"
          >
            <div className="text-[15px] font-semibold text-[#0d1117] animate-pulse">{STAGES[stage]}</div>
            <div className="text-[12px] text-[#3b4252] mt-1.5">
              Building the {domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')} brand kit — about a minute.
            </div>
          </div>
        )}
        <h2 id="add-brand-kit-title" className="text-[16px] font-semibold text-[#0d1117] mb-1">Add Brand Kit</h2>
        <p className="text-[13px] text-[#6b7280] mb-4">
          We&apos;ll scan the website and build the kit — logo, colors and typography.
        </p>
        <label htmlFor="bk-domain" className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">Website domain</label>
        <input
          id="bk-domain"
          type="text"
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setError(''); }}
          placeholder="yourbrand.com"
          autoFocus
          className="w-full h-10 rounded-lg border border-[#d1d5db] px-3 text-[14px] outline-none focus:border-[#2563EB]"
        />
        {error && <p className="text-[12px] text-[#991b1b] mt-1">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#374151] border border-[#e5e7eb] hover:bg-[#f9fafb] disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-white bg-[#111827] hover:opacity-90 disabled:opacity-60"
          >
            Create kit
          </button>
        </div>
      </form>
    </div>
  );
}

/** Overview tab body: board grid + add action (mock data until Stage 3). */
export function BrandBoardsOverview() {
  const [kits, setKits] = useState<BrandKitBoardData[]>(MOCK_BRAND_KITS);
  const [showAdd, setShowAdd] = useState(false);
  // Kit opened in the expanded, editable summary view (null = board grid).
  const [openKitId, setOpenKitId] = useState<string | null>(null);
  // Kit whose grid trash button is awaiting delete confirmation.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const detectedDomain = 'allyvate.ai';

  // Hydrate persisted kits (JSON store) — mocks only shown while the store is empty.
  useEffect(() => {
    fetch('/api/brand-kit')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { items?: BrandKitBoardData[] } | null) => {
        if (body?.items?.length) setKits(body.items);
      })
      .catch(() => undefined);
  }, []);

  /**
   * Deep extraction: POST /api/brand-kit renders the site with Playwright,
   * builds the deterministic draft, runs the Claude labeling/voice pass, and
   * persists the kit. Returns an error string to keep the dialog open, or
   * null on success.
   */
  const handleCreate = async (domain: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const body = (await res.json()) as (BrandKitBoardData & { error?: string }) | { error: string };
      if (!res.ok || 'error' in body) {
        return ('error' in body && body.error) || `Could not scan ${domain}. Check the domain and try again.`;
      }
      const kit = body as BrandKitBoardData;
      setKits((prev) =>
        prev.some((k) => k.id === kit.id) ? prev.map((k) => (k.id === kit.id ? kit : k)) : [...prev, kit]
      );
      setShowAdd(false);
      return null;
    } catch {
      return `Could not scan ${domain}. Check your connection and try again.`;
    }
  };

  /** Delete a kit: leave the summary view, drop it locally, remove from the store. */
  const handleKitDelete = (kit: BrandKitBoardData) => {
    setOpenKitId(null);
    setKits((prev) => prev.filter((k) => k.id !== kit.id));
    // Mock kits have no store file — a 404 here is fine.
    void fetch(`/api/brand-kit?domain=${encodeURIComponent(kit.domain)}`, { method: 'DELETE' }).catch(() => undefined);
  };

  /** Apply an edit locally and persist it (fire-and-forget) to the JSON store. */
  const handleKitChange = (next: BrandKitBoardData) => {
    setKits((prev) => prev.map((k) => (k.id === next.id ? next : k)));
    void fetch('/api/brand-kit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => undefined);
  };

  if (kits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <EmptyState
            icon={<Palette size={32} color="#5e6ad2" />}
            title="No Brand Kit yet"
            description={`We'll scan your website and assemble your brand — logo, colors and typography.`}
            action={{
              label: `Create Brand Kit from ${detectedDomain}`,
              onClick: () => setShowAdd(true),
              icon: <Globe size={16} />,
            }}
          />
        </div>
        {showAdd && (
          <AddBrandKitDialog defaultDomain={detectedDomain} onCreate={handleCreate} onClose={() => setShowAdd(false)} />
        )}
      </div>
    );
  }

  const openKit = openKitId ? kits.find((k) => k.id === openKitId) : null;
  if (openKit) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <BrandKitSummary kit={openKit} onBack={() => setOpenKitId(null)} onChange={handleKitChange} onDelete={handleKitDelete} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#e5e5e5] flex-shrink-0">
        <span className="text-[13px] text-[#666]">
          {kits.length} {kits.length === 1 ? 'brand kit' : 'brand kits'}
        </span>
        <button
          onClick={() => setShowAdd(true)}
          className="h-8 px-3 rounded-lg text-[13px] font-medium text-white bg-[#111827] hover:opacity-90 flex items-center gap-1.5"
        >
          <Plus size={14} /> Add Brand Kit
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-[#ECECEC]">
        <div className="flex flex-wrap gap-6 justify-start">
          {kits.map((kit) => (
            <div key={kit.id} className="flex flex-col">
              <div
                role="button"
                tabIndex={0}
                aria-label={`Open ${kit.name} brand kit`}
                className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-[24px]"
                onClick={() => setOpenKitId(kit.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenKitId(kit.id); } }}
              >
                <BrandBoard kit={kit} />
              </div>
              {/* Caption row: domain left (truncated), trash right. */}
              <div className="flex items-center justify-between gap-2 mt-2 h-7 w-full px-1">
                {confirmDeleteId === kit.id ? (
                  <>
                    <span className="text-[11px] text-[#6b7280] truncate min-w-0">Delete this kit?</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-6 px-2 rounded-md text-[11px] font-medium text-[#374151] border border-[#e5e7eb] bg-white hover:bg-[#f9fafb]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmDeleteId(null); handleKitDelete(kit); }}
                        className="h-6 px-2 rounded-md text-[11px] font-medium text-white bg-[#B91C1C] hover:opacity-90 flex items-center gap-1"
                      >
                        <TrashIcon size={11} /> Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[12px] text-[#9CA3AF] truncate min-w-0" title={kit.domain}>
                      {kit.domain}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${kit.name} brand kit`}
                      title={`Delete ${kit.name} brand kit`}
                      onClick={() => setConfirmDeleteId(kit.id)}
                      className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center text-[#9CA3AF] hover:text-[#B91C1C] hover:bg-[#fef2f2]"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showAdd && (
        <AddBrandKitDialog defaultDomain="" onCreate={handleCreate} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
