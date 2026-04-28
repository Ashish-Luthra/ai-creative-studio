/**
 * POST /api/analyse-image
 * Body:    { dataUrl: string }  — base64 data URL
 * Returns: { category: string, tags: string[], provider: string, model: string }
 *
 * Image Intelligence endpoint — returns both the DAM category AND descriptive
 * attribute tags (the "DNA" of the image) in a single AI call.
 */
import { NextResponse } from 'next/server'
import { analyseImage, AI_PROVIDER, AI_MODEL } from '@/lib/llm'
import { IMAGE_CATEGORIES } from '@/lib/image-categories'

export async function POST(req: Request) {
  try {
    const { dataUrl } = (await req.json()) as { dataUrl?: string }

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid dataUrl' }, { status: 400 })
    }

    // Parse  data:<mime>;base64,<payload>
    const [meta, base64] = dataUrl.split(',')
    const mimeMatch = meta.match(/data:([^;]+);base64/)
    if (!mimeMatch || !base64) {
      return NextResponse.json({ error: 'Malformed dataUrl' }, { status: 400 })
    }

    const mediaType = mimeMatch[1]

    const { category, tags } = await analyseImage(
      base64,
      mediaType,
      [...IMAGE_CATEGORIES],
    )

    return NextResponse.json({ category, tags, provider: AI_PROVIDER, model: AI_MODEL })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    console.error('[analyse-image]', message)
    // Graceful fallback — never block the upload
    return NextResponse.json(
      { category: 'Uncategorised', tags: [], provider: AI_PROVIDER, model: AI_MODEL, error: message },
      { status: 200 },
    )
  }
}
