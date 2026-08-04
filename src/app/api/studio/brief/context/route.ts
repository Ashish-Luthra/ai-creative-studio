import { NextResponse } from 'next/server';
import { listKits, loadKitForDomain } from '../../../../../lib/brand-kit-store';
import { loadContentFile, listItems } from '../../../../../lib/content-store';
import { resolveDomain } from '../../../../../lib/content-domain';
import { detectVertical, VERTICAL_LABELS } from '../../../../../lib/vertical-detect';
import type { ContentItem, ContentStatus } from '../../../../../lib/content-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/studio/brief/context?domain=
 *
 * Everything the qualifying flow needs before it can render its first card:
 * the detected vertical (with its reasoning), the canonical domain for the
 * client to echo back on POST, live customer-story options, and whether any
 * photography exists at all.
 *
 * One round trip, and all the `fs` work stays on the server — the alternative
 * was shipping a 198-item corpus to the browser to pick five options out of it.
 */

interface StoryOption {
  id: string;
  label: string;
  hint: string;
  status: ContentStatus;
}

/** A metric in the title/description makes a far better ad than a bare name. */
function extractMetric(item: ContentItem): string | null {
  const haystack = `${item.title} ${item.description ?? ''} ${item.referenceDescription ?? ''}`;
  const match = /(\d+(?:\.\d+)?\s?(?:x|%|×)|\d+(?:,\d{3})+|\$\d[\d,.]*[kmb]?)/i.exec(haystack);
  return match ? match[1] : null;
}

function toStoryOption(item: ContentItem): StoryOption {
  const metric = extractMetric(item);
  return {
    id: item.id,
    label: metric ? `${item.title} — ${metric}` : item.title,
    hint: (item.referenceDescription ?? item.description ?? '').slice(0, 120),
    status: item.status,
  };
}

/**
 * Approved-only would ship an empty list for most tenants — the corpus we have
 * on disk is 5 approved of 198 for one domain and 0 of 28 for the other. Widen
 * until something is found, and tag each option with its status so the card can
 * say so.
 */
async function storyOptions(domain: string | null): Promise<StoryOption[]> {
  if (!domain) return [];
  const preferredCategories = new Set(['Case study', 'One-pager', 'Whitepaper']);
  for (const status of ['approved', 'pending', undefined] as const) {
    const items = await listItems(domain, status);
    const stories = items.filter((i) => preferredCategories.has(i.category));
    const pool = stories.length > 0 ? stories : items;
    if (pool.length > 0) return pool.slice(0, 6).map(toStoryOption);
  }
  return [];
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('domain');
  const domain = await resolveDomain(requested);

  // Same rule as the brief route: never borrow another tenant's kit for a known
  // domain. A domain with no kit detects from its corpus instead.
  const kit = (await loadKitForDomain(domain)) ?? (domain ? null : (await listKits())[0] ?? null);

  // Detection reads tags across ALL statuses — approved alone is far too thin
  // to be a signal.
  const allTags = domain ? (await loadContentFile(domain)).items.flatMap((i) => i.tags ?? []) : [];

  const detection = detectVertical({
    brandSummary: kit?.deep?.brandSummary ?? null,
    voice: kit?.deep?.voice ?? null,
    kitName: kit?.name ?? null,
    domain: kit?.domain ?? domain,
    tags: allTags,
  });

  const ctaLabels = (kit?.deep?.ctaSpecs ?? []).map((c) => c.label).filter(Boolean);

  return NextResponse.json({
    domain,
    brand: { name: kit?.name ?? null, hasKit: Boolean(kit), ctaLabels },
    vertical: {
      value: detection.vertical,
      label: VERTICAL_LABELS[detection.vertical],
      confidence: detection.confidence,
      source: detection.source,
      reasons: detection.reasons,
    },
    storyOptions: await storyOptions(domain),
  });
}
