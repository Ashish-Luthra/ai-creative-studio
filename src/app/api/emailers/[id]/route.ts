import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/emailers/[id] — load a single emailer (with blocks)
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('emailers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }
  return NextResponse.json(data)
}

// PUT /api/emailers/[id] — update name, subject and/or blocks
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as { name?: string; subject?: string; blocks?: unknown }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('emailers')
    .update({
      ...(body.name    !== undefined && { name:    body.name    }),
      ...(body.subject !== undefined && { subject: body.subject }),
      ...(body.blocks  !== undefined && { blocks:  body.blocks  }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/emailers/[id]
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const sb = createServiceClient()
  const { error } = await sb.from('emailers').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
