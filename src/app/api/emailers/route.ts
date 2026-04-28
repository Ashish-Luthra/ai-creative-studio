import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  localListEmailers,
  localCreateEmailer,
} from '@/lib/local-store'

// GET /api/emailers — list all emailers (metadata only, no blocks)
export async function GET() {
  const sb = createServiceClient()

  // ── Supabase path ─────────────────────────────────────────────────────────
  if (sb) {
    const { data, error } = await sb
      .from('emailers')
      .select('id, name, subject, created_at, updated_at')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── Local file fallback ───────────────────────────────────────────────────
  return NextResponse.json(localListEmailers())
}

// POST /api/emailers — create a new emailer
export async function POST(req: Request) {
  const body = await req.json() as { name?: string; subject?: string; blocks?: unknown }

  if (!body.blocks) {
    return NextResponse.json({ error: 'blocks is required' }, { status: 400 })
  }

  const sb = createServiceClient()

  // ── Supabase path ─────────────────────────────────────────────────────────
  if (sb) {
    const { data, error } = await sb
      .from('emailers')
      .insert({
        name:    body.name    ?? 'Untitled',
        subject: body.subject ?? null,
        blocks:  body.blocks,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // ── Local file fallback ───────────────────────────────────────────────────
  const row = localCreateEmailer({
    name:    body.name    ?? 'Untitled',
    subject: body.subject ?? null,
    blocks:  body.blocks,
  })
  return NextResponse.json(row, { status: 201 })
}
