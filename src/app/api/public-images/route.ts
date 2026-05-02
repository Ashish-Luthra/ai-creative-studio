/**
 * GET /api/public-images
 *
 * DEV-ONLY IMPLEMENTATION — DO NOT SHIP TO PROD AS-IS.
 *
 * Right now this route scans the local `public/` directory using Node fs so
 * dev work can proceed without external infra. The real source-of-truth for
 * "Approved Images" will be MinIO (S3-compatible object storage) and/or
 * Supabase, both of which are already in the stack.
 *
 * ─── To swap to MinIO ─────────────────────────────────────────────────────
 *  1. Reuse the `s3` client and `bucket` name from `src/lib/minio.ts`.
 *  2. Replace the `readdir` block below with:
 *
 *       import { ListObjectsV2Command } from '@aws-sdk/client-s3'
 *       import { s3 } from '@/lib/minio'
 *       const bucket = process.env.MINIO_BUCKET ?? 'emailer-assets'
 *       const prefix = 'approved-images/'   // or whatever curated prefix
 *       const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
 *       const items = (out.Contents ?? []).map((obj) => ({
 *         id:   `minio-${obj.Key}`,
 *         name: prettify(basename(obj.Key!)),
 *         category: 'Public Library',
 *         src:  publicUrlFor(obj.Key!),     // build from MINIO_ENDPOINT/PORT/SSL like uploadToMinio does
 *       }))
 *
 *  3. Add a `publicUrlFor(key)` helper to `src/lib/minio.ts` so URL building
 *     is centralised (the upload route currently builds the URL inline at
 *     line 53; extract that into a shared helper before this swap).
 *
 * ─── To swap to Supabase ──────────────────────────────────────────────────
 *  1. Create a table `approved_images` with columns:
 *       id (uuid pk), name (text), category (text),
 *       src (text, full URL), created_at (timestamptz default now())
 *  2. Replace the `readdir` block with:
 *
 *       import { createClient } from '@supabase/supabase-js'
 *       const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
 *       const { data, error } = await sb
 *         .from('approved_images')
 *         .select('id, name, category, src')
 *         .order('name', { ascending: true })
 *       if (error) return NextResponse.json({ error: error.message }, { status: 500 })
 *       return NextResponse.json({ data })
 *
 *  3. Use the service-role key only on the server (this route file). Never
 *     expose it to the client.
 *
 * ─── Hybrid (recommended for prod) ────────────────────────────────────────
 *  Editorial metadata (id, name, category, tags, ordering, is_archived) lives
 *  in Supabase; the `src` column points at MinIO object URLs uploaded via
 *  the existing `/api/upload` flow. This keeps curation queryable and
 *  storage cheap.
 *
 * Until that swap happens, drop new images into the repo's `public/` folder
 * and they will appear in the panel automatically on the next request.
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
