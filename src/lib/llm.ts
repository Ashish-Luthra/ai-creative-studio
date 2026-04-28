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
// To enable OpenAI support: npm install openai  and set AI_PROVIDER=openai

async function classifyWithOpenAI(
  _base64: string,
  _mediaType: string,
  _categories: string[],
): Promise<string> {
  throw new Error(
    'OpenAI support requires the "openai" package. ' +
    'Run: npm install openai  and set AI_PROVIDER=openai in .env.local',
  )
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
