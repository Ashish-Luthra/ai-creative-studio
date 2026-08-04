import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStructured } from '@studio/lib/llm';
import { loadKitForDomain, listKits } from '../../../../lib/brand-kit-store';
import { listItems } from '../../../../lib/content-store';
import { resolveDomain } from '../../../../lib/content-domain';
import { preferredCtaLabel } from '../../../../lib/brand-cta';

export const runtime = 'nodejs';
export const maxDuration = 90;

/**
 * Landing-page / case-study copy generation.
 *
 * The ads canvas had a brief agent and these surfaces did not, so asking for a
 * landing page on /studio/ads produced Instagram ads. This route fills the
 * copy for the block editor's slots instead: same brand kit and approved
 * corpus as the ad brief, but the output is page sections, not creatives.
 *
 * It returns SLOT VALUES only. Block structure, ids, colours and images stay
 * with the client's `makeDefaultBlock`, so a bad model response degrades to
 * placeholder copy rather than a broken document.
 */

const blockCopySchema = z.object({
  type: z.string().max(40),
  slots: z.record(z.string().max(40), z.string().max(1200)).default({}),
});

const responseSchema = z
  .object({
    title: z.string().max(120).catch('Untitled'),
    reply: z.string().max(600).catch(''),
    blocks: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(blockCopySchema).max(9)).catch([]),
  })
  .strip();

const requestSchema = z.object({
  brief: z.string().min(1).max(4000),
  mode: z.enum(['landing-page', 'case-study']),
  domain: z.string().optional(),
});

/**
 * The slots each block exposes. Kept in step with `makeDefaultBlock` in
 * pageStore — the client ignores any key not listed for that block, so drift
 * here degrades to placeholder copy rather than corrupting the document.
 */
const BLOCK_SLOTS: Record<string, string[]> = {
  'page-hero': ['tag', 'heading', 'subtext'],
  'page-executive-summary': [
    'heading', 'body',
    'stat1', 'stat1label', 'stat2', 'stat2label', 'stat3', 'stat3label',
  ],
  'page-problem': ['label', 'heading', 'body'],
  'page-solution': ['label', 'heading', 'body'],
  'page-results': ['heading'],
  'page-quote': ['quote', 'attribution'],
  'page-cta': ['heading', 'subtext', 'buttonText'],
};

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: 'Document title, e.g. "Lifecycle automation for CRM marketers"' },
    reply: { type: 'string', description: 'One or two sentences for the chat, describing the angle you took' },
    blocks: {
      type: 'array',
      description: 'One entry per section, in page order',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: Object.keys(BLOCK_SLOTS),
            description: 'Which section this copy fills',
          },
          slots: {
            type: 'object',
            description: 'Slot name → copy. Only use the slot names listed for that block.',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['type', 'slots'],
      },
    },
  },
  required: ['title', 'reply', 'blocks'],
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { brief, mode } = parsed.data;

  const domain = await resolveDomain(parsed.data.domain ?? null);
  const kit = (await loadKitForDomain(domain)) ?? (domain ? null : (await listKits())[0] ?? null);
  const deep = kit?.deep;
  const corpus = domain ? (await listItems(domain, 'approved')).slice(0, 20) : [];
  const ctaLabel = preferredCtaLabel(deep?.ctaSpecs);

  const system = [
    `You are the Allyvate content agent. You write ${mode === 'case-study' ? 'a case study' : 'a landing page'} for ${kit?.name ?? domain ?? 'the brand'}.`,
    `Write real copy, never placeholders. No "[Client]", no "Lorem ipsum", no square brackets.`,
    `BRAND VOICE (use its phrasing; never its wordsToAvoid): ${JSON.stringify(deep?.voice ?? {})}`,
    deep?.brandSummary ? `BRAND: ${deep.brandSummary}` : null,
    `APPROVED CONTENT (borrow real facts, names and numbers from these — do not invent statistics):`,
    JSON.stringify(corpus.map((c) => ({ title: c.title, category: c.category, whenToUse: c.referenceDescription }))),
    ctaLabel ? `The CTA button label is "${ctaLabel}" — use it verbatim in the CTA block's buttonText. Never use a form-button word like Submit or Send.` : null,
    `SECTIONS AND THEIR SLOTS (use these exact slot names; omit a section you have nothing real to say in):`,
    JSON.stringify(BLOCK_SLOTS),
    mode === 'case-study'
      ? `Order: hero, executive summary, problem, solution, results, quote, CTA. The results stats must come from the approved content — if there are none, write qualitative outcomes instead of inventing numbers.`
      : `Order: hero, problem, solution, results, CTA. Lead with the reader's problem, not the product.`,
    `Headlines are short and specific. Body copy is 2–4 sentences. Stats are a number plus a short label ("3×", "Revenue growth").`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await generateStructured<z.infer<typeof responseSchema>>({
    toolName: 'submit_page_copy',
    toolDescription: 'Return the page title and per-section copy.',
    inputSchema: TOOL_SCHEMA,
    zodSchema: responseSchema,
    system,
    messages: [{ role: 'user', content: brief }],
    maxTokens: 3500,
  });
  if (!result || result.blocks.length === 0) {
    return NextResponse.json({ error: 'Could not draft that page — try again.' }, { status: 502 });
  }

  // Drop unknown blocks and unknown slot names rather than trusting the model
  // to have obeyed the schema.
  const blocks = result.blocks
    .filter((b) => BLOCK_SLOTS[b.type])
    .map((b) => {
      const allowed = BLOCK_SLOTS[b.type];
      const slots: Record<string, string> = {};
      for (const [key, value] of Object.entries(b.slots)) {
        if (allowed.includes(key) && value.trim()) slots[key] = value.trim();
      }
      return { type: b.type, slots };
    })
    .filter((b) => Object.keys(b.slots).length > 0);

  return NextResponse.json({
    title: result.title,
    reply: result.reply || 'Drafted the page — edit any section inline.',
    blocks,
    brand: { domain: kit?.domain ?? domain },
  });
}
