/**
 * LLM abstraction layer
 *
 * Control which provider/model is used via environment variables:
 *   AI_PROVIDER = 'anthropic' | 'openai'          (default: 'anthropic')
 *   AI_MODEL    = 'claude-sonnet-5' | 'gpt-4o' …  (default per provider below)
 *
 * Only the server-side (API routes) should import this file.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Key resolver ──────────────────────────────────────────────────────────────
// Turbopack (Next.js 16 dev) isolates each route in a worker where .env.local
// vars may not reach process.env. Read the file directly as a reliable fallback.
function resolveKey(envVar: string): string | undefined {
  const fromEnv = process.env[envVar]
  if (fromEnv) return fromEnv
  try {
    const file = join(process.cwd(), '.env.local')
    if (!existsSync(file)) return undefined
    const match = readFileSync(file, 'utf8').match(new RegExp(`^${envVar}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

export type LLMProvider = 'anthropic' | 'openai'

export const AI_PROVIDER = ((resolveKey('AI_PROVIDER') ?? 'anthropic')) as LLMProvider

export const AI_MODEL: string =
  resolveKey('AI_MODEL') ??
  (AI_PROVIDER === 'openai' ? 'gpt-4o' : 'claude-sonnet-5')

// ── Shared types ─────────────────────────────────────────────────────────────

/**
 * Image Intelligence — the "DNA" of an image returned by the analyse endpoint.
 * category  : best matching category from the provided list
 * tags      : 4–6 short descriptive attributes (subject, style, mood, visual)
 */
export interface ImageAnalysis {
  category: string
  tags: string[]
}

// ── Anthropic ────────────────────────────────────────────────────────────────

async function analyseWithAnthropic(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<ImageAnalysis> {
  const apiKey = resolveKey('ANTHROPIC_API_KEY')
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 256,
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
            text: `You are an Image Intelligence engine for a digital asset management system.

Analyse this image and return a JSON object with exactly two keys:
1. "category" — the single best-matching category from this list:
${categories.map((c) => `   - ${c}`).join('\n')}

2. "tags" — an array of 4 to 6 short, lowercase descriptive attributes covering:
   • subject matter (e.g. "woman", "shoes", "food", "city")
   • visual style  (e.g. "editorial", "flat-lay", "portrait", "macro")
   • mood / tone   (e.g. "luxury", "playful", "energetic", "minimal")
   • setting       (e.g. "outdoor", "studio", "dark background")

Rules:
- Each tag must be 1–3 words, lowercase, no punctuation.
- Return ONLY the raw JSON object — no markdown fences, no explanation.

Example output:
{"category":"Lifestyle & Campaign","tags":["woman","outdoor","summer","energetic","fashion","lifestyle"]}`,
          },
        ],
      },
    ],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()

  try {
    const parsed = JSON.parse(raw) as { category?: string; tags?: unknown }
    const category = categories.includes(parsed.category ?? '') ? (parsed.category as string) : 'Uncategorised'
    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t) => typeof t === 'string').slice(0, 6) as string[]
      : []
    return { category, tags }
  } catch {
    // JSON parse failed — fall back gracefully
    return { category: 'Uncategorised', tags: [] }
  }
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
// To enable OpenAI support: npm install openai  and set AI_PROVIDER=openai

async function analyseWithOpenAI(
  _base64: string,
  _mediaType: string,
  _categories: string[],
): Promise<ImageAnalysis> {
  throw new Error(
    'OpenAI support requires the "openai" package. ' +
    'Run: npm install openai  and set AI_PROVIDER=openai in .env.local',
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse an image — returns its best-fit category AND descriptive tags (Image DNA).
 * Uses the configured AI_PROVIDER / AI_MODEL.
 */
export async function analyseImage(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<ImageAnalysis> {
  if (AI_PROVIDER === 'openai') {
    return analyseWithOpenAI(base64, mediaType, categories)
  }
  return analyseWithAnthropic(base64, mediaType, categories)
}

/**
 * @deprecated Use analyseImage() which also returns tags.
 * Kept for backward compatibility with /api/categorize-image.
 */
export async function classifyImage(
  base64: string,
  mediaType: string,
  categories: string[],
): Promise<string> {
  const { category } = await analyseImage(base64, mediaType, categories)
  return category
}

// ── Structured output ────────────────────────────────────────────────────────

/**
 * One forced-tool-use Claude call returning schema-validated JSON (monorepo
 * convention: every Claude call → Zod-validated structured output; schemas
 * should coerce rather than hard-reject). Shared by /api/studio/brief and any
 * future structured route.
 */
export async function generateStructured<T>(args: {
  toolName: string
  toolDescription: string
  inputSchema: Record<string, unknown> // JSON Schema for the tool
  zodSchema: { safeParse: (v: unknown) => { success: boolean; data?: T } }
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}): Promise<T | null> {
  const apiKey = resolveKey('ANTHROPIC_API_KEY')
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: args.maxTokens ?? 3000,
    system: args.system,
    messages: args.messages,
    tools: [
      {
        name: args.toolName,
        description: args.toolDescription,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: args.inputSchema as any,
      },
    ],
    tool_choice: { type: 'tool', name: args.toolName },
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  const raw = toolUse && 'input' in toolUse ? toolUse.input : null
  const parsed = args.zodSchema.safeParse(raw)
  return parsed.success && parsed.data !== undefined ? parsed.data : null
}
