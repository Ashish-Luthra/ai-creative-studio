import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { generateStructured } from '@studio/lib/llm'
import { CREATIVE_PRESETS } from '@studio/lib/canvas/presets'
import { listKits, loadKitForDomain } from '../../../../lib/brand-kit-store'
import { listItems } from '../../../../lib/content-store'
import { resolveDomain } from '../../../../lib/content-domain'
import { isRealCta, preferredCtaLabel } from '../../../../lib/brand-cta'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Agentic brief chat: conversation in → either a clarifying question or 3–5
 * CreativeSpecs grounded in the Brand Kit (colors/type/CTA/voice) and the
 * approved content corpus. ONE forced-tool-use Claude call per turn
 * (monorepo conventions; no agent framework).
 */

/**
 * Answers from the qualifying flow arrive as a structured block rather than as
 * fake user turns in `messages`. Fake turns would burn the 20-message cap, make
 * the transcript unreadable, and let the model re-negotiate answers the user
 * has already confirmed.
 */
const qualifyAnswerSchema = z.object({
  questionId: z.string().max(60),
  prompt: z.string().max(200).default(''),
  label: z.string().max(200),
  value: z.string().max(400),
  source: z.enum(['option', 'freeText', 'skipped']).catch('option'),
  /** Figures, competitor names, offers — must reach the ad character-for-character. */
  verbatim: z.boolean().default(false),
})

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
  domain: z.string().optional(),
  brief: z
    .object({
      catalogueVersion: z.string().max(40),
      vertical: z.enum(['ecommerce', 'fintech-banking', 'saas-tech']).optional(),
      taskId: z.string().max(60).optional(),
      taskName: z.string().max(120).optional(),
      presetId: z.string().max(60).optional(),
      ctaIntent: z.enum(['primary', 'soft']).optional(),
      answers: z.array(qualifyAnswerSchema).max(8).default([]),
    })
    .optional(),
})

type QualifyBrief = NonNullable<z.infer<typeof requestSchema>['brief']>

const specSchema = z
  .object({
    presetId: z.string().catch('instagram-1-1'),
    headline: z.string().max(120).catch(''),
    subhead: z.string().max(200).optional(),
    ctaLabel: z.string().max(40).optional(),
    /**
     * How the frame is filled. Only 'image' consumes `imageRef`; the other two
     * paint straight from the palette, which is what most B2B social creative
     * actually looks like — and the only honest option when the library has no
     * photography that fits the brand.
     */
    background: z
      .preprocess((v) => {
        const s = String(v).toLowerCase()
        if (s.includes('image') || s.includes('photo')) return 'image'
        if (s.includes('grad')) return 'gradient'
        return 'solid'
      }, z.enum(['image', 'solid', 'gradient']))
      .catch('solid'),
    gradientFrom: z.string().optional(),
    gradientTo: z.string().optional(),
    imageRef: z.string().catch(''),
    style: z
      .object({
        textColor: z.string().catch('#ffffff'),
        scrimFrom: z.string().catch('rgba(0,0,0,0)'),
        scrimTo: z.string().catch('rgba(0,0,0,0.65)'),
        frameColor: z.string().catch('#D1D5DB'),
        fontFamily: z.string().catch(''),
        fontPx: z.coerce.number().min(16).max(96).catch(40),
        fontWeight: z.coerce.number().catch(700),
        ctaBg: z.string().optional(),
        ctaColor: z.string().optional(),
      })
      .catch({
        textColor: '#ffffff',
        scrimFrom: 'rgba(0,0,0,0)',
        scrimTo: 'rgba(0,0,0,0.65)',
        frameColor: '#D1D5DB',
        fontFamily: '',
        fontPx: 40,
        fontWeight: 700,
      }),
    rationale: z.string().max(300).catch(''),
  })
  .strip()

const responseSchema = z
  .object({
    kind: z
      .preprocess((v) => (String(v).toLowerCase().includes('spec') ? 'specs' : 'message'), z.enum(['message', 'specs']))
      .catch('message'),
    reply: z.string().max(1200).catch(''),
    specs: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(specSchema).max(5)).catch([]),
  })
  .strip()

export type BriefSpec = z.infer<typeof specSchema>

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    kind: { type: 'string', enum: ['message', 'specs'], description: "'message' to ask ONE clarifying question; 'specs' when ready to generate" },
    reply: { type: 'string', description: 'Short conversational reply shown in the chat (1-3 sentences)' },
    specs: {
      type: 'array',
      description: '3-5 creative options when kind=specs, else empty',
      items: {
        type: 'object',
        properties: {
          presetId: { type: 'string', description: 'One of the provided preset ids' },
          headline: { type: 'string', description: 'On-voice headline for the creative (≤9 words, use brand phrasing)' },
          subhead: { type: 'string' },
          ctaLabel: { type: 'string', description: "CTA text, e.g. the brand's primary CTA label" },
          background: {
            type: 'string',
            enum: ['solid', 'gradient', 'image'],
            description:
              "How to fill the frame. 'solid' = flat brand color, 'gradient' = two brand colors, 'image' = ONLY if an inventory photo genuinely fits the brief",
          },
          gradientFrom: { type: 'string', description: "hex from the brand palette (when background='gradient')" },
          gradientTo: { type: 'string', description: "hex from the brand palette (when background='gradient')" },
          imageRef: { type: 'string', description: "id of an image from the provided inventory (only when background='image')" },
          style: {
            type: 'object',
            properties: {
              textColor: { type: 'string', description: 'hex from the brand palette' },
              scrimFrom: { type: 'string' },
              scrimTo: { type: 'string' },
              frameColor: { type: 'string', description: 'hex from the brand palette (canvas/neutral role)' },
              fontFamily: { type: 'string', description: 'brand heading font family' },
              fontPx: { type: 'number' },
              fontWeight: { type: 'number' },
              ctaBg: { type: 'string' },
              ctaColor: { type: 'string' },
            },
            required: ['textColor', 'frameColor', 'fontFamily', 'fontPx', 'fontWeight'],
          },
          rationale: { type: 'string', description: 'One line: why this option (angle, audience)' },
        },
        required: ['presetId', 'headline', 'background', 'style'],
      },
    },
  },
  required: ['kind', 'reply', 'specs'],
}

function hexDist(a: string, b: string): number {
  const pa = /^#?([0-9a-f]{6})$/i.exec(a.trim())?.[1]
  const pb = /^#?([0-9a-f]{6})$/i.exec(b.trim())?.[1]
  if (!pa || !pb) return Infinity
  let d = 0
  for (let i = 0; i < 6; i += 2) d += Math.abs(parseInt(pa.slice(i, i + 2), 16) - parseInt(pb.slice(i, i + 2), 16))
  return d
}

function snapHex(value: string, palette: string[], fallback: string): string {
  if (/^rgba?\(/.test(value)) return value // gradients/scrims may be rgba — pass through
  let best = fallback
  let bestD = Infinity
  for (const p of palette) {
    const d = hexDist(value, p)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return bestD === Infinity ? fallback : best
}

/**
 * App chrome, not photography. Wordmarks/icons stretched edge-to-edge behind a
 * headline look like a mistake, so they never reach the agent.
 */
const NON_PHOTO = /(logo|wordmark|icon|favicon|allyvate-)/i

/**
 * Usable ad backgrounds only.
 *
 * Brand-kit `desktop.jpg`/`mobile.jpg` are full-page website screenshots — nav
 * bars, cookie-consent banners and headlines cropped mid-word. They were in
 * here and the agent (reasonably) read "website screenshot" as the most
 * on-brand option, so every creative came out as an ad pasted over a screengrab
 * of the marketing site. They are deliberately NOT offered; a creative with no
 * fitting photo uses a brand color or gradient instead.
 *
 * Production path: the curated asset library (Content Engine images in Neon)
 * replaces this `public/` scan.
 */
async function imageInventory(): Promise<Array<{ id: string; src: string; note: string }>> {
  const inventory: Array<{ id: string; src: string; note: string }> = []
  try {
    const pub = path.join(process.cwd(), 'public')
    const files = await readdir(pub, { withFileTypes: true })
    for (const f of files) {
      if (!f.isFile() || !/\.(jpe?g|png|webp)$/i.test(f.name)) continue
      if (NON_PHOTO.test(f.name)) continue
      inventory.push({ id: f.name, src: `/${encodeURIComponent(f.name)}`, note: 'stock library photo' })
    }
  } catch {
    /* empty public dir */
  }
  return inventory
}

/**
 * WCAG relative luminance; -1 when unparseable. Accepts `#rrggbb` and
 * `rgb(r,g,b)` — kit CTA specs come off computed styles, so they arrive in
 * rgb() form and would otherwise skip the contrast guard entirely.
 */
function luminance(color: string): number {
  const value = color.trim()
  let rgb: [number, number, number] | null = null

  const hex = /^#?([0-9a-f]{6})$/i.exec(value)?.[1]
  if (hex) rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

  const parts = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value)
  if (!rgb && parts) rgb = [Number(parts[1]), Number(parts[2]), Number(parts[3])]

  if (!rgb || rgb.some((c) => !Number.isFinite(c))) return -1
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}


function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  if (la < 0 || lb < 0) return Infinity // non-hex (rgba scrims) — leave alone
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Without a photo there is no dark scrim to rescue readability, so the copy
 * color is not left to the model: anything under 4.5:1 on the actual background
 * snaps to whichever of ink/white reads better.
 */
function readableOn(background: string, preferred: string, ink: string): string {
  if (contrastRatio(background, preferred) >= 4.5) return preferred
  return contrastRatio(background, ink) >= contrastRatio(background, '#ffffff') ? ink : '#ffffff'
}

interface BriefConstraints {
  /** The user picked a channel, so preset choice is no longer the model's. */
  forcedPresetId?: string
  ctaPreference?: 'primary' | 'soft'
  allowImageBackground: boolean
  /** Strings that must survive into the copy untouched. */
  verbatimStrings: string[]
}

function constraintsFrom(brief: QualifyBrief | undefined, inventoryCount: number): BriefConstraints {
  const validPreset = brief?.presetId && CREATIVE_PRESETS.some((p) => p.id === brief.presetId)
  return {
    forcedPresetId: validPreset ? brief?.presetId : undefined,
    ctaPreference: brief?.ctaIntent,
    // 'image' is only meaningful if there is anything to show.
    allowImageBackground: inventoryCount > 0,
    verbatimStrings: (brief?.answers ?? [])
      .filter((a) => a.verbatim && a.source !== 'skipped' && a.value.trim())
      .map((a) => a.value.trim()),
  }
}

/** The qualifying answers, rendered for the prompt. */
function qualifyingBriefBlock(brief: QualifyBrief): string {
  const lines = [
    `QUALIFYING BRIEF — the user answered these directly. Treat every line as a fixed constraint and NEVER ask about them again.`,
    brief.taskName ? `- Campaign type: ${brief.taskName}` : null,
    brief.vertical ? `- Sector: ${brief.vertical}` : null,
  ].filter(Boolean) as string[]

  for (const a of brief.answers) {
    if (a.source === 'skipped') continue
    const q = a.prompt || a.questionId
    lines.push(`- ${q} → ${a.value}${a.verbatim ? '   [REPRODUCE THIS EXACTLY — do not paraphrase, round or re-word]' : ''}`)
  }

  const verbatim = brief.answers.filter((a) => a.verbatim && a.source !== 'skipped' && a.value.trim())
  if (verbatim.length > 0) {
    lines.push(
      `The following must appear character-for-character in the headline or subhead of at least one creative: ${verbatim
        .map((a) => JSON.stringify(a.value.trim()))
        .join(', ')}.`
    )
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const brief = parsed.data.brief

  const domain = await resolveDomain(parsed.data.domain ?? null)
  // `loadKitForDomain` tolerates a www. mismatch between the content store and
  // the kit filenames. Only when there is NO domain at all do we fall back to
  // whatever kit exists — borrowing another tenant's palette for a known domain
  // would produce confidently off-brand creatives.
  const kit = (await loadKitForDomain(domain)) ?? (domain ? null : (await listKits())[0] ?? null)
  const deep = kit?.deep
  const palette = (deep?.colorSystem ?? []).map((c) => c.hex)
  const headingFamily = kit?.typography?.heading?.family ?? 'Inter'
  const corpus = domain ? (await listItems(domain, 'approved')).slice(0, 20) : []
  const inventory = await imageInventory()

  const constraints = constraintsFrom(brief, inventory.length)

  const system = [
    `You are the Allyvate creative agent inside a Fabric.js ad studio. You design on-brand social creatives for ${kit?.name ?? domain ?? 'the brand'}.`,
    brief
      ? `The user has already been through a qualifying flow. NEVER ask a clarifying question — the brief below IS the brief. Always return kind='specs'.`
      : `Have a SHORT conversation: if the brief is clear enough, produce specs immediately; ask at most ONE clarifying question total, and only when essential.`,
    brief ? qualifyingBriefBlock(brief) : null,
    `BRAND KIT (single source of truth — use ONLY these values):`,
    `- Colors: ${JSON.stringify((deep?.colorSystem ?? []).map((c) => ({ hex: c.hex, role: c.role, name: c.name })))}`,
    `- Gradients: ${JSON.stringify((deep?.gradients ?? []).map((g) => g.stops ?? []))}`,
    `- Type scale: ${JSON.stringify((deep?.typeScale ?? []).map((t) => ({ label: t.label, family: t.family, px: t.px, weight: t.weight })))} — heading family: ${headingFamily}`,
    `- CTAs: ${JSON.stringify((deep?.ctaSpecs ?? []).map((c) => ({ kind: c.kind, label: c.label, background: c.background, color: c.color })))}`,
    `- Voice: ${JSON.stringify(deep?.voice ?? {})}`,
    `APPROVED CONTENT (ground copy angles in these; borrow their language):`,
    JSON.stringify(corpus.map((c) => ({ title: c.title, category: c.category, whenToUse: c.referenceDescription }))),
    `IMAGE INVENTORY (generic stock; imageRef MUST be one of these ids). It is usually EMPTY or irrelevant to this brand — that is expected, not a problem:`,
    JSON.stringify(inventory),
    `PRESETS (presetId MUST be one of): ${JSON.stringify(CREATIVE_PRESETS.map((p) => ({ id: p.id, label: p.label })))}`,
    `BACKGROUNDS: default to background='solid' (a palette hex in frameColor) or background='gradient' (gradientFrom/gradientTo, two palette hexes) — bold type on brand color is the house style. Use background='image' ONLY when an inventory photo genuinely suits the brief's subject; a photo that doesn't fit is worse than no photo. Set textColor to a palette hex that contrasts strongly with the background you chose (light copy on ink/accent, ink copy on canvas/neutral).`,
    `ALWAYS write a subhead: one supporting line (≤14 words) that pays off the headline with a proof point or specific from the approved content. It is rendered under the headline, so a creative without one looks empty.`,
    `ctaLabel must be a call to action ("Book a demo", "Get started"), never a form button scraped off the site ("Submit", "Send", "Sign in").`,
    `Rules: headlines ≤9 words in the brand voice (prefer its phrasesToUse; never its wordsToAvoid). fontFamily = the brand heading family. Vary both the angle (product, proof, urgency, audience) AND the background treatment across options. ctaLabel defaults to the brand's primary CTA.`,
    // The preset is pinned server-side when the user chose a channel, so the
    // model must vary the treatment instead of the format.
    constraints.forcedPresetId
      ? `Every creative runs in the ${constraints.forcedPresetId} format — vary the ANGLE and the BACKGROUND across options, not the size.`
      : null,
    constraints.ctaPreference === 'soft'
      ? `This is a low-commitment ask: prefer a softer CTA (read, watch, learn, compare) over "Book a demo" or "Buy".`
      : null,
    !constraints.allowImageBackground ? `There is no usable photography — never return background='image'.` : null,
    // Regulated copy: the model will happily invent a plausible-sounding
    // regulator, insurer or scheme (it produced "Not FDIC-guaranteed" for a
    // European payments company). Naming the wrong scheme is a compliance
    // incident, not a bad headline.
    brief?.vertical === 'fintech-banking'
      ? `REGULATED COPY. Never name a regulator, deposit-insurance scheme, licence or certification (FDIC, FCA, SEC, RBI, PCI DSS, SOC 2 …) unless that exact name appears in the qualifying brief above. Never state or imply a guarantee, a risk-free return, or an approval. Reproduce every figure exactly as given — no rounding, no "up to" unless the brief says so. Prefer plain, checkable statements over superlatives.`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const result = await generateStructured<z.infer<typeof responseSchema>>({
    toolName: 'submit_brief_result',
    toolDescription: 'Reply in the brief chat and/or submit creative specs.',
    inputSchema: TOOL_SCHEMA,
    zodSchema: responseSchema,
    system,
    messages: parsed.data.messages,
    maxTokens: 3500,
  })
  if (!result) return NextResponse.json({ error: 'Brief generation failed' }, { status: 502 })

  // Deterministic guardrails: snap style values into the kit, refs into inventory.
  const ink = (deep?.colorSystem ?? []).find((c) => c.role === 'ink')?.hex ?? '#111111'
  const canvas = (deep?.colorSystem ?? []).find((c) => c.role === 'canvas')?.hex ?? '#f3f4f6'
  const ctaSpecs = deep?.ctaSpecs ?? []
  const primaryCta = ctaSpecs.find((c) => c.kind === 'primary')
  // Keep the primary button's styling (that IS the brand's button), but take
  // the label from the first CTA that actually reads as a call to action.
  const defaultCtaLabel = preferredCtaLabel(ctaSpecs, constraints.ctaPreference ?? 'primary')
  const validPresets = new Set(CREATIVE_PRESETS.map((p) => p.id))
  const validImages = new Map(inventory.map((i) => [i.id, i.src]))

  const accent = (deep?.colorSystem ?? []).find((c) => c.role === 'accent')?.hex ?? ink
  const logos = (deep as { logos?: { light?: string; dark?: string } } | undefined)?.logos
  const snap = (value: string | undefined, fallback: string) =>
    value && palette.length ? snapHex(value, palette, fallback) : value || fallback

  // A set where every option is the same near-white rectangle reads as broken
  // even when each creative is individually valid. Give repeats of the same
  // background a different palette color so the four options look like four
  // options. Rotation order = the brand's own hierarchy.
  const rotation = [ink, accent, canvas, ...palette].filter(Boolean)
  const usedBackgrounds = new Set<string>()

  const specs = result.specs.slice(0, 5).map((s) => {
    // A photo the agent asked for but that isn't in the inventory used to fall
    // back to whatever sat first in public/ (a stock coffee shot). Drop to a
    // brand color instead — wrong-but-pretty imagery is still wrong.
    const imageSrc =
      constraints.allowImageBackground && s.background === 'image' ? validImages.get(s.imageRef) ?? null : null
    const background = imageSrc ? 'image' : s.background === 'image' ? 'solid' : s.background

    let frameColor = snap(s.style.frameColor, canvas)
    if (background === 'solid') {
      if (usedBackgrounds.has(frameColor)) {
        frameColor = rotation.find((c) => !usedBackgrounds.has(c)) ?? frameColor
      }
      usedBackgrounds.add(frameColor)
    }
    let gradientFrom = background === 'gradient' ? snap(s.gradientFrom, ink) : undefined
    const gradientTo = background === 'gradient' ? snap(s.gradientTo, accent) : undefined
    // Gradients rotate too. Once the preset is pinned to the task's format, the
    // background is the ONLY thing carrying variety across the set — four
    // identical gradients in one size read as a rendering bug, not as options.
    if (background === 'gradient' && gradientFrom) {
      if (usedBackgrounds.has(gradientFrom)) {
        gradientFrom = rotation.find((c) => !usedBackgrounds.has(c) && c !== gradientTo) ?? gradientFrom
      }
      usedBackgrounds.add(gradientFrom)
    }

    // Over a photo the scrim guarantees contrast; over flat brand color there
    // is nothing to hide behind, so the copy color has to be verified.
    const textColor = snap(s.style.textColor, '#ffffff')
    const ctaBg = s.style.ctaBg ?? primaryCta?.background ?? ink

    return {
      ...s,
      // The user told us the channel, so preset choice is not the model's.
      presetId: constraints.forcedPresetId ?? (validPresets.has(s.presetId) ? s.presetId : 'instagram-1-1'),
      background,
      imageSrc,
      gradientFrom,
      gradientTo,
      ctaLabel:
        isRealCta(s.ctaLabel) ? s.ctaLabel : defaultCtaLabel,
      // Wordmark variant follows the background it sits on: `logos.light` is
      // the mark drawn FOR light backgrounds, `logos.dark` for dark ones.
      logoUrl:
        background === 'image'
          ? logos?.dark ?? logos?.light ?? null
          : luminance(gradientFrom ?? frameColor) > 0.5
            ? logos?.light ?? null
            : logos?.dark ?? logos?.light ?? null,
      // An accent rule the same color as the frame it sits on is invisible.
      accentColor: contrastRatio(gradientFrom ?? frameColor, accent) >= 1.6 ? accent : undefined,
      style: {
        ...s.style,
        textColor:
          background === 'image' ? textColor : readableOn(gradientTo ?? frameColor, textColor, ink),
        frameColor,
        fontFamily: s.style.fontFamily || headingFamily,
        // No photo → no scrim. A dark wash over a flat brand color just makes
        // the palette look muddy and off-brand.
        scrimFrom: background === 'image' ? s.style.scrimFrom : 'rgba(0,0,0,0)',
        scrimTo: background === 'image' ? s.style.scrimTo : 'rgba(0,0,0,0)',
        ctaBg,
        ctaColor: readableOn(ctaBg, s.style.ctaColor ?? primaryCta?.color ?? '#ffffff', ink),
      },
    }
  })

  // A qualified brief that produced nothing is a failure, not a conversation —
  // the user has just spent a minute answering questions, so say so plainly and
  // let the client offer one-click retry rather than stalling on a chat bubble.
  if (brief && specs.length === 0) {
    return NextResponse.json(
      {
        kind: 'message',
        reply: result.reply || "I couldn't turn that into creatives — try again.",
        specs: [],
        retryable: true,
        brand: { domain: kit?.domain ?? domain, headingFamily, ink, canvas },
      },
      { status: 200 }
    )
  }

  return NextResponse.json({
    kind: specs.length > 0 && result.kind === 'specs' ? 'specs' : 'message',
    reply: result.reply || (specs.length ? 'Here are your options.' : 'Tell me a bit more about the campaign.'),
    specs,
    brand: { domain: kit?.domain ?? domain, headingFamily, ink, canvas },
  })
}
