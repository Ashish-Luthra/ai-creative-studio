/**
 * POST /api/categorize-image
 * Body: { dataUrl: string }  — base64 data URL
 * Returns: { category: string, provider: string, model: string }
 *
 * Uses the LLM configured in src/lib/llm.ts (AI_PROVIDER / AI_MODEL env vars).
 */
import { NextResponse } from 'next/server'
import { classifyImage, AI_PROVIDER, AI_MODEL } from '@/lib/llm'
import { IMAGE_CATEGORIES } from '@/components/canvas/ApprovedImagesPanel'

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

    const category = await classifyImage(
      base64,
      mediaType,
      [...IMAGE_CATEGORIES],
    )

    return NextResponse.json({ category, provider: AI_PROVIDER, model: AI_MODEL })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Categorization failed'
    console.error('[categorize-image]', message)
    // Graceful fallback — never block the upload
    return NextResponse.json(
      { category: 'Uncategorised', provider: AI_PROVIDER, model: AI_MODEL, error: message },
      { status: 200 },
    )
  }
}
