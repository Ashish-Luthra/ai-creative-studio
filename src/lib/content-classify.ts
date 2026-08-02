import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { CONTENT_CATEGORIES, type ContentCategory } from './content-types';

/**
 * Claude classify/describe pass for crawled pages: one forced-tool-use call
 * per batch (~10 pages). Coercing Zod per monorepo convention — LLM output
 * shapes drift; never hard-reject.
 */

export interface PageForClassify {
  url: string;
  title: string;
  metaDescription: string;
  textSample: string; // first ~1500 chars
}

export interface ClassifiedPage {
  url: string;
  title: string;
  description: string;
  category: ContentCategory;
  referenceDescription: string;
  tags: string[];
}

const toArray = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const classifiedSchema = z.object({
  pages: z.preprocess(
    toArray,
    z.array(
      z
        .object({
          url: z.string().catch(''),
          title: z.string().max(300).catch(''),
          description: z.string().max(400).catch(''),
          category: z
            .preprocess(
              (v) => {
                const s = String(v ?? '').toLowerCase();
                const hit = CONTENT_CATEGORIES.find((c) => c.toLowerCase() === s);
                if (hit) return hit;
                if (/case/.test(s)) return 'Case study';
                if (/white/.test(s)) return 'Whitepaper';
                if (/blog|article|post/.test(s)) return 'Blog';
                if (/price|pricing/.test(s)) return 'Pricing';
                if (/doc/.test(s)) return 'Docs';
                return 'Webpage';
              },
              z.enum(CONTENT_CATEGORIES)
            )
            .catch('Webpage'),
          referenceDescription: z.string().max(2000).catch(''),
          tags: z.preprocess(toArray, z.array(z.string().max(60)).max(8)).catch([]),
        })
        .strip()
    )
  ),
});

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string', description: 'Clean human title (strip site suffixes like "| Hightouch")' },
          description: { type: 'string', description: 'One-line summary for a content table (≤160 chars)' },
          category: { type: 'string', enum: [...CONTENT_CATEGORIES] },
          referenceDescription: {
            type: 'string',
            description:
              'Paragraph telling a sales agent WHEN to use this content and when NOT to: audience, funnel stage, the objection or question it answers. 2-4 sentences.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Namespaced tags like page-type:blog, funnel-stage:decision, topic:security, industry:retail',
          },
        },
        required: ['url', 'title', 'description', 'category', 'referenceDescription', 'tags'],
      },
    },
  },
  required: ['pages'],
};

export async function classifyPages(
  brandName: string,
  domain: string,
  pages: PageForClassify[]
): Promise<ClassifiedPage[]> {
  if (pages.length === 0) return [];
  const client = new Anthropic();

  const response = await client.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-5',
    max_tokens: 4000,
    system:
      `You classify website content for ${brandName} (${domain}) into a sales-content library. ` +
      `For each page, write metadata a sales agent will rely on. referenceDescription is the most ` +
      `important field: state what the asset is, which prospects/funnel stage it suits, and when NOT ` +
      `to use it. Be concrete; ground everything in the provided text. Never invent facts.`,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(
          pages.map((p) => ({
            url: p.url,
            title: p.title,
            metaDescription: p.metaDescription,
            text: p.textSample,
          }))
        ),
      },
    ],
    tools: [
      {
        name: 'submit_classified_pages',
        description: 'Submit classification + reference metadata for every provided page.',
        input_schema: TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_classified_pages' },
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  const parsed = classifiedSchema.safeParse(toolUse && 'input' in toolUse ? toolUse.input : {});
  if (!parsed.success) return [];

  // Snap results back onto the input URLs; drop hallucinated ones.
  const byUrl = new Map(parsed.data.pages.map((p) => [p.url, p]));
  return pages.map((input) => {
    const out = byUrl.get(input.url);
    return {
      url: input.url,
      title: out?.title || input.title || input.url,
      description: out?.description || input.metaDescription || '',
      category: (out?.category ?? 'Webpage') as ContentCategory,
      referenceDescription: out?.referenceDescription || '',
      tags: out?.tags ?? [],
    };
  });
}
