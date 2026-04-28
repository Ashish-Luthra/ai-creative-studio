/**
 * LLM abstraction layer
 *
 * Control which provider/model is used via environment variables:
 *   AI_PROVIDER = 'anthropic' | 'openai'          (default: 'anthropic')
 *   AI_MODEL    = 'claude-opus-4-5' | 'gpt-4o' …  (default per provider below)
 *
 * Only the server-side (API routes) should import this file.
 */

export type LLMProvider = 'anthropic' | 'openai'

export const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as LLMProvider

export const AI_MODEL: string =
  process.env.AI_MODEL ??
  (AI_PROVIDER === 'openai' ? 'gpt-4o' : 'claude-opus-4-5')

// ── Anthropic ────────────────────────────────────────────────────────────────

async function classifyWithAnthropic(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `You are an image categorisation assistant for a digital asset management system.

Look at this image and pick the SINGLE most appropriate category from the list below.
Reply with ONLY the exact category name — no explanation, no punctuation, nothing else.

Categories:
${categories.map((c) => `- ${c}`).join('\n')}`,
          },
        ],
      },
    ],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  // Validate — fall back to Uncategorised if the model hallucinated
  return categories.includes(raw) ? raw : 'Uncategorised'
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function classifyWithOpenAI(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<string> {
  // Dynamic import so the package is optional
  const { default: OpenAI } = await import('openai' as string as 'openai')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          {
            type: 'text',
            text: `You are an image categorisation assistant for a digital asset management system.

Look at this image and pick the SINGLE most appropriate category from the list below.
Reply with ONLY the exact category name — no explanation, no punctuation, nothing else.

Categories:
${categories.map((c) => `- ${c}`).join('\n')}`,
          },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  return categories.includes(raw) ? raw : 'Uncategorised'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify an image into one of the provided category names.
 * Uses the configured AI_PROVIDER / AI_MODEL.
 */
export async function classifyImage(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<string> {
  if (AI_PROVIDER === 'openai') {
    return classifyWithOpenAI(base64, mediaType, categories)
  }
  return classifyWithAnthropic(base64, mediaType, categories)
}
