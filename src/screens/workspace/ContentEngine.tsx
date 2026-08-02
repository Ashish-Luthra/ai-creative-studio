'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ListFilter, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import type { ContentItem, ContentStatus } from '../../lib/content-types';
import { CONTENT_CATEGORIES } from '../../lib/content-types';

/**
 * Content Engine: the crawled/curated corpus that feeds the SalesDemo Agent.
 * Library tab (table + detail modal) and Approvals tab (master/detail queue),
 * with live crawl progress from /api/content/sync. Replaces the old mock
 * Library screen (kept on disk for reference).
 */

interface SyncState {
  running: boolean;
  domain: string | null;
  discovered: number;
  fetched: number;
  skippedUnchanged: number;
  classified: number;
  newItems: number;
  error: string | null;
  log: string[];
  finishedAt: string | null;
}

const STATUS_STYLE: Record<ContentStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: '#FEF3C7', fg: '#92400E', label: 'Draft' },
  pending: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Pending' },
  approved: { bg: '#DCFCE7', fg: '#166534', label: 'Approved' },
  archived: { bg: '#F3F4F6', fg: '#4B5563', label: 'Archived' },
};

function StatusBadge({ status }: { status: ContentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function Thumb({ item, small }: { item: ContentItem; small?: boolean }) {
  const size = small ? 'w-16 h-11 text-[8px]' : 'w-[104px] h-[68px] text-[10px]';
  // The page's own image when the crawler captured one; the category colour
  // stub is the fallback, not the default.
  const [failed, setFailed] = useState(false);

  if (item.imageUrl && !failed) {
    return (
      // next/image, not a bare <img>: the stored file is the publisher's
      // full-size hero (often ~1MB), and 200 of those behind 104×68 thumbnails
      // would be ~100MB per page load. This serves a resized, cached
      // derivative; the original stays on disk for the Creative Studio.
      <Image
        src={item.imageUrl}
        alt=""
        width={small ? 64 : 104}
        height={small ? 44 : 68}
        className={`${size} rounded-lg object-cover bg-[#f1f5f9] flex-shrink-0`}
        onError={() => setFailed(true)}
        unoptimized={false}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-lg flex items-center justify-center font-bold tracking-wide text-white text-center px-1.5 leading-tight flex-shrink-0`}
      style={{ background: item.thumb?.bg ?? '#334155' }}
    >
      {item.thumb?.label ?? item.category.toUpperCase()}
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const inputCls =
  'w-full h-9 rounded-lg border border-[#d1d5db] px-3 text-[13px] outline-none focus:border-[#2563EB]';

export function ContentEngine() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [domain, setDomain] = useState<string | null>(null);
  const [tab, setTab] = useState<'library' | 'approvals'>('library');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openItem, setOpenItem] = useState<ContentItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunning = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/content').catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json()) as { domain: string | null; items: ContentItem[] };
    setDomain(body.domain);
    setItems(body.items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll sync progress; refresh table when a run finishes.
  useEffect(() => {
    const tick = async () => {
      const res = await fetch('/api/content/sync').catch(() => null);
      if (!res?.ok) return;
      const s = (await res.json()) as SyncState;
      setSync(s);
      if (wasRunning.current && !s.running) {
        void refresh();
        showToast(s.error ? `Sync failed: ${s.error}` : `Sync done — ${s.newItems} new items`);
      }
      wasRunning.current = s.running;
    };
    void tick();
    const t = setInterval(tick, 2500);
    return () => clearInterval(t);
  }, [refresh, showToast]);

  const startSync = useCallback(async () => {
    setBannerDismissed(false);
    const res = await fetch('/api/content/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = await res.json();
    if (!res.ok) showToast(body.error ?? 'Could not start sync');
  }, [showToast]);

  const patchItem = useCallback(
    async (id: string, patch: Record<string, unknown>, opts?: { retryBrain?: boolean }) => {
      const res = await fetch(`/api/content/${id}${opts?.retryBrain ? '?retryBrain=1' : ''}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        showToast('Save failed');
        return null;
      }
      const { item } = (await res.json()) as { item: ContentItem };
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      return item;
    },
    [showToast]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setOpenItem(null);
        showToast('Deleted');
      }
    },
    [showToast]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((i) => {
      if (q && !`${i.title} ${i.description} ${i.tags.join(' ')}`.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'All' && i.category !== typeFilter) return false;
      if (statusFilter !== 'All' && i.status !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [items, query, typeFilter, statusFilter]);

  const queue = useMemo(() => items.filter((i) => i.status === 'draft' || i.status === 'pending'), [items]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header + tabs */}
      <div className="px-6 pt-4 border-b border-[#e5e5e5]">
        <h1 className="text-[20px] font-bold text-[#0d1117]">Content Engine</h1>
        <div className="flex gap-5 mt-2.5">
          {(['library', 'approvals'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 text-[13px] border-b-2 -mb-px ${
                tab === t ? 'border-[#0d1117] text-[#0d1117] font-semibold' : 'border-transparent text-[#6b7280]'
              }`}
            >
              {t === 'library' ? 'Library' : 'Approvals'}
              {t === 'approvals' && queue.length > 0 && (
                <span className="ml-1.5 rounded-lg bg-[#FEF3C7] text-[#92400E] px-1.5 text-[11px]">{queue.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sync banner */}
      {sync?.running && !bannerDismissed && (
        <div className="mx-6 mt-3 flex items-center gap-2.5 rounded-lg border border-[#e0e7ff] bg-[#eef2ff] px-3.5 py-2.5 text-[12.5px] text-[#4338ca]">
          <span className="h-3 w-3 flex-shrink-0 animate-spin rounded-full border-2 border-[#c7d2fe] border-t-[#4338ca]" />
          <span>
            <b>Syncing {sync.domain}</b> — {sync.fetched} fetched · {sync.classified} classified · {sync.newItems} new
            {sync.skippedUnchanged > 0 && ` · ${sync.skippedUnchanged} unchanged skipped`}
          </span>
          <button className="ml-auto font-semibold underline" onClick={() => setShowAdd(true)}>
            View log
          </button>
          <button className="text-[#818cf8]" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {tab === 'library' ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2.5 px-6 py-3.5">
            <div className="relative max-w-[320px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                className={`${inputCls} pl-8`}
                placeholder="Search content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[13px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option>All</option>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[13px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option>
              <option>Draft</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Archived</option>
            </select>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151] hover:bg-[#f9fafb]">
              <ListFilter size={14} /> Tags
            </button>
            <span className="flex-1" />
            <button
              onClick={() => void startSync()}
              disabled={sync?.running}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3.5 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"
            >
              <RefreshCw size={13} className={sync?.running ? 'animate-spin' : ''} /> Sync from website
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              <Plus size={14} /> Add content
            </button>
          </div>

          {/* Table / empty state */}
          <div className="flex-1 overflow-auto px-6 pb-6">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-[14px] font-semibold text-[#0d1117]">No content yet</p>
                <p className="max-w-[420px] text-[13px] text-[#6b7280]">
                  Sync {domain ?? 'your brand domain'} to crawl its blogs, case studies and resources — each item gets an
                  AI-drafted reference description, then goes through approval before the SalesDemo Agent can use it.
                </p>
                <button
                  onClick={() => void startSync()}
                  disabled={sync?.running}
                  className="mt-1 flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  <RefreshCw size={13} className={sync?.running ? 'animate-spin' : ''} />
                  {sync?.running ? 'Syncing…' : `Sync from ${domain ?? 'website'}`}
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Preview', 'Title', 'Status', 'Added by', 'Modified', 'Type'].map((h) => (
                      <th key={h} className="sticky top-0 bg-white px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] border-b border-[#e5e5e5]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="cursor-pointer border-b border-[#f1f1f1] hover:bg-[#fafafa]" onClick={() => setOpenItem(item)}>
                      <td className="px-2.5 py-2.5" style={{ width: 120 }}>
                        <Thumb item={item} />
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="text-[13px] font-semibold text-[#0d1117]">{item.title}</div>
                        <div className="mt-0.5 max-w-[520px] text-[12px] text-[#6b7280]">{item.description}</div>
                        <div className="mt-1">
                          {item.tags.slice(0, 4).map((t) => (
                            <span key={t} className="mr-1 inline-block rounded-md bg-[#F5E9F7] px-2 py-px text-[10.5px] text-[#7E22CE]">
                              {t}
                            </span>
                          ))}
                          {item.brainKoId && (
                            <span className="mr-1 inline-block rounded-md bg-[#ECFDF5] px-2 py-px text-[10.5px] text-[#047857]">In Brain ✓</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5" style={{ width: 110 }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-[12px] text-[#6b7280]" style={{ width: 130 }}>{item.addedBy}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-[12px] text-[#6b7280]" style={{ width: 100 }}>{relTime(item.updatedAt)}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-[12px] text-[#6b7280]" style={{ width: 110 }}>{item.category}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[13px] text-[#9ca3af]">No items match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <ApprovalsTab queue={queue} allItems={items} onPatch={patchItem} showToast={showToast} />
      )}

      {openItem && (
        <DetailModal
          item={openItem}
          domain={domain}
          onClose={() => setOpenItem(null)}
          onSaved={(item, movedToPending) => {
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
            setOpenItem(null);
            showToast(movedToPending ? 'Saved — moved to Pending' : 'Saved');
          }}
          onDelete={() => void removeItem(openItem.id)}
          onPatch={patchItem}
        />
      )}

      {showAdd && <AddContentDialog domain={domain} sync={sync} onClose={() => setShowAdd(false)} onStartSync={() => void startSync()} onAdded={() => void refresh()} showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] -translate-x-1/2 rounded-lg bg-[#111827] px-4 py-2.5 text-[12.5px] text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}

/* ─────────────────────────── Detail modal ─────────────────────────── */

function DetailModal({
  item,
  domain,
  onClose,
  onSaved,
  onDelete,
  onPatch,
}: {
  item: ContentItem;
  domain: string | null;
  onClose: () => void;
  onSaved: (item: ContentItem, movedToPending: boolean) => void;
  onDelete: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<ContentItem | null>;
}) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [refDesc, setRefDesc] = useState(item.referenceDescription);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const movedToPending = item.status === 'draft';
    const patch: Record<string, unknown> = { title, category, referenceDescription: refDesc };
    if (movedToPending) patch.status = 'pending';
    const saved = await onPatch(item.id, patch);
    setSaving(false);
    if (saved) onSaved(saved, movedToPending);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(15,18,25,0.38)' }} onClick={onClose}>
      <div className="relative flex max-h-[92%] w-[900px] max-w-[96vw] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-3 text-[18px] text-[#9ca3af]" onClick={onClose} aria-label="Close">×</button>

        {/* Preview */}
        <div className="w-[55%] overflow-auto border-r border-[#e5e7eb] bg-[#f6f6f4] p-5">
          <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
            {/* Hero: the page's own image behind the title, with a scrim so the
                text stays readable over any photograph. Colour stub when none. */}
            <div
              className="relative flex h-32 items-end bg-cover bg-center p-3"
              style={
                item.imageUrl
                  ? {
                      // Same optimizer endpoint next/image uses — a CSS
                      // background can't go through the component.
                      backgroundImage: `url("/_next/image?url=${encodeURIComponent(item.imageUrl)}&w=640&q=70")`,
                    }
                  : { background: item.thumb?.bg ?? '#334155' }
              }
            >
              {item.imageUrl && (
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.05))' }}
                />
              )}
              <span className="relative text-[15px] font-bold leading-tight text-white">{item.title}</span>
            </div>
            <div className="p-4 text-[12px] leading-relaxed text-[#4b5563]">
              {item.excerpt ? `${item.excerpt.slice(0, 900)}…` : 'No text extract available.'}
            </div>
          </div>
          <div className="mt-3 break-all text-[11.5px] text-[#6b7280]">
            {item.source === 'upload' ? 'Uploaded file' : `Crawled from ${domain ?? ''}`} · {item.url.replace('upload://', '')}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex w-[45%] flex-col overflow-auto p-5">
          <label className="mb-1.5 mt-0.5 block text-[12.5px] font-semibold text-[#0d1117]">Name</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#0d1117]">Category</label>
          <select className="h-9 w-full rounded-lg border border-[#d1d5db] bg-white px-2.5 text-[13px]" value={category} onChange={(e) => setCategory(e.target.value as ContentItem['category'])}>
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#0d1117]">Reference Description</label>
          <textarea className="min-h-[120px] w-full resize-y rounded-lg border border-[#d1d5db] p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-[#2563EB]" value={refDesc} onChange={(e) => setRefDesc(e.target.value)} />
          <p className="mt-1.5 text-[11.5px] leading-snug text-[#6b7280]">
            Describe the resource so the SalesDemo Agent knows when to use it. Explain what it is, when to use or when not to use it.
          </p>
          <p className="mt-1 text-[11px] text-[#7E22CE]">✦ Drafted by AI from the page content — edit freely</p>

          <div className="mt-4">
            <StatusBadge status={item.status} />
            {item.brainKoId && <span className="ml-2 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] text-[#047857]">In Brain ✓</span>}
            {item.brainPushError && <span className="ml-2 text-[10.5px] text-[#b91c1c]">Brain push failed</span>}
          </div>
          <div className="mt-2 leading-7">
            {item.tags.map((t) => (
              <span key={t} className="mr-1 inline-block rounded-md bg-[#F5E9F7] px-2 py-px text-[10.5px] text-[#7E22CE]">{t}</span>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 pt-4">
            <span className="flex-1 text-[11.5px] text-[#9ca3af]">
              Added by {item.addedBy} · {new Date(item.crawledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button className="h-9 rounded-lg border border-[#fecaca] px-3.5 text-[13px] font-medium text-[#B91C1C] hover:bg-[#fef2f2]" onClick={onDelete}>Delete</button>
            <button className="h-9 rounded-lg bg-[#1E1B4B] px-3.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Approvals tab ─────────────────────────── */

function ApprovalsTab({
  queue,
  allItems,
  onPatch,
  showToast,
}: {
  queue: ContentItem[];
  allItems: ContentItem[];
  onPatch: (id: string, patch: Record<string, unknown>, opts?: { retryBrain?: boolean }) => Promise<ContentItem | null>;
  showToast: (m: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [filter, setFilter] = useState<'queue' | ContentStatus>('queue');

  const list = useMemo(
    () => (filter === 'queue' ? queue : allItems.filter((i) => i.status === filter)),
    [filter, queue, allItems]
  );
  const selected = list.find((i) => i.id === selectedId) ?? list[0] ?? null;

  const [title, setTitle] = useState('');
  const [refDesc, setRefDesc] = useState('');
  useEffect(() => {
    setTitle(selected?.title ?? '');
    setRefDesc(selected?.referenceDescription ?? '');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (status: ContentStatus) => {
    if (!selected) return;
    const idx = list.findIndex((i) => i.id === selected.id);
    const item = await onPatch(selected.id, { title, referenceDescription: refDesc, status });
    if (item) {
      showToast(
        status === 'approved'
          ? item.brainKoId
            ? `Approved — “${item.title}” pushed to the Brain`
            : `Approved — “${item.title}” available to the SalesDemo Agent${item.brainPushError ? ' (Brain push failed — retry from the item)' : ''}`
          : status === 'archived'
            ? 'Archived'
            : 'Saved'
      );
      const next = list.filter((i) => i.id !== selected.id)[Math.min(idx, list.length - 2)];
      setSelectedId(next?.id ?? null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Queue */}
      <div className="flex w-[320px] min-w-[320px] flex-col border-r border-[#e5e5e5]">
        <div className="border-b border-[#e5e5e5] px-4 py-3 text-[12px] text-[#6b7280]">
          <b className="text-[#0d1117]">{list.length} {filter === 'queue' ? 'awaiting review' : filter}</b>
          <select className="mt-2 h-8 w-full rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12.5px]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="queue">Draft + Pending (review queue)</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {list.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelectedId(i.id)}
              className={`block w-full border-b border-[#f1f1f1] px-4 py-2.5 text-left ${selected?.id === i.id ? 'bg-[#eef2ff]' : 'hover:bg-[#fafafa]'}`}
            >
              <div className="mb-1 text-[13px] font-semibold text-[#0d1117]">{i.title}</div>
              <StatusBadge status={i.status} /> <span className="text-[12px] text-[#6b7280]">· {i.category}</span>
            </button>
          ))}
          {list.length === 0 && <p className="p-5 text-center text-[13px] text-[#9ca3af]">Queue is clear 🎉</p>}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 flex-col overflow-auto p-6">
        {!selected ? (
          <p className="m-auto text-[13px] text-[#9ca3af]">Nothing selected.</p>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <StatusBadge status={selected.status} />
              <span className="text-[12px] text-[#6b7280]">
                {selected.category} · <span className="break-all text-[#1d4ed8]">{selected.url.replace('upload://', '')}</span>
              </span>
              {selected.brainKoId && <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] text-[#047857]">In Brain ✓</span>}
              {selected.brainPushError && (
                <button
                  className="rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[10.5px] text-[#B91C1C] underline"
                  title={selected.brainPushError}
                  onClick={() => void onPatch(selected.id, {}, { retryBrain: true }).then((it) => it && showToast(it.brainKoId ? 'Pushed to Brain ✓' : `Still failing: ${it.brainPushError}`))}
                >
                  Brain push failed — retry
                </button>
              )}
            </div>

            <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#0d1117]">Name</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-[#0d1117]">Reference Description</label>
            <textarea className="min-h-[100px] w-full resize-y rounded-lg border border-[#d1d5db] p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-[#2563EB]" value={refDesc} onChange={(e) => setRefDesc(e.target.value)} />

            <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[12px] leading-relaxed text-[#6b7280]">
              <b className="text-[#374151]">Source excerpt:</b> {selected.excerpt ? `${selected.excerpt.slice(0, 600)}…` : '(none)'}
            </div>

            <div className="mt-5 flex gap-2">
              <button className="h-9 rounded-lg border border-[#e5e7eb] px-4 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]" onClick={() => void act('archived')}>Archive</button>
              <span className="flex-1" />
              <button className="h-9 rounded-lg border border-[#e5e7eb] px-4 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]" onClick={() => void act(selected.status)}>Save</button>
              <button className="h-9 rounded-lg bg-[#1E1B4B] px-4 text-[13px] font-medium text-white hover:opacity-90" onClick={() => void act('approved')}>Approve</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Add content dialog ─────────────────────────── */

function AddContentDialog({
  domain,
  sync,
  onClose,
  onStartSync,
  onAdded,
  showToast,
}: {
  domain: string | null;
  sync: SyncState | null;
  onClose: () => void;
  onStartSync: () => void;
  onAdded: () => void;
  showToast: (m: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [busyUrl, setBusyUrl] = useState(false);
  const [busyFile, setBusyFile] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [sync?.log?.length]);

  const addUrl = async () => {
    setBusyUrl(true);
    const res = await fetch('/api/content/add-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const body = await res.json();
    setBusyUrl(false);
    if (!res.ok) return showToast(body.error ?? 'Failed to fetch URL');
    showToast('Added as Draft');
    setUrl('');
    onAdded();
  };

  const uploadFile = async (file: File) => {
    setBusyFile(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/content/upload', { method: 'POST', body: fd });
    const body = await res.json();
    setBusyFile(false);
    if (!res.ok) return showToast(body.error ?? 'Upload failed');
    showToast('Uploaded — added as Draft');
    onAdded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(15,18,25,0.38)' }} onClick={onClose}>
      <div className="relative w-[460px] max-w-[94vw] rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-3.5 text-[18px] text-[#9ca3af]" onClick={onClose} aria-label="Close">×</button>
        <h2 className="text-[16px] font-bold text-[#0d1117]">Add content</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-[#6b7280]">Bring content into the engine — it lands as Draft for review.</p>

        {/* Sync from website */}
        <div className="mb-2.5 rounded-xl border border-[#e5e7eb] p-3">
          <div className="mb-2 text-[13px] font-semibold text-[#0d1117]">Sync from website</div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-2.5 py-1 text-[12px] text-[#374151]">
              🌐 {domain ?? 'no brand kit'} <span className="text-[#9ca3af]">· from Brand Kit</span>
            </span>
            <span className="flex-1" />
            <button
              className="h-7 rounded-md bg-[#1E1B4B] px-2.5 text-[12px] font-medium text-white disabled:opacity-50"
              disabled={!domain || sync?.running}
              onClick={onStartSync}
            >
              {sync?.running ? 'Crawling…' : 'Start crawl'}
            </button>
          </div>
          {(sync?.running || (sync?.log?.length ?? 0) > 0) && (
            <div className="mt-2.5">
              <div className="text-[12px] text-[#374151]">
                {sync?.running ? 'Crawling' : 'Last crawl'} — <b>{sync?.fetched ?? 0}</b> fetched · {sync?.classified ?? 0} classified · {sync?.newItems ?? 0} new
              </div>
              <div ref={logRef} className="mt-1.5 max-h-[120px] overflow-auto rounded-lg bg-[#0f1219] p-2.5 font-mono text-[10.5px] leading-relaxed text-[#a7f3d0]">
                {(sync?.log ?? []).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add URL */}
        <div className="mb-2.5 rounded-xl border border-[#e5e7eb] p-3">
          <div className="mb-2 text-[13px] font-semibold text-[#0d1117]">Add a URL</div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50" disabled={busyUrl || !url} onClick={() => void addUrl()}>
              {busyUrl ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="rounded-xl border border-[#e5e7eb] p-3">
          <div className="mb-2 text-[13px] font-semibold text-[#0d1117]">Upload files</div>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-[#d1d5db] p-4 text-[12px] text-[#6b7280] hover:bg-[#fafafa] disabled:opacity-50"
            disabled={busyFile}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} /> {busyFile ? 'Extracting text…' : 'Click to choose a PDF (text is extracted + classified)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
