import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { AI_MODEL } from '@studio/lib/llm'

export const runtime = 'nodejs'
import { z } from 'zod'

const RequestSchema = z.object({
  message: z.string().min(1),
  context: z.object({
    type: z.enum(['text', 'image', 'design']),
    fieldContent: z.string().optional(),
    blockType: z.string().optional(),
  }),
})

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a creative copywriter for brands. When given a brief or request, you generate exactly 3 distinct copy variants.

Rules:
- Return ONLY a valid JSON array of 3 strings, nothing else
- Each variant must be a complete, standalone piece of copy
- Variants should differ meaningfully in tone, angle, or approach
- Keep each variant concise (1–3 sentences max)
- No variant numbers, labels, or explanations — pure copy only

Example output format:
["Variant one copy here.", "Variant two copy here.", "Variant three copy here."]`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { message, context } = parsed.data

  const userPrompt = context.fieldContent
    ? `Current field content: "${context.fieldContent}"\n\nRequest: ${message}`
    : message

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const variants: string[] = JSON.parse(raw)

    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error('Unexpected response shape')
    }

    return NextResponse.json({ data: { variants: variants.slice(0, 3) } })
  } catch {
    return NextResponse.json({ error: 'Failed to generate copy' }, { status: 500 })
  }
}
