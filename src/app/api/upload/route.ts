/**
 * POST /api/upload
 * Body: { dataUrl: string }  — base64 data URL from FileReader
 * Returns: { url: string }   — public Minio URL
 */
import { NextResponse } from 'next/server'
import { uploadToMinio } from '@/lib/minio'

export async function POST(req: Request) {
  const { dataUrl } = await req.json() as { dataUrl?: string }
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return NextResponse.json({ error: 'Invalid dataUrl' }, { status: 400 })
  }

  // Parse  data:<mime>;base64,<payload>
  const [meta, payload] = dataUrl.split(',')
  const mimeMatch = meta.match(/data:([^;]+);base64/)
  if (!mimeMatch || !payload) {
    return NextResponse.json({ error: 'Malformed dataUrl' }, { status: 400 })
  }

  const mimeType = mimeMatch[1]
  const buffer = Buffer.from(payload, 'base64')

  try {
    const url = await uploadToMinio(buffer, mimeType, 'emailer-images')
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
