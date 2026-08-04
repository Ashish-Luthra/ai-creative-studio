import { NextResponse } from 'next/server'
import {
  localGetEmailer,
  localUpdateEmailer,
  localDeleteEmailer,
} from '@studio/lib/local-store'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/emailers/[id] — load a single emailer (with blocks)
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const row = localGetEmailer(id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

// PUT /api/emailers/[id] — update name, subject, preheader and/or blocks
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as { name?: string; subject?: string; preheader?: string; blocks?: unknown }
  const updated = localUpdateEmailer(id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

// DELETE /api/emailers/[id]
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const deleted = localDeleteEmailer(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
