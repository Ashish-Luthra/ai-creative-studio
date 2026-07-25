/**
 * local-store.ts — File-based emailer persistence.
 *
 * The demo persistence layer (mirrors the AIDemoAgent JSON-store pattern,
 * e.g. brand-kit-store). Stores data in .data/emailers.json at the project
 * root; the .data directory is gitignored. Production path: Postgres (Neon)
 * behind the Allyvate API layer (ADR 0001 — one Postgres).
 *
 * Server-side only — never import this from client components.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { EmailerRow, EmailerMeta } from '@/types/emailer'

const DATA_DIR  = join(process.cwd(), '.data')
const DATA_FILE = join(DATA_DIR, 'emailers.json')

// ── Read / write helpers ───────────────────────────────────────────────────────

function readAll(): EmailerRow[] {
  try {
    if (!existsSync(DATA_FILE)) return []
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as EmailerRow[]
  } catch {
    return []
  }
}

function writeAll(rows: EmailerRow[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8')
}

function newId(): string {
  // Compact UUID-like ID without external deps
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

// ── Public API — the query shapes used by the API routes ─────────────────────

/** List all emailers, most recently updated first (metadata only, no blocks). */
export function localListEmailers(): EmailerMeta[] {
  return readAll()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(({ blocks: _blocks, ...meta }) => meta)
}

/** Get a single emailer with blocks. Returns null if not found. */
export function localGetEmailer(id: string): EmailerRow | null {
  return readAll().find((r) => r.id === id) ?? null
}

/** Create a new emailer. Returns the created row. */
export function localCreateEmailer(input: {
  name: string
  subject?: string | null
  preheader?: string | null
  blocks: unknown
}): EmailerRow {
  const rows = readAll()
  const ts = now()
  const row: EmailerRow = {
    id: newId(),
    name: input.name ?? 'Untitled',
    subject: input.subject ?? null,
    preheader: input.preheader ?? null,
    blocks: input.blocks,
    created_at: ts,
    updated_at: ts,
  }
  writeAll([row, ...rows])
  return row
}

/** Update name, subject, preheader and/or blocks. Returns the updated row or null if not found. */
export function localUpdateEmailer(
  id: string,
  patch: { name?: string; subject?: string | null; preheader?: string | null; blocks?: unknown },
): EmailerRow | null {
  const rows = readAll()
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return null

  const updated: EmailerRow = {
    ...rows[idx],
    ...(patch.name      !== undefined && { name:      patch.name }),
    ...(patch.subject   !== undefined && { subject:   patch.subject }),
    ...(patch.preheader !== undefined && { preheader: patch.preheader }),
    ...(patch.blocks    !== undefined && { blocks:    patch.blocks }),
    updated_at: now(),
  }
  rows[idx] = updated
  writeAll(rows)
  return updated
}

/** Delete an emailer. Returns true if found and deleted. */
export function localDeleteEmailer(id: string): boolean {
  const rows = readAll()
  const filtered = rows.filter((r) => r.id !== id)
  if (filtered.length === rows.length) return false
  writeAll(filtered)
  return true
}
