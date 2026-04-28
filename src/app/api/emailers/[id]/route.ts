import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  localGetEmailer,
  localUpdateEmailer,
  localDeleteEmailer,
} from '@/lib/local-store'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/emailers/[id] — load a single emailer (with blocks)
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const sb = createServiceClient()

  // ── Supabase path ─────────────────────────────────────────────────────────
  if (sb) {
    const { data, error } = await sb
      .from('emailers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 },
      )
    }
    return NextResponse.json(data)
  }

  // ── Local file fallback ───────────────────────────────────────────────────
  const row = localGetEmailer(id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

// PUT /api/emailers/[id] — update name, subject, preheader and/or blocks
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as { name?: string; subject?: string; preheader?: string; blocks?: unknown }
  const sb = createServiceClient()

  // ── Supabase path ─────────────────────────────────────────────────────────
  if (sb) {
    const { data, error } = await sb
      .from('emailers')
      .update({
        ...(body.name      !== undefined && { name:      body.name      }),
        ...(body.subject   !== undefined && { subject:   body.subject   }),
        ...(body.preheader !== undefined && { preheader: body.preheader }),
        ...(body.blocks    !== undefined && { blocks:    body.blocks    }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── Local file fallback ───────────────────────────────────────────────────
  const updated = localUpdateEmailer(id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

// DELETE /api/emailers/[id]
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const sb = createServiceClient()

  // ── Supabase path ─────────────────────────────────────────────────────────
  if (sb) {
    const { error } = await sb.from('emailers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  }

  // ── Local file fallback ───────────────────────────────────────────────────
  const deleted = localDeleteEmailer(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
