/**
 * Pure logic behind the home screen's "Recent work" list: merge the canvas
 * campaigns persisted in localStorage with the emailers saved on the server
 * into one newest-first list.
 */

/** Shape of `creative-canvas:recent-campaigns` entries (CanvasEditor). */
export interface RecentCampaignLike {
  briefId: string;
  name: string;
  /** ISO since 2026-08; older stored entries are `toLocaleString()` strings. */
  updatedAt: string | null;
}

/** Shape of `GET /api/studio/emailers` rows. */
export interface RecentEmailerLike {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface RecentWorkItem {
  id: string;
  kind: 'campaign' | 'emailer';
  name: string;
  surfaceLabel: string;
  /** Epoch ms; 0 when the source timestamp was missing or unparseable. */
  ts: number;
}

/**
 * Campaign and emailer timestamps are ISO, but campaigns saved before the
 * ISO switch are locale strings — `Date.parse` handles what it can; anything
 * else becomes 0 so the row still renders (with an em dash) and sorts last.
 */
export function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

export function formatRelativeTime(ts: number, now: number): string {
  if (ts <= 0) return '—';
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const RECENT_WORK_LIMIT = 8;

export function mergeRecentWork(
  campaigns: RecentCampaignLike[],
  emailers: RecentEmailerLike[]
): RecentWorkItem[] {
  const seenBriefIds = new Set<string>();
  const items: RecentWorkItem[] = [];

  for (const c of campaigns) {
    if (!c?.briefId || seenBriefIds.has(c.briefId)) continue;
    seenBriefIds.add(c.briefId);
    items.push({
      id: `campaign:${c.briefId}`,
      kind: 'campaign',
      name: c.name || 'Untitled',
      surfaceLabel: 'Ads canvas',
      ts: parseTimestamp(c.updatedAt),
    });
  }

  for (const e of emailers) {
    if (!e?.id) continue;
    items.push({
      id: `emailer:${e.id}`,
      kind: 'emailer',
      name: e.name || 'Untitled',
      surfaceLabel: 'Email',
      ts: parseTimestamp(e.updated_at || e.created_at),
    });
  }

  return items.sort((a, b) => b.ts - a.ts).slice(0, RECENT_WORK_LIMIT);
}
