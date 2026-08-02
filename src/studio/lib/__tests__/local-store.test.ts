/**
 * local-store.test.ts
 * Tests for the file-based emailer persistence layer used in local dev.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import {
  localListEmailers,
  localGetEmailer,
  localCreateEmailer,
  localUpdateEmailer,
  localDeleteEmailer,
} from '../local-store'

const DATA_FILE = join(process.cwd(), '.data', 'emailers.json')

// Reset the data file before each test so tests don't bleed into each other
beforeEach(() => {
  if (existsSync(DATA_FILE)) rmSync(DATA_FILE)
})
afterEach(() => {
  if (existsSync(DATA_FILE)) rmSync(DATA_FILE)
})

// ── Create ────────────────────────────────────────────────────────────────────

describe('localCreateEmailer', () => {
  it('creates a new emailer and returns the row', () => {
    const row = localCreateEmailer({ name: 'Test Email', blocks: [] })
    expect(row.id).toMatch(/^local-/)
    expect(row.name).toBe('Test Email')
    expect(row.subject).toBeNull()
    expect(row.blocks).toEqual([])
    expect(row.created_at).toBeTruthy()
    expect(row.updated_at).toBeTruthy()
  })

  it('defaults name to "Untitled" when not provided', () => {
    // @ts-expect-error intentionally omitting name
    const row = localCreateEmailer({ blocks: [] })
    expect(row.name).toBe('Untitled')
  })

  it('stores subject when provided', () => {
    const row = localCreateEmailer({ name: 'A', subject: 'Hello World', blocks: [] })
    expect(row.subject).toBe('Hello World')
  })

  it('persists blocks JSON', () => {
    const blocks = [{ id: 'b1', type: 'text', text: 'Hi' }]
    const row = localCreateEmailer({ name: 'A', blocks })
    expect(row.blocks).toEqual(blocks)
  })

  it('each emailer gets a unique id', () => {
    const a = localCreateEmailer({ name: 'A', blocks: [] })
    const b = localCreateEmailer({ name: 'B', blocks: [] })
    expect(a.id).not.toBe(b.id)
  })
})

// ── List ──────────────────────────────────────────────────────────────────────

describe('localListEmailers', () => {
  it('returns empty array when no emailers exist', () => {
    expect(localListEmailers()).toEqual([])
  })

  it('returns metadata without blocks', () => {
    localCreateEmailer({ name: 'A', blocks: [{ id: 'b1' }] })
    const list = localListEmailers()
    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('blocks')
    expect(list[0].name).toBe('A')
  })

  it('returns most recently updated first', async () => {
    localCreateEmailer({ name: 'First', blocks: [] })
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 10))
    localCreateEmailer({ name: 'Second', blocks: [] })
    const list = localListEmailers()
    expect(list[0].name).toBe('Second')
    expect(list[1].name).toBe('First')
  })

  it('lists multiple emailers', () => {
    localCreateEmailer({ name: 'A', blocks: [] })
    localCreateEmailer({ name: 'B', blocks: [] })
    localCreateEmailer({ name: 'C', blocks: [] })
    expect(localListEmailers()).toHaveLength(3)
  })
})

// ── Get ───────────────────────────────────────────────────────────────────────

describe('localGetEmailer', () => {
  it('returns the full row including blocks', () => {
    const created = localCreateEmailer({ name: 'Full', blocks: [{ id: 'x' }] })
    const fetched = localGetEmailer(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.blocks).toEqual([{ id: 'x' }])
  })

  it('returns null for unknown id', () => {
    expect(localGetEmailer('nonexistent-id')).toBeNull()
  })
})

// ── Update ────────────────────────────────────────────────────────────────────

describe('localUpdateEmailer', () => {
  it('updates name', () => {
    const row = localCreateEmailer({ name: 'Old', blocks: [] })
    const updated = localUpdateEmailer(row.id, { name: 'New' })
    expect(updated!.name).toBe('New')
  })

  it('updates subject', () => {
    const row = localCreateEmailer({ name: 'A', subject: 'Old subject', blocks: [] })
    const updated = localUpdateEmailer(row.id, { subject: 'New subject' })
    expect(updated!.subject).toBe('New subject')
  })

  it('updates blocks', () => {
    const row = localCreateEmailer({ name: 'A', blocks: [] })
    const newBlocks = [{ id: 'b1', type: 'text' }]
    const updated = localUpdateEmailer(row.id, { blocks: newBlocks })
    expect(updated!.blocks).toEqual(newBlocks)
  })

  it('bumps updated_at timestamp', async () => {
    const row = localCreateEmailer({ name: 'A', blocks: [] })
    await new Promise((r) => setTimeout(r, 10))
    const updated = localUpdateEmailer(row.id, { name: 'B' })
    expect(updated!.updated_at >= row.updated_at).toBe(true)
  })

  it('preserves fields not in the patch', () => {
    const row = localCreateEmailer({ name: 'A', subject: 'Sub', blocks: [1, 2] })
    const updated = localUpdateEmailer(row.id, { name: 'B' })
    expect(updated!.subject).toBe('Sub')
    expect(updated!.blocks).toEqual([1, 2])
  })

  it('returns null for unknown id', () => {
    expect(localUpdateEmailer('no-such-id', { name: 'X' })).toBeNull()
  })
})

// ── Delete ────────────────────────────────────────────────────────────────────

describe('localDeleteEmailer', () => {
  it('deletes an existing emailer and returns true', () => {
    const row = localCreateEmailer({ name: 'Delete Me', blocks: [] })
    expect(localDeleteEmailer(row.id)).toBe(true)
    expect(localGetEmailer(row.id)).toBeNull()
    expect(localListEmailers()).toHaveLength(0)
  })

  it('returns false for unknown id', () => {
    expect(localDeleteEmailer('ghost-id')).toBe(false)
  })

  it('only removes the targeted emailer', () => {
    const a = localCreateEmailer({ name: 'A', blocks: [] })
    const b = localCreateEmailer({ name: 'B', blocks: [] })
    localDeleteEmailer(a.id)
    expect(localListEmailers()).toHaveLength(1)
    expect(localListEmailers()[0].id).toBe(b.id)
  })
})
