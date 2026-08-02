import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { nearestHex, type DeterministicDraft } from './postprocess';
import type { BrandVoice, ColorGroup, DeepColor, DeepGradient, SectionCopy, SectionKey } from '../brand-kit-types';

/**
 * The LLM layer of the pipeline. Claude never measures anything — it curates
 * and writes on top of the deterministic draft: selects 10-12 brand colors
 * from the measured candidate pool into brand-adaptive named groups, labels
 * gradients, writes the kit's editorial layer (brand summary + per-section
 * titles/intros in the benchmark register), logo/typography rules, and the
 * voice & tone block derived from the site's actual copy.
 *
 * One structured-output call (forced tool use), Zod-validated per repo
 * convention — schemas coerce rather than reject, and deterministic guardrails
 * bound every curation decision (snap-to-pool, force-include, discard-if-thin).
 * Returns the deterministic fallback when ANTHROPIC_API_KEY is absent.
 */

/**
 * Models occasionally return a JSON-encoded string or a single string where
 * an array is expected. Coerce lenient rather than reject a good answer:
 * string → JSON.parse if it parses to an array, else newline-split.
 */
function coerceArray(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    const parsed: unknown = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to newline split
  }
  return v.split('\n').map((s) => s.replace(/^[-•\s]+/, '').trim()).filter(Boolean);
}

const stringList = (max: number) =>
  z.preprocess(coerceArray, z.array(z.string()).transform((a) => a.slice(0, max)).catch([]));

const EMPTY_SECTION = { title: '', intro: '', caption: '' };
const SectionCopySchema = z
  .object({
    title: z.string().catch(''),
    intro: z.string().catch(''),
    caption: z.string().catch(''),
  })
  .catch(EMPTY_SECTION);

const LlmResultSchema = z.object({
  brandSummary: z.string().catch(''),
  colorGroups: z.preprocess(
    coerceArray,
    z
      .array(
        z.object({
          title: z.string(),
          note: z.string().catch(''),
          colors: z.preprocess(
            coerceArray,
            z.array(z.object({ hex: z.string(), name: z.string(), usage: z.string() })).catch([])
          ),
        })
      )
      .catch([])
  ),
  gradientLabels: z.preprocess(
    coerceArray,
    z.array(z.object({ index: z.coerce.number().catch(-1), name: z.string(), usage: z.string() })).catch([])
  ),
  logoUsageRules: stringList(5),
  typographyRules: stringList(6),
  sections: z
    .object({
      logo: SectionCopySchema,
      color: SectionCopySchema,
      typography: SectionCopySchema,
      buttons: SectionCopySchema,
      voice: SectionCopySchema,
    })
    .catch({ logo: EMPTY_SECTION, color: EMPTY_SECTION, typography: EMPTY_SECTION, buttons: EMPTY_SECTION, voice: EMPTY_SECTION }),
  voice: z.object({
    summary: z.string().catch(''),
    pillars: stringList(5),
    descriptors: stringList(8),
    phrasesToUse: stringList(10),
    wordsToAvoid: stringList(10),
  }),
  voiceExtra: z.object({ title: z.string(), body: z.string() }).nullable().catch(null),
});

export type LlmResult = z.infer<typeof LlmResultSchema>;

/** Hand-written JSON schema for the forced tool call (mirrors LlmResultSchema). */
const SECTION_COPY_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, intro: { type: 'string' }, caption: { type: 'string' } },
  required: ['title', 'intro'],
};

const TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    brandSummary: {
      type: 'string',
      description: 'Kit-level brand personality paragraph, 2-3 sentences, editorial register.',
    },
    colorGroups: {
      type: 'array',
      description: '2-3 brand-adaptive groups curating 10-12 colors total from the candidate pool.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Group title in the brand\'s own terms, e.g. "Core palette", "Core neutrals".' },
          note: { type: 'string', description: 'Optional provenance/editorial note for the group.' },
          colors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { hex: { type: 'string' }, name: { type: 'string' }, usage: { type: 'string' } },
              required: ['hex', 'name', 'usage'],
            },
          },
        },
        required: ['title', 'colors'],
      },
    },
    gradientLabels: {
      type: 'array',
      description: 'Name + usage for the gradients worth keeping (by index into GRADIENT CANDIDATES). Omit noise.',
      items: {
        type: 'object',
        properties: { index: { type: 'number' }, name: { type: 'string' }, usage: { type: 'string' } },
        required: ['index', 'name', 'usage'],
      },
    },
    logoUsageRules: { type: 'array', items: { type: 'string' } },
    typographyRules: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'object',
      description: 'Editorial title + 1-2 sentence intro per kit section (benchmark register).',
      properties: {
        logo: SECTION_COPY_SCHEMA,
        color: SECTION_COPY_SCHEMA,
        typography: SECTION_COPY_SCHEMA,
        buttons: { ...SECTION_COPY_SCHEMA, description: 'caption = one-line usage rule shown under the buttons.' },
        voice: SECTION_COPY_SCHEMA,
      },
      required: ['logo', 'color', 'typography', 'buttons', 'voice'],
    },
    voice: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        pillars: { type: 'array', items: { type: 'string' } },
        descriptors: { type: 'array', items: { type: 'string' } },
        phrasesToUse: { type: 'array', items: { type: 'string' } },
        wordsToAvoid: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'pillars', 'descriptors', 'phrasesToUse', 'wordsToAvoid'],
    },
    voiceExtra: {
      type: ['object', 'null'],
      description: 'Optional brand-specific block (e.g. a safety or open-source stance) ONLY when the copy reveals a distinctive theme; else null.',
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['title', 'body'],
    },
  },
  required: ['brandSummary', 'colorGroups', 'gradientLabels', 'logoUsageRules', 'typographyRules', 'sections', 'voice', 'voiceExtra'],
};

export interface LabeledResult {
  colors: DeepColor[];
  colorGroups?: ColorGroup[];
  gradients: DeepGradient[];
  logoUsageRules: string[];
  typographyRules: string[];
  voice: BrandVoice | null;
  brandSummary?: string;
  sections?: Partial<Record<SectionKey, SectionCopy>>;
  voiceExtra?: { title: string; body: string } | null;
}

function normalizeHex(raw: string): string | null {
  let h = raw.trim().toLowerCase().replace(/^#?/, '');
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function sectionOrUndefined(s: { title: string; intro: string; caption: string }): SectionCopy | undefined {
  if (!s.title.trim() && !s.intro.trim() && !s.caption.trim()) return undefined;
  return {
    title: s.title.trim(),
    intro: s.intro.trim() || undefined,
    caption: s.caption.trim() || undefined,
  };
}

export async function runClaudePass(
  brandName: string,
  domain: string,
  draft: DeterministicDraft,
  copy: string
): Promise<LabeledResult> {
  const fallback: LabeledResult = {
    colors: draft.colors,
    gradients: draft.gradients.slice(0, 3),
    logoUsageRules: [],
    typographyRules: [],
    voice: null,
  };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const client = new Anthropic();
  // Compact one-line-per-candidate stats — the pool is the LLM's only allowed
  // color vocabulary, so it must see prominence signals without token bloat.
  const candidateLines = draft.colorCandidates
    .map(
      (c) =>
        `${c.hex} hint=${c.roleHint} bgArea=${c.bgArea} text=${c.textCount} onCta=${c.onCta} svg=${c.svgCount} lum=${c.luminance} sat=${c.saturation} src=${c.sources.join('+')}`
    )
    .join('\n');
  const draftForLlm = {
    gradientCandidates: draft.gradients.map((g, index) => ({ index, css: g.css, stops: g.stops })),
    typeScale: draft.typeScale,
    ctaSpecs: draft.ctaSpecs,
    fonts: { heading: draft.headingFamily, body: draft.bodyFamily, weights: draft.fontWeights },
  };

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4500,
      system:
        'You are a senior brand designer writing a benchmark-grade brand kit (in the editorial register of a professional brand book: assured, concise, prescriptive). ' +
        'You are given MEASURED design data extracted from a company website plus its real page copy. ' +
        'Never invent or alter measured values (hex codes, sizes, fonts) — you may only SELECT from the color candidate pool, name what you keep, assign usage rules, and write editorial copy. ' +
        'Curate 10-12 colors into 2-3 groups whose titles fit THIS brand (e.g. "Core palette" + "Atmospheric gradients" for a gradient-led brand; "Core neutrals" + "Content and accent palette" for a photography-led one). ' +
        'You MUST include the dominant canvas color, the ink color, and every color with onCta > 0; exclude noisy candidates (ad pixels, third-party chrome). ' +
        'Colors that appear only in third-party or partner logos (integration walls, press/customer logo strips — typically src=svg with no bg/text usage) are NOT brand colors: exclude them from the palette. ' +
        'Voice & tone must be derived from the provided copy: pillars reflect what the company actually emphasizes, phrasesToUse are terms they genuinely use, wordsToAvoid are terms that would clash with their positioning. ' +
        'Section intros are 1-2 sentences; titles are short editorial phrases ("The wordmark", "Set in <font>", "Calls to action", "How <brand> sounds"). ' +
        'Keep every rule to one short sentence. Every list field must be a JSON array of short strings — never a single concatenated string.',
      messages: [
        {
          role: 'user',
          content:
            `Brand: ${brandName} (${domain})\n\n` +
            `COLOR CANDIDATE POOL (the only hexes you may use):\n${candidateLines}\n\n` +
            `MEASURED DESIGN DATA:\n${JSON.stringify(draftForLlm, null, 1)}\n\n` +
            `SITE COPY:\n${copy}\n\n` +
            'Produce the full kit: brandSummary, curated colorGroups, gradientLabels (only the gradients worth keeping), ' +
            'logo usage rules, typography rules (casing, leading, restraint), per-section editorial copy, the voice & tone block, ' +
            'and voiceExtra only if the copy reveals a distinctive brand theme (safety, privacy, open source, ...).',
        },
      ],
      tools: [
        {
          name: 'submit_brand_kit',
          description: 'Submit the completed brand kit curation, labels, and guidelines.',
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_brand_kit' },
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return fallback;
    const parsed = LlmResultSchema.parse(toolUse.input);

    // ---- color curation with deterministic guardrails ----
    const poolHexes = draft.colorCandidates.map((c) => c.hex);
    const roleByHex = new Map(draft.colorCandidates.map((c) => [c.hex, c.roleHint]));
    const curated: DeepColor[] = [];
    const groups: ColorGroup[] = [];
    for (const g of parsed.colorGroups) {
      const hexes: string[] = [];
      for (const col of g.colors) {
        const normalized = normalizeHex(col.hex);
        if (!normalized) continue;
        // Snap to the measured pool; drop anything the LLM made up.
        const hex = poolHexes.includes(normalized) ? normalized : nearestHex(normalized, poolHexes, 16);
        if (!hex || curated.some((c) => c.hex === hex)) continue;
        curated.push({ hex, role: roleByHex.get(hex) ?? 'accent', name: col.name, usage: col.usage });
        hexes.push(hex);
      }
      if (hexes.length) groups.push({ title: g.title.trim() || 'Palette', note: g.note.trim() || undefined, hexes });
    }
    // Force-include the anchors the kit cannot function without.
    const mustHave = [
      ...draft.colorCandidates.filter((c) => c.roleHint === 'canvas' || c.roleHint === 'ink'),
      ...draft.colorCandidates.filter((c) => c.onCta > 0).slice(0, 3),
    ];
    if (groups.length > 0) {
      for (const c of mustHave) {
        if (!curated.some((k) => k.hex === c.hex)) {
          curated.push({ hex: c.hex, role: c.roleHint });
          groups[0]!.hexes.push(c.hex);
        }
      }
    }
    // Too thin to trust — ship the deterministic role palette instead.
    const curationOk = curated.length >= 5 && groups.length > 0;

    // ---- gradients: deterministic css/stops are authoritative; the LLM
    // contributes selection + naming by index ----
    const labeledGradients: DeepGradient[] = parsed.gradientLabels
      .filter((l) => l.index >= 0 && l.index < draft.gradients.length)
      .slice(0, 3)
      .map((l) => ({ ...draft.gradients[l.index]!, name: l.name, usage: l.usage }));
    const gradients = labeledGradients.length ? labeledGradients : draft.gradients.slice(0, 2);

    const sections: Partial<Record<SectionKey, SectionCopy>> = {};
    for (const key of ['logo', 'color', 'typography', 'buttons', 'voice'] as const) {
      const s = sectionOrUndefined(parsed.sections[key]);
      if (s) sections[key] = s;
    }

    return {
      colors: curationOk ? curated : draft.colors,
      colorGroups: curationOk ? groups : undefined,
      gradients,
      logoUsageRules: parsed.logoUsageRules,
      typographyRules: parsed.typographyRules,
      voice: parsed.voice,
      brandSummary: parsed.brandSummary.trim() || undefined,
      sections: Object.keys(sections).length ? sections : undefined,
      voiceExtra: parsed.voiceExtra,
    };
  } catch (err) {
    console.warn('Claude labeling pass failed; shipping deterministic draft only:', err);
    return fallback;
  }
}
