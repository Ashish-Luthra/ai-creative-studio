import {
  discoverUrls,
  fetchDisallows,
  fetchPage,
  isAllowed,
  politeDelay,
  sha1,
} from './content-crawl';
import { classifyPages, type ClassifiedPage, type PageForClassify } from './content-classify';
import { localizeFirstAvailable } from './content-image';
import { describeCrawlLimit, getCrawlGroupLimit } from './content-limits';
import { loadContentFile, markSynced, upsertItems } from './content-store';
import { CATEGORY_THUMBS, type ContentItem } from './content-types';

/**
 * Sync orchestrator: discover → (incrementally) fetch → classify → draft
 * items. Single sync at a time; in-memory progress powers the UI banner and
 * the Add-content dialog log. Playwright fallback for JS-rendered pages is
 * lazy-imported so the crawler stays cheap when not needed.
 */

export interface SyncState {
  running: boolean;
  domain: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  discovered: number;
  fetched: number;
  skippedUnchanged: number;
  classified: number;
  newItems: number;
  error: string | null;
  log: string[];
}

// globalThis-anchored so dev-server HMR (which re-instantiates modules) can't
// orphan a running sync's progress — same pattern as Next's singleton guides.
const globalStore = globalThis as unknown as { __contentSyncState?: SyncState };
const state: SyncState = (globalStore.__contentSyncState ??= {
  running: false,
  domain: null,
  startedAt: null,
  finishedAt: null,
  discovered: 0,
  fetched: 0,
  skippedUnchanged: 0,
  classified: 0,
  newItems: 0,
  error: null,
  log: [],
});

export function getSyncState(): SyncState {
  return { ...state, log: [...state.log] };
}

function log(line: string) {
  state.log.push(line);
  if (state.log.length > 25) state.log.shift();
}

function idFor(url: string): string {
  return `c_${sha1(url).slice(0, 12)}`;
}

/** Download the first workable candidate; null (→ colour stub) if none land. */
async function grabImage(
  candidates: string[],
  domain: string,
  itemId: string,
  pageUrl: string
): Promise<string | null> {
  if (candidates.length === 0) return null;
  return localizeFirstAvailable(candidates, domain, itemId, pageUrl);
}

export function startSync(domain: string, brandName: string): { started: boolean; reason?: string } {
  if (state.running) return { started: false, reason: 'A sync is already running' };
  Object.assign(state, {
    running: true,
    domain,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    discovered: 0,
    fetched: 0,
    skippedUnchanged: 0,
    classified: 0,
    newItems: 0,
    error: null,
    log: [],
  });
  // Fire and forget — progress observed via getSyncState().
  void runSync(domain, brandName)
    .catch((err) => {
      state.error = err instanceof Error ? err.message : String(err);
      log(`✗ sync failed: ${state.error}`);
    })
    .finally(() => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    });
  return { started: true };
}

async function classifyBatchWithRetry(
  brandName: string,
  domain: string,
  batch: PageForClassify[],
  attempts = 3
): Promise<ClassifiedPage[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await classifyPages(brandName, domain, batch);
    } catch (err) {
      if (attempt >= attempts) throw err;
      const delayMs = 2_000 * 2 ** (attempt - 1);
      log(`… classify attempt ${attempt} failed — retrying in ${delayMs / 1000}s`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function runSync(domain: string, brandName: string): Promise<void> {
  const existing = await loadContentFile(domain);
  const byUrl = new Map(existing.items.map((i) => [i.url, i]));

  const disallows = await fetchDisallows(domain);
  const pageLimit = getCrawlGroupLimit();
  log(`crawl budget: ${describeCrawlLimit(pageLimit)}`);
  const urls = await discoverUrls(domain, pageLimit, log);
  const allowed = urls.filter((u) => isAllowed(u.url, disallows));
  state.discovered = allowed.length;
  log(`${allowed.length} content urls after robots filter`);

  type ImageSignals = { ogImageUrl: string | null; heroImageUrls: string[] };
  const toClassify: Array<
    PageForClassify & { fullText: string; lastmod: string | null; hash: string } & ImageSignals
  > = [];
  // Unchanged pages that only need their picture filled in — deferred until
  // after the crawl so the site-wide-og:image check below can see every page.
  const toBackfill: Array<{ item: ContentItem; lastmod: string | null } & ImageSignals> = [];
  const ogCounts = new Map<string, number>();

  for (const { url, lastmod } of allowed) {
    const prior = byUrl.get(url);
    // Items stored before lead-image capture have no imageUrl. Let those
    // through the fetch so the picture can be backfilled — the content-hash
    // check below still short-circuits the (expensive) classify pass.
    const needsImage = Boolean(prior && !prior.imageUrl);
    // Incremental: skip when sitemap lastmod matches what we stored.
    if (prior && lastmod && prior.lastmod === lastmod && !needsImage) {
      state.skippedUnchanged++;
      continue;
    }

    let page = await fetchPage(url);
    state.fetched++;
    if (page?.thin) {
      // JS-rendered page — re-render with the shared Chromium.
      try {
        const { renderPageText } = await import('./extraction/render');
        const rendered = await renderPageText(url);
        if (rendered.text.length > page.text.length) {
          page = { ...page, title: page.title || rendered.title, text: rendered.text, thin: false };
          log(`⚡ rendered (JS page): ${new URL(url).pathname}`);
        }
      } catch {
        log(`! render fallback failed: ${new URL(url).pathname}`);
      }
    }
    if (!page || page.text.length < 80) {
      await politeDelay();
      continue;
    }

    if (page.ogImageUrl) ogCounts.set(page.ogImageUrl, (ogCounts.get(page.ogImageUrl) ?? 0) + 1);

    const hash = sha1(page.text);
    if (prior && prior.contentHash === hash) {
      state.skippedUnchanged++;
      // Copy unchanged, but the image may still be missing (item stored before
      // capture existed, or a download that failed last run). Queue it for a
      // picture-only update — no re-classify.
      toBackfill.push({
        item: prior,
        lastmod,
        ogImageUrl: page.ogImageUrl,
        heroImageUrls: page.heroImageUrls,
      });
      await politeDelay();
      continue;
    }

    toClassify.push({
      url,
      title: page.title,
      metaDescription: page.metaDescription,
      textSample: page.text.slice(0, 1_500),
      fullText: page.text.slice(0, 20_000),
      lastmod,
      hash,
      ogImageUrl: page.ogImageUrl,
      heroImageUrls: page.heroImageUrls,
    });
    log(`→ fetched ${new URL(url).pathname}`);
    await politeDelay();
  }

  // A social card reused across several pages is the site's generic default,
  // not that page's picture (Hightouch ships one meta.png on every non-blog
  // page). Those pages take their in-article hero instead.
  const GENERIC_OG_THRESHOLD = 3;
  const genericOg = new Set(
    [...ogCounts.entries()].filter(([, n]) => n >= GENERIC_OG_THRESHOLD).map(([url]) => url)
  );
  if (genericOg.size > 0) log(`ℹ ${genericOg.size} site-wide og:image(s) ignored — using in-article heroes`);

  // Ordered candidates, best first. A generic social card still trails the
  // in-article heroes rather than being dropped — one identical card beats no
  // picture when a page has nothing else usable.
  const pickImages = (s: ImageSignals): string[] => {
    const og = s.ogImageUrl;
    const ordered = og && !genericOg.has(og) ? [og, ...s.heroImageUrls] : [...s.heroImageUrls, ...(og ? [og] : [])];
    return [...new Set(ordered)];
  };

  // Picture-only updates for unchanged pages.
  let backfilled = 0;
  for (const { item, lastmod, ...signals } of toBackfill) {
    const imageUrl = item.imageUrl ?? (await grabImage(pickImages(signals), domain, item.id, item.url));
    if (item.lastmod !== lastmod || imageUrl !== item.imageUrl) {
      await upsertItems(domain, [{ ...item, lastmod, imageUrl }]);
      if (imageUrl && !item.imageUrl) backfilled++;
    }
  }
  if (backfilled > 0) log(`🖼 ${backfilled} image(s) backfilled on unchanged pages`);

  // Classify in batches of 10. A transient Claude timeout at the tail of a big
  // crawl must not kill the remaining batches: retry the batch, then skip it —
  // skipped pages were never upserted (no stored hash), so the next sync
  // re-fetches and classifies them.
  for (let i = 0; i < toClassify.length; i += 10) {
    const batch = toClassify.slice(i, i + 10);
    log(`✎ classifying ${batch.length} pages (Claude)…`);
    let classified: ClassifiedPage[];
    try {
      classified = await classifyBatchWithRetry(brandName, domain, batch);
    } catch (err) {
      log(`⚠ batch failed after retries (${err instanceof Error ? err.message : err}) — ${batch.length} pages deferred to next sync`);
      continue;
    }
    const now = new Date().toISOString();
    const items: ContentItem[] = [];
    for (const c of classified) {
      const src = batch.find((b) => b.url === c.url);
      const prior = byUrl.get(c.url);
      const id = prior?.id ?? idFor(c.url);
      const imageUrl = (await grabImage(src ? pickImages(src) : [], domain, id, c.url)) ?? prior?.imageUrl ?? null;
      items.push({
        id,
        url: c.url,
        title: c.title,
        description: c.description,
        category: c.category,
        referenceDescription: c.referenceDescription,
        tags: c.tags,
        status: 'draft',
        source: prior?.source ?? 'crawl',
        addedBy: 'Website ingest',
        thumb: CATEGORY_THUMBS[c.category],
        imageUrl,
        excerpt: (src?.fullText ?? '').slice(0, 1_200),
        fullText: src?.fullText ?? '',
        contentHash: src?.hash ?? '',
        lastmod: src?.lastmod ?? null,
        brainKoId: null,
        brainPushError: null,
        crawledAt: prior?.crawledAt ?? now,
        updatedAt: now,
      });
    }
    await upsertItems(domain, items);
    state.classified += items.length;
    state.newItems += items.filter((it) => !byUrl.has(it.url)).length;
    items.forEach((it) => log(`✓ ${new URL(it.url).pathname} — classified: ${it.category}`));
  }

  await markSynced(domain);
  log(`done — ${state.newItems} new, ${state.skippedUnchanged} unchanged skipped`);
}
