import { NextResponse } from 'next/server'
import {
  localListEmailers,
  localCreateEmailer,
} from '@/lib/local-store'

// GET /api/emailers — list all emailers (metadata only, no blocks)
export async function GET() {
  return NextResponse.json(localListEmailers())
}

// POST /api/emailers — create a new emailer
export async function POST(req: Request) {
  const body = await req.json() as { name?: string; subject?: string; preheader?: string; blocks?: unknown }

  if (!body.blocks) {
    return NextResponse.json({ error: 'blocks is required' }, { status: 400 })
  }

  const row = localCreateEmailer({
    name:      body.name      ?? 'Untitled',
    subject:   body.subject   ?? null,
    preheader: body.preheader ?? null,
    blocks:    body.blocks,
  })
  return NextResponse.json(row, { status: 201 })
}
