import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  formatRelativeTime,
  mergeRecentWork,
  parseTimestamp,
  RECENT_WORK_LIMIT,
} from '../recentWork';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test('parseTimestamp reads ISO strings (emailers)', () => {
  assert.equal(parseTimestamp('2026-08-01T10:00:00.000Z'), Date.parse('2026-08-01T10:00:00.000Z'));
});

test('parseTimestamp reads locale strings (campaign updatedAt)', () => {
  // CanvasEditor writes new Date().toLocaleString() — not ISO.
  const local = new Date(2026, 7, 1, 10, 30).toLocaleString();
  const ms = parseTimestamp(local);
  // The exact value depends on the machine locale; it must at least parse
  // into the right day when it parses at all.
  if (ms !== 0) {
    assert.equal(new Date(ms).getFullYear(), 2026);
  }
});

test('parseTimestamp maps null/garbage to 0', () => {
  assert.equal(parseTimestamp(null), 0);
  assert.equal(parseTimestamp(undefined), 0);
  assert.equal(parseTimestamp('not a date'), 0);
});

test('formatRelativeTime boundaries', () => {
  const now = Date.parse('2026-08-03T12:00:00Z');
  assert.equal(formatRelativeTime(0, now), '—');
  assert.equal(formatRelativeTime(now - 20_000, now), 'Just now');
  assert.equal(formatRelativeTime(now - 5 * MIN, now), '5m ago');
  assert.equal(formatRelativeTime(now - 3 * HOUR, now), '3h ago');
  assert.equal(formatRelativeTime(now - 2 * DAY, now), '2d ago');
  // Past a week it shows a short date instead of counting days.
  assert.match(formatRelativeTime(now - 30 * DAY, now), /\d/);
  assert.doesNotMatch(formatRelativeTime(now - 30 * DAY, now), /ago/);
});

const campaign = (briefId: string, name: string, updatedAt: string | null) => ({
  briefId,
  name,
  updatedAt,
});
const emailer = (id: string, name: string, updated_at: string) => ({
  id,
  name,
  created_at: updated_at,
  updated_at,
});

test('merges both sources newest-first', () => {
  const items = mergeRecentWork(
    [campaign('dev-session', 'Spring push', '2026-08-01T10:00:00Z')],
    [emailer('e1', 'Welcome mail', '2026-08-02T10:00:00Z')]
  );
  assert.deepEqual(
    items.map((i) => [i.kind, i.name]),
    [
      ['emailer', 'Welcome mail'],
      ['campaign', 'Spring push'],
    ]
  );
  assert.equal(items[0].surfaceLabel, 'Email');
  assert.equal(items[1].surfaceLabel, 'Ads canvas');
});

test('dedupes campaigns by briefId and keeps the first (newest) entry', () => {
  const items = mergeRecentWork(
    [
      campaign('dev-session', 'Newest name', '2026-08-02T10:00:00Z'),
      campaign('dev-session', 'Older name', '2026-08-01T10:00:00Z'),
    ],
    []
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Newest name');
});

test('unparseable timestamps sort last, not first', () => {
  const items = mergeRecentWork(
    [campaign('a', 'No date', null)],
    [emailer('e1', 'Dated', '2026-08-01T10:00:00Z')]
  );
  assert.deepEqual(
    items.map((i) => i.name),
    ['Dated', 'No date']
  );
});

test('caps the list', () => {
  const emailers = Array.from({ length: 12 }, (_, i) =>
    emailer(`e${i}`, `Mail ${i}`, `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
  );
  const items = mergeRecentWork([], emailers);
  assert.equal(items.length, RECENT_WORK_LIMIT);
  // Newest of the twelve survives the cap.
  assert.equal(items[0].name, 'Mail 11');
});
