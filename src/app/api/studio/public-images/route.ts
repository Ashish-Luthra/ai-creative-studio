/**
 * GET /api/public-images
 *
 * DEV-ONLY IMPLEMENTATION — DO NOT SHIP TO PROD AS-IS.
 *
 * Right now this route scans the local `public/` directory using Node fs so
 * dev work can proceed without external infra.
 *
 * Production path (Allyvate stack, ADR 0001 — one Postgres): editorial
 * metadata (id, name, category, tags, is_archived) lives in Neon Postgres
 * behind the Allyvate API layer; `src` points at object-storage URLs (S3).
 * Replace the `readdir` block with a call to that API when it lands.
 *
 * Until then, drop new images into the repo's `public/` folder and they will
 * appear in the panel automatically on the next request.
 */

import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

interface DiscoveryImage {
  id: string
  name: string
  category: string
  src: string
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])
// Subfolders under public/ that are app chrome, not user-facing assets.
const SKIP_DIRS = new Set(['brand-logos', 'icons'])

const prettify = (basename: string): string =>
  basename
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const entries = await readdir(publicDir, { withFileTypes: true })

    const items: DiscoveryImage[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        // v1: non-recursive. Add recursion when a curated subfolder appears.
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!IMAGE_EXTS.has(ext)) continue

      const base = entry.name.slice(0, -ext.length)
      items.push({
        id: `public-${slug(base)}-${ext.slice(1)}`,
        name: prettify(base),
        category: 'Public Library',
        src: `/${encodeURIComponent(entry.name)}`,
      })
    }

    items.sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ data: items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list public images'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
