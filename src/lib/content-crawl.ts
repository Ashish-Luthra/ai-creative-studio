import { createHash } from 'crypto';
import type { CrawlGroup } from './content-limits';

/**
 * Content Engine acquisition layer: sitemap discovery (with lastmod),
 * robots.txt respect, polite sequential page fetch, and HTML→text extraction.
 * JS-rendered pages fall back to Playwright via renderPageText (caller wires
 * that in to keep this module dependency-light).
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AllyvateContentEngine/1.0';

export interface DiscoveredUrl {
  url: string;
  lastmod: string | null;
}

export interface ExtractedPage {
  title: string;
  metaDescription: string;
  text: string;
  thin: boolean; // true → candidate for Playwright fallback
  /** Best single pick: og:image, else the first in-article hero. */
  imageUrl: string | null;
  /**
   * Raw signals, kept apart so a crawl can spot a site-wide og:image. Many
   * sites (Hightouch, getjust.ai) ship one generic social card on every
   * page; using it everywhere is just a different stub.
   */
  ogImageUrl: string | null;
  /**
   * Several in-article candidates, best first — not one. Any single candidate
   * can fail (a CDN 403, a 10MB original above the size cap, an HTML error
   * page), and one failure should cost a fallback, not the whole image.
   */
  heroImageUrls: string[];
}

export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Minimal robots.txt: Disallow rules for User-agent: * (prefix match). */
export async function fetchDisallows(domain: string): Promise<string[]> {
  const txt = await fetchText(`https://${domain}/robots.txt`, 6_000);
  if (!txt) return [];
  const out: string[] = [];
  let applies = false;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const [keyRaw, ...rest] = line.split(':');
    if (!rest.length) continue;
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') applies = value === '*';
    else if (applies && key === 'disallow' && value) out.push(value);
  }
  return out;
}

export function isAllowed(url: string, disallows: string[]): boolean {
  try {
    const { pathname } = new URL(url);
    return !disallows.some((rule) => pathname.startsWith(rule));
  } catch {
    return false;
  }
}

/** Paths that carry sales-relevant content; everything else is skipped. */
const CONTENT_PATH = /\/(blog|customers?|case-stud|resources?|guides?|whitepapers?|docs?|pricing|product|platform|solutions?|about|compare)([/.-]|$)/i;
const SKIP_PATH = /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?|mp4|xml)(\?|$)|\/(tag|tags|author|page)\//i;

function parseSitemapXml(xml: string): { locs: DiscoveredUrl[]; childSitemaps: string[] } {
  const childSitemaps: string[] = [];
  const locs: DiscoveredUrl[] = [];
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const entryRe = /<(?:url|sitemap)[\s>]([\s\S]*?)<\/(?:url|sitemap)>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(block)?.[1] ?? null;
    if (isIndex) childSitemaps.push(loc.trim());
    else locs.push({ url: loc.trim(), lastmod });
  }
  return { locs, childSitemaps };
}

/**
 * Which trial budget a URL draws from, decided by path. `webpage` is the
 * catch-all: product/platform pages plus pricing, docs and resources.
 */
export function crawlGroupFor(url: string): CrawlGroup {
  const p = new URL(url).pathname;
  if (/\/(customers?|case-stud)/i.test(p)) return 'caseStudy';
  if (/\/blog/i.test(p)) return 'blog';
  return 'webpage';
}

/**
 * Discover content URLs for a domain: sitemap.xml (one level of sitemap
 * index), else homepage links. Filtered to content paths, deduped, then capped
 * PER GROUP so one prolific section can't crowd out the others.
 */
export async function discoverUrls(
  domain: string,
  groupCap = 75,
  log?: (line: string) => void
): Promise<DiscoveredUrl[]> {
  // Ceiling for the sitemap-walk early exit only; the real limit is per group.
  const cap = Number.isFinite(groupCap) ? groupCap * 3 : 1_000;
  const seen = new Map<string, DiscoveredUrl>();
  const add = (d: DiscoveredUrl) => {
    try {
      const u = new URL(d.url);
      if (u.hostname.replace(/^www\./, '') !== domain.replace(/^www\./, '')) return;
      if (SKIP_PATH.test(u.pathname)) return;
      const key = `${u.origin}${u.pathname}`.replace(/\/$/, '');
      if (!seen.has(key)) seen.set(key, { url: key, lastmod: d.lastmod });
    } catch {
      /* invalid URL — skip */
    }
  };

  const sitemapXml = await fetchText(`https://${domain}/sitemap.xml`);
  if (sitemapXml) {
    const { locs, childSitemaps } = parseSitemapXml(sitemapXml);
    locs.forEach(add);
    log?.(`sitemap.xml found — ${locs.length} urls, ${childSitemaps.length} child sitemaps`);
    for (const child of childSitemaps.slice(0, 10)) {
      const childXml = await fetchText(child);
      if (childXml) parseSitemapXml(childXml).locs.forEach(add);
      if (seen.size > cap * 4) break;
    }
  } else {
    log?.('no sitemap.xml — falling back to homepage links');
    const html = await fetchText(`https://${domain}/`);
    if (html) {
      const hrefRe = /href=["']([^"'#?]+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = hrefRe.exec(html)) !== null) {
        const href = m[1];
        const abs = href.startsWith('http') ? href : `https://${domain}${href.startsWith('/') ? '' : '/'}${href}`;
        add({ url: abs, lastmod: null });
      }
    }
  }

  const all = [...seen.values()];
  const content = all.filter((d) => CONTENT_PATH.test(new URL(d.url).pathname));
  const picked = content.length > 0 ? content : all;
  // Sales-usefulness priority so the cap doesn't drown case studies/blogs in
  // product landing pages (sitemaps usually list those first).
  const priority = (d: DiscoveredUrl): number => {
    const p = new URL(d.url).pathname;
    if (/\/(customers?|case-stud)/i.test(p)) return 0;
    if (/\/blog/i.test(p)) return 1;
    if (/\/(resources?|guides?|whitepapers?)/i.test(p)) return 2;
    if (/\/(pricing|compare)/i.test(p)) return 3;
    if (/\/docs?/i.test(p)) return 4;
    return 5;
  };
  const ordered = picked
    .map((d, i) => ({ d, i }))
    .sort((a, b) => priority(a.d) - priority(b.d) || a.i - b.i)
    .map(({ d }) => d);

  // Per-group budgets, filled in priority order. Under a flat cap the groups
  // are contiguous, so a prolific blog could consume the entire allowance
  // before a single product page was reached.
  const taken: Record<CrawlGroup, number> = { caseStudy: 0, blog: 0, webpage: 0 };
  const out = ordered.filter((d) => {
    const group = crawlGroupFor(d.url);
    if (taken[group] >= groupCap) return false;
    taken[group] += 1;
    return true;
  });
  log?.(
    `budget used — case studies ${taken.caseStudy}, blog ${taken.blog}, webpages ${taken.webpage}` +
      (Number.isFinite(groupCap) ? ` (max ${groupCap} each)` : '')
  );
  return out;
}

/**
 * Lead image for a page, in descending order of trust:
 * og:image (what the publisher chose for social cards) → twitter:image →
 * link rel=image_src → the first in-article <img> that isn't obvious chrome.
 *
 * Tracking pixels, spacers, icons and inline SVG data URIs are excluded — a
 * 1×1 beacon as a card thumbnail is worse than the coloured stub.
 */
function absolutise(src: string | undefined, baseUrl?: string): string | null {
  if (!src) return null;
  try {
    const abs = new URL(decodeEntities(src), baseUrl ?? undefined).toString();
    // Next.js image proxy (`/_next/image?url=…`) wraps the real CDN asset at a
    // capped width — unwrap it and take the original.
    const proxied = /\/_next\/image\?.*\burl=([^&]+)/i.exec(abs)?.[1];
    return proxied ? new URL(decodeURIComponent(proxied), baseUrl ?? undefined).toString() : abs;
  } catch {
    return null;
  }
}

function extractOgImage(html: string, baseUrl?: string): string | null {
  const meta = (re: RegExp) => re.exec(html)?.[1];
  const found = [
    meta(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i),
    meta(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i),
    meta(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i),
    meta(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i),
  ].find(Boolean);
  return absolutise(found, baseUrl);
}

/**
 * First real picture inside the article body. Chrome — logos, avatars,
 * badges, tracking pixels, inline SVG — is excluded; a 1×1 beacon as a
 * thumbnail is worse than the colour stub.
 */
function extractHeroImages(html: string, baseUrl?: string, max = 5): string[] {
  const body = /<(main|article)[\s>][\s\S]*?<\/\1>/i.exec(html)?.[0] ?? html;
  const imgRe = /<img[^>]+>/gi;
  const out: string[] = [];
  let tag: RegExpExecArray | null;
  while ((tag = imgRe.exec(body)) !== null && out.length < max) {
    const src =
      /\ssrc=["']([^"']+)["']/i.exec(tag[0])?.[1] ??
      // Lazy-loaded images keep the real file in data-src / srcset.
      /\sdata-src=["']([^"']+)["']/i.exec(tag[0])?.[1] ??
      /\ssrcset=["']([^"'\s,]+)/i.exec(tag[0])?.[1];
    if (!src || src.startsWith('data:')) continue;
    if (/(logo|icon|avatar|badge|sprite|pixel|spacer|1x1|blank)/i.test(src)) continue;
    if (/\.svg(\?|$)/i.test(src)) continue;
    const abs = absolutise(src, baseUrl);
    if (abs && !out.includes(abs)) out.push(abs);
  }
  return out;
}

/** Strip an HTML document to readable text + title/description. */
export function extractFromHtml(html: string, baseUrl?: string): ExtractedPage {
  const title =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ??
    '';
  const metaDescription =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    '';

  let body = html;
  const main = /<(main|article)[\s>][\s\S]*?<\/\1>/i.exec(html)?.[0];
  if (main && main.length > 800) body = main;
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|header|footer)[\s>][\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|#160);/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;|&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40_000);

  const ogImageUrl = extractOgImage(html, baseUrl);
  const heroImageUrls = extractHeroImages(html, baseUrl);
  return {
    title: decodeEntities(title),
    metaDescription: decodeEntities(metaDescription),
    text,
    thin: text.length < 400,
    imageUrl: ogImageUrl ?? heroImageUrls[0] ?? null,
    ogImageUrl,
    heroImageUrls,
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&(nbsp|#160);/g, ' ')
    .trim();
}

export async function fetchPage(url: string): Promise<ExtractedPage | null> {
  const html = await fetchText(url);
  if (!html) return null;
  return extractFromHtml(html, url);
}

export const politeDelay = (ms = 1_000) => new Promise((r) => setTimeout(r, ms));
