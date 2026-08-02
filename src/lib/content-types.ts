import { z } from 'zod';

/**
 * Content Engine item model. Items are acquired by the crawler (sitemap),
 * a manual URL add, or a file upload; enriched by a Claude classify/describe
 * pass; curated through draft → pending → approved → archived; approved items
 * are pushed to the Brain (knowledge objects in Neon) for retrieval-grade use.
 */

export const CONTENT_CATEGORIES = [
  'Blog',
  'Case study',
  'Whitepaper',
  'One-pager',
  'Pricing',
  'Docs',
  'Webpage',
  'PDF',
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CONTENT_STATUSES = ['draft', 'pending', 'approved', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentItem {
  id: string;
  url: string;
  title: string;
  /** One-line summary shown in the table. */
  description: string;
  category: ContentCategory;
  /**
   * The "when to use / when not to use" paragraph the SalesDemo Agent relies
   * on. AI-drafted at ingest, human-edited in the detail modal.
   */
  referenceDescription: string;
  tags: string[];
  status: ContentStatus;
  source: 'crawl' | 'url' | 'upload';
  addedBy: string;
  /** Category colour stub — the fallback when the page has no usable image. */
  thumb: { bg: string; label: string };
  /**
   * The page's own lead image (og:image or article hero), downloaded into
   * `public/content-images/` so it survives hotlink blocking and stays
   * same-origin for canvas export. null = none found, render `thumb`.
   */
  imageUrl: string | null;
  /** Short body extract for reviewer context (≤1200 chars). */
  excerpt: string;
  /** Fuller text for the Brain push (capped ~20k chars). */
  fullText: string;
  /** sha1 of extracted text — powers incremental re-sync when no lastmod. */
  contentHash: string;
  /** <lastmod> from the sitemap, when present. */
  lastmod: string | null;
  /** Knowledge-object id once pushed to the Brain; null = not pushed. */
  brainKoId: string | null;
  /** Last Brain push failure (soft-fail); cleared on success. */
  brainPushError: string | null;
  crawledAt: string;
  updatedAt: string;
}

export interface ContentStoreFile {
  domain: string;
  lastSyncAt: string | null;
  items: ContentItem[];
}

/** Coercing schema for PATCH bodies — never hard-reject partial edits. */
export const contentPatchSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(500).optional(),
    category: z.enum(CONTENT_CATEGORIES).optional(),
    referenceDescription: z.string().max(4000).optional(),
    tags: z.preprocess(
      (v) => (typeof v === 'string' ? v.split(',').map((t) => t.trim()).filter(Boolean) : v),
      z.array(z.string()).max(20).optional()
    ),
    status: z.enum(CONTENT_STATUSES).optional(),
  })
  .strip();
export type ContentPatch = z.infer<typeof contentPatchSchema>;

/** Category → thumbnail color/label (matches the mockup's pastel system). */
export const CATEGORY_THUMBS: Record<ContentCategory, { bg: string; label: string }> = {
  Blog: { bg: '#0e7490', label: 'BLOG' },
  'Case study': { bg: '#11a37e', label: 'CASE STUDY' },
  Whitepaper: { bg: '#166534', label: 'WHITEPAPER' },
  'One-pager': { bg: '#7c3aed', label: 'ONE-PAGER' },
  Pricing: { bg: '#334155', label: 'PRICING' },
  Docs: { bg: '#475569', label: 'DOCS' },
  Webpage: { bg: '#1d4ed8', label: 'WEBPAGE' },
  PDF: { bg: '#6d28d9', label: 'PDF' },
};
