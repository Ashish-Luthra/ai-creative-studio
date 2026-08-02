/**
 * Crawl limits by plan.
 *
 * Trial accounts ingest a capped sample of the site — enough to demo the
 * Content Engine without spending an hour crawling (and a small fortune
 * classifying) someone else's blog archive. Paid accounts are uncapped.
 *
 * Env-driven so the same build serves both: set `CONTENT_CRAWL_PAGE_LIMIT=0`
 * (or `unlimited`) on a paid deployment. Production path (ADR 0001): read the
 * limit from the tenant's plan row in Neon instead of the environment, so one
 * deployment can serve trial and paid tenants side by side.
 */

/**
 * Per-group crawl allowance. Groups are decided by URL path at DISCOVERY time,
 * not by the Claude-assigned category — the category is only known after a page
 * has been crawled and classified, so quota-ing on it would mean paying to
 * ingest pages we then discard. Close but not identical: a `/blog/...` URL can
 * still classify as a Case study.
 *
 * A flat total cap can't buy category diversity. On hightouch.com the buckets
 * are contiguous in priority order — case studies 1-55, blogs 56-120, pricing
 * 122-158 — so a flat cap had to exceed 158 before a single product page
 * appeared. Per-group reaches all three at a fraction of that.
 */
export const TRIAL_GROUP_PAGE_LIMIT = 75;
export const TRIAL_MANUAL_DOC_LIMIT = 25;

function readLimit(envValue: string | undefined, fallback: number): number {
  const raw = (envValue ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '0' || raw === 'unlimited' || raw === 'none') return Infinity;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** The three crawl groups a trial budgets separately. */
export type CrawlGroup = 'caseStudy' | 'blog' | 'webpage';

export const CRAWL_GROUP_LABELS: Record<CrawlGroup, string> = {
  caseStudy: 'case studies',
  blog: 'blog',
  webpage: 'webpages',
};

/** Pages per group one sync will ingest. Infinity = uncapped (paid). */
export function getCrawlGroupLimit(): number {
  return readLimit(process.env.CONTENT_CRAWL_GROUP_LIMIT, TRIAL_GROUP_PAGE_LIMIT);
}

/**
 * Documents a client may add by hand — uploads (decks, PDFs, notes) and
 * one-off URLs. A separate budget from the crawl on purpose: hand-picked
 * collateral is the highest-signal content in the corpus, so a big site
 * crawl must never consume the allowance for it.
 */
export function getManualDocLimit(): number {
  return readLimit(process.env.CONTENT_MANUAL_DOC_LIMIT, TRIAL_MANUAL_DOC_LIMIT);
}

/** Human-readable form for the sync log / UI. */
export function describeCrawlLimit(limit: number): string {
  if (limit === Infinity) return 'unlimited (paid plan)';
  // Only the default is the trial cap; a configured number is just a setting.
  const tier = limit === TRIAL_GROUP_PAGE_LIMIT ? 'trial cap' : 'configured';
  return `${limit} pages each for case studies / blog / webpages (${tier})`;
}

/** Manual-add quota check. `remaining` is Infinity on a paid plan. */
export function manualDocQuota(currentCount: number): { limit: number; remaining: number; exceeded: boolean } {
  const limit = getManualDocLimit();
  const remaining = Math.max(0, limit - currentCount);
  return { limit, remaining, exceeded: currentCount >= limit };
}
