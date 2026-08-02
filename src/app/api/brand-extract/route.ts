import { NextResponse } from 'next/server';

/**
 * Real brand-kit extraction from a live website (lightweight, dependency-free).
 *
 * GET /api/brand-extract?domain=stripe.com
 *
 * Server-side so cross-origin fetches are allowed. Strategy:
 *  - fetch https://<domain> homepage HTML
 *  - name        <- og:site_name, else <title> (first segment)
 *  - snapshotUrl <- og:image
 *  - logoUrl     <- <img> whose src/class/alt mentions "logo", else
 *                   apple-touch-icon, else favicon link
 *  - palette     <- hex colors mined from inline CSS + first linked stylesheets,
 *                   ranked by frequency (greys/near-white/black filtered);
 *                   theme-color meta pinned first when present
 *  - typography  <- font families from Google Fonts links + font-family
 *                   declarations (generic families filtered)
 *
 * This is the demo-grade stand-in for the marketingos BrandExtractionOrchestrator;
 * the response shape matches BrandKitBoardData so the UI swaps to the real
 * backend by changing only this URL.
 */

const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  'arial', 'helvetica', 'helvetica neue', 'times', 'times new roman', 'courier', 'courier new',
  'inherit', 'initial', 'unset', 'var', 'georgia', 'segoe ui', 'roboto flex', '-apple-system',
  'blinkmacsystemfont', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji',
]);

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AllyvateBrandBot/0.1',
  Accept: 'text/html,application/xhtml+xml,text/css,*/*',
};

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function absolutize(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    // Attribute values come out of raw HTML — decode the common entities.
    const decoded = url.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
    return new URL(decoded, base).toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/** hex -> {r,g,b}; supports #abc and #aabbcc. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Filter boring colors: near-white, near-black, low-saturation greys. */
function isBrandworthy(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
  if (lightness > 245 || lightness < 12) return false; // near white/black
  if (saturation < 0.12) return false; // grey
  return true;
}

/** Perceptually-near dedupe so #2563EB and #2564EC don't both make the palette. */
function dedupeColors(hexes: string[]): string[] {
  const kept: string[] = [];
  for (const hex of hexes) {
    const rgb = parseHex(hex);
    if (!rgb) continue;
    const near = kept.some((k) => {
      const o = parseHex(k)!;
      return Math.abs(o.r - rgb.r) + Math.abs(o.g - rgb.g) + Math.abs(o.b - rgb.b) < 60;
    });
    if (!near) kept.push(hex);
  }
  return kept;
}

function extractColors(cssAndHtml: string, themeColor: string | null): string[] {
  const counts = new Map<string, number>();
  for (const m of cssAndHtml.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    let hex = m[0].toLowerCase();
    if (hex.length === 4) hex = '#' + hex.slice(1).split('').map((c) => c + c).join('');
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .filter(([hex]) => isBrandworthy(hex))
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
  const pinned = themeColor && isBrandworthy(themeColor.toLowerCase()) ? [themeColor.toLowerCase()] : [];
  const palette = dedupeColors([...pinned, ...ranked]).slice(0, 6);
  // Pad with tasteful neutrals so boards always render a 6-swatch palette.
  const pad = ['#1f2937', '#eef2ff', '#f3f4f6'];
  while (palette.length < 6 && pad.length) palette.push(pad.shift()!);
  return palette;
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

function extractFonts(html: string, css: string): string[] {
  const found: string[] = [];
  const push = (raw: string) => {
    const family = raw.replace(/['"+]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!family) return;
    if (GENERIC_FONTS.has(family.toLowerCase())) return;
    if (/icon|emoji|awesome|glyph|symbol/i.test(family)) return; // icon fonts aren't typography
    if (!/^[a-z0-9 \-]{3,32}$/i.test(family)) return;
    const cased = titleCase(family);
    if (!found.includes(cased)) found.push(cased);
  };
  // Google Fonts <link> families come first — they're deliberate brand choices.
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?[^"']*/g)) {
    for (const fm of m[0].matchAll(/family=([^&:"']+)/g)) push(decodeURIComponent(fm[1]));
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}"']+)/g)) {
    const first = m[1].split(',')[0];
    if (first) push(first);
  }
  return found;
}

/** schema.org JSON-LD Organization/WebSite "logo" — the most explicit signal a site can give. */
function extractJsonLdLogo(html: string, base: string): string | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(m[1]);
      const graph = (data as { '@graph'?: unknown[] })?.['@graph'];
      const nodes = [
        ...(Array.isArray(data) ? data : [data]),
        ...(Array.isArray(graph) ? graph : []),
      ] as Array<{ '@type'?: unknown; logo?: unknown; publisher?: { logo?: unknown } }>;
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        if (!/organization|website|brand|corporation/i.test(String(node['@type'] ?? ''))) continue;
        const logo = node.logo ?? node.publisher?.logo;
        const url = typeof logo === 'string' ? logo : (logo as { url?: string } | undefined)?.url;
        if (url) return absolutize(String(url), base);
      }
    } catch {
      // Malformed JSON-LD is common in the wild; keep scanning.
    }
  }
  return null;
}

/** True when the svg markup can render standalone (has real shapes, no external <use> refs). */
function isRenderableSvg(svg: string): boolean {
  return svg.length < 20000 && /<path|<circle|<rect|<polygon|<ellipse/i.test(svg);
}

/**
 * Inline-HTML SVGs usually omit xmlns (legal in HTML, fatal in a standalone
 * data-URI image) — inject it before serializing.
 */
function svgToDataUri(svg: string): string {
  const withNs = /xmlns=/.test(svg)
    ? svg
    : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(withNs);
}

/**
 * The site's own logo almost always lives in the <header>/<nav> inside the
 * link back to "/". Handles both <img> logos and inline-SVG logos (returned
 * as a data URI, since there's no file to hotlink).
 */
function extractHeaderLogo(html: string, base: string): string | null {
  // Generous bound: emotion/chakra sites inline styles, making headers huge
  // (hightouch.com's header is ~150k chars).
  const header = /<header[\s\S]{0,200000}?<\/header>/i.exec(html)?.[0] ?? /<nav[\s\S]{0,200000}?<\/nav>/i.exec(html)?.[0];
  if (!header) return null;
  for (const a of header.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      if (new URL(a[1], base).pathname !== '/') continue; // only the home link
    } catch {
      continue;
    }
    // Within the home link: a labeled <img> beats an inline svg, which beats
    // decorative imgs (aria-hidden / empty alt are backgrounds, not logos).
    const imgs = [...a[2].matchAll(/<img\b[^>]*>/gi)]
      .map((t) => t[0])
      .filter((t) => !/aria-hidden=["']true["']/i.test(t));
    const labeled = imgs.find((t) => /alt=["'][^"']+["']/i.test(t));
    const labeledSrc = labeled ? /src=["']([^"']+)["']/i.exec(labeled)?.[1] : null;
    if (labeledSrc) return absolutize(labeledSrc, base);
    const svg = /<svg[\s\S]*?<\/svg>/i.exec(a[2])?.[0];
    if (svg && isRenderableSvg(svg)) return svgToDataUri(svg);
    const anySrc = imgs[0] ? /src=["']([^"']+)["']/i.exec(imgs[0])?.[1] : null;
    if (anySrc) return absolutize(anySrc, base);
  }
  const svg = /<svg[\s\S]*?<\/svg>/i.exec(header)?.[0];
  if (svg && isRenderableSvg(svg)) return svgToDataUri(svg);
  return null;
}

/**
 * Google's favicon service — always-on fallback that serves a site's real
 * icon at 128px. (Clearbit's logo API, the old go-to, is discontinued.)
 */
async function faviconServiceLogo(domain: string): Promise<string | null> {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

async function extractLogo(html: string, base: string, domain: string): Promise<string | null> {
  // Ordered from most to least trustworthy. Class/alt matches rank last-ish
  // because customer-logo walls ("<img alt='Spotify logo'>") poison them.
  const explicit =
    extractJsonLdLogo(html, base) ??
    metaContent(html, [
      /<meta[^>]+property=["']og:logo["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']logo["'][^>]+content=["']([^"']+)["']/i,
    ]);
  if (explicit) return absolutize(explicit, base);

  const headerLogo = extractHeaderLogo(html, base);
  if (headerLogo) return headerLogo;

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /src=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (src && /logo/i.test(src) && !/sprite/i.test(src)) return absolutize(src, base);
  }

  const touch = /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i.exec(html)?.[1];
  if (touch) return absolutize(touch, base);

  const serviceIcon = await faviconServiceLogo(domain);
  if (serviceIcon) return serviceIcon;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = /src=["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && !/sprite/i.test(src)) return absolutize(src, base);
  }
  const icon = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i.exec(html)?.[1];
  return absolutize(icon ?? '/favicon.ico', base);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('domain') ?? '').trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain || !domain.includes('.')) {
    return NextResponse.json({ error: 'Provide ?domain=yourbrand.com' }, { status: 400 });
  }
  const base = `https://${domain}/`;

  let html: string;
  try {
    html = await fetchText(base);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not fetch ${base}: ${e instanceof Error ? e.message : 'unknown error'}` },
      { status: 502 }
    );
  }

  // Pull up to 3 same-ish-origin stylesheets to mine colors and fonts.
  const sheetUrls = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["']/gi)]
    .map((m) => absolutize(m[1] ?? m[2], base))
    .filter((u): u is string => !!u)
    .slice(0, 3);
  const sheets = await Promise.allSettled(sheetUrls.map((u) => fetchText(u, 5000)));
  const css = sheets.map((s) => (s.status === 'fulfilled' ? s.value : '')).join('\n');
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const allCss = inlineCss + '\n' + css;

  const siteName = metaContent(html, [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
  ]);
  const rawTitle = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
  // Titles look like "Home \ Anthropic" or "Stripe | Payments" — take the
  // segment that isn't a generic page word.
  const title = rawTitle
    ?.split(/[|\-–—·:\\/]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(home|homepage|welcome|index)$/i.test(s))[0] ?? null;
  const themeColor = metaContent(html, [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,6})["']/i,
    /<meta[^>]+content=["'](#[0-9a-fA-F]{3,6})["'][^>]+name=["']theme-color["']/i,
  ]);
  const ogImage = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);

  const fonts = extractFonts(html, allCss);
  const name = siteName ?? title ?? titleCase(domain.split('.')[0] ?? domain);
  const logoUrl = await extractLogo(html, base, domain);

  // Wordmark detection: wide svg viewBoxes (e.g. 300×55) are full wordmarks
  // and should render at natural width instead of a square logo slot.
  let logoAspect: number | null = null;
  if (logoUrl?.startsWith('data:image/svg+xml')) {
    const vb = /viewBox=["']([\d.\s-]+)["']/.exec(decodeURIComponent(logoUrl));
    const p = vb?.[1].trim().split(/\s+/).map(Number);
    if (p?.length === 4 && p[3]! > 0) logoAspect = p[2]! / p[3]!;
  }

  // Real mobile-viewport screenshot via thum.io (keyless). First request only
  // queues the render, so warm it server-side until a real image comes back —
  // the board then shows the finished screenshot immediately.
  const snapshotUrl = `https://image.thum.io/get/allowJPG/width/390/crop/844/viewportWidth/390/${base}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(snapshotUrl, { signal: AbortSignal.timeout(8000) });
      if (res.headers.get('content-type')?.includes('jpeg')) break; // rendered (queued state is a gif)
    } catch {
      break; // service unreachable — client falls back to og:image
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  return NextResponse.json({
    id: `bk_${domain}`,
    name,
    domain,
    logoUrl,
    logoAspect,
    snapshotUrl,
    ogImageUrl: absolutize(ogImage, base),
    palette: extractColors(allCss + '\n' + html, themeColor),
    typography: {
      heading: { family: fonts[0] ?? 'Poppins', weight: 700 },
      body: { family: fonts[1] ?? fonts[0] ?? 'Inter', weight: 400 },
    },
  });
}
