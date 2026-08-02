import { chromium, type Browser, type Page } from 'playwright';

/**
 * Playwright render layer for deep brand extraction.
 *
 * Renders the target site once per color scheme (light/dark) to capture logo
 * variants, reads computed styles for the type scale and CTA geometry, tallies
 * color usage by on-screen area, scrapes copy for the voice pass, and takes
 * mobile + desktop screenshots. Runs inside the Next dev server process
 * (long-lived, local-only) with a shared Chromium instance.
 */

export interface ComputedTypeEntry {
  selector: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  color: string;
  /** Element text — real site copy used as the specimen for this level. */
  text: string;
  /** On-screen area in px² — prominence signal (hero headline > footer h2). */
  area: number;
}

export interface ButtonSample {
  tag: string;
  text: string;
  backgroundColor: string;
  backgroundImage: string;
  color: string;
  borderRadius: string;
  border: string;
  fontSize: string;
  fontWeight: string;
  paddingX: number;
  height: number;
}

export interface LogoCapture {
  scheme: 'light' | 'dark';
  location: 'header' | 'footer';
  src: string | null;
  inlineSvg: string | null;
}

export interface ColorUsage {
  /** CSS color string → aggregate stats from a DOM walk. */
  [color: string]: { bgArea: number; bgCount: number; textCount: number; onCta: number; svgCount: number };
}

export interface StyleSheetText {
  /** Sheet URL (null for inline <style> / same-origin constructed sheets). */
  href: string | null;
  text: string;
}

export interface RenderResult {
  finalUrl: string;
  title: string;
  metaDescription: string;
  html: string;
  cssText: string;
  /** Per-sheet CSS with provenance — needed to resolve relative @font-face URLs. */
  styleSheets: StyleSheetText[];
  customProps: Record<string, string>;
  typeEntries: ComputedTypeEntry[];
  buttons: ButtonSample[];
  colorUsage: ColorUsage;
  /** Computed background-image gradient CSS → painted on-screen area (px²). */
  gradientUsage: Record<string, number>;
  copy: string;
  logos: LogoCapture[];
  googleFontLinks: string[];
  mobileShot: Buffer;
  desktopShot: Buffer;
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/**
 * Light single-page text scrape for the Content Engine's JS-rendered-page
 * fallback. Reuses the singleton Chromium; far cheaper than renderSite (no
 * dual-scheme pass, no screenshots). Returns rendered title + main text.
 */
export async function renderPageText(url: string): Promise<{ title: string; text: string }> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForTimeout(1_200);
    return await page.evaluate(() => {
      const root =
        document.querySelector('main') ?? document.querySelector('article') ?? document.body;
      const clone = root.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('script,style,noscript,svg,nav,header,footer')
        .forEach((el) => el.remove());
      return {
        title: document.title ?? '',
        text: (clone.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 40_000),
      };
    });
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Runs in the page: everything we need from the rendered DOM in one pass. */
function inPageExtraction() {
  const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

  // --- computed type entries (multi-candidate per level; postprocess picks modal) ---
  const visibleWithText = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (e.textContent ?? '').trim().length > 0;
  };
  const entryOf = (selector: string, el: HTMLElement) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selector,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      color: cs.color,
      text: cap((el.textContent ?? '').trim().replace(/\s+/g, ' '), 120),
      area: Math.round(r.width * r.height),
    };
  };
  const typeEntries: ReturnType<typeof entryOf>[] = [];
  for (const selector of ['h1', 'h2', 'h3', 'h4']) {
    for (const el of [...document.querySelectorAll<HTMLElement>(selector)].filter(visibleWithText).slice(0, 8)) {
      typeEntries.push(entryOf(selector, el));
    }
  }
  // Body: the 5 largest visible paragraphs (footer legalese loses to real copy).
  const paragraphs = [...document.querySelectorAll<HTMLElement>('p')]
    .filter(visibleWithText)
    .map((el) => ({ el, area: el.getBoundingClientRect().width * el.getBoundingClientRect().height }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 5);
  for (const { el } of paragraphs) typeEntries.push(entryOf('p', el));
  for (const selector of ['body', 'a', 'button', 'small']) {
    const el = [...document.querySelectorAll<HTMLElement>(selector)].find(visibleWithText);
    if (el) typeEntries.push(entryOf(selector, el));
  }
  // Overline candidates: eyebrow/label classes, or small uppercase tracked text
  // outside nav (category labels above headings).
  const overlineEls = new Set<HTMLElement>([
    ...document.querySelectorAll<HTMLElement>('[class*="eyebrow" i], [class*="overline" i], [class*="kicker" i]'),
  ]);
  for (const el of document.querySelectorAll<HTMLElement>('span, div, p, small')) {
    if (overlineEls.size >= 24) break;
    if (el.children.length > 0 || el.closest('nav, header a, footer')) continue;
    const cs = getComputedStyle(el);
    if (cs.textTransform === 'uppercase' && parseFloat(cs.fontSize) <= 14 && parseFloat(cs.letterSpacing) > 0) {
      overlineEls.add(el);
    }
  }
  for (const el of [...overlineEls].filter(visibleWithText).slice(0, 8)) {
    typeEntries.push(entryOf('overline', el));
  }

  // --- CTA samples ---
  const ctaEls = [
    ...document.querySelectorAll<HTMLElement>('button, [role="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i]'),
    ...[...document.querySelectorAll<HTMLElement>('a[href]')].slice(0, 60),
  ];
  const seenCta = new Set<HTMLElement>();
  const buttons = ctaEls
    .filter((el) => {
      if (seenCta.has(el)) return false;
      seenCta.add(el);
      const r = el.getBoundingClientRect();
      const text = (el.textContent ?? '').trim();
      return r.width > 20 && r.height > 14 && r.height < 120 && text.length > 0 && text.length < 40;
    })
    .slice(0, 40)
    .map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: cap((el.textContent ?? '').trim(), 40),
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        color: cs.color,
        borderRadius: cs.borderRadius,
        border: `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        paddingX: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
        height: Math.round(r.height),
      };
    });

  // --- color usage tally (area-weighted) ---
  const usage: Record<string, { bgArea: number; bgCount: number; textCount: number; onCta: number; svgCount: number }> = {};
  const gradientUsage: Record<string, number> = {};
  const rec0 = () => ({ bgArea: 0, bgCount: 0, textCount: 0, onCta: 0, svgCount: 0 });
  const all = [...document.querySelectorAll<HTMLElement>('*')].slice(0, 20_000);
  const walkDeadline = performance.now() + 1_500;
  for (const el of all) {
    if (performance.now() > walkDeadline) break;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    const isCta = el.tagName === 'BUTTON' || el.tagName === 'A';
    const bg = cs.backgroundColor;
    if (bg && !bg.includes('0, 0, 0, 0') && bg !== 'transparent') {
      const rec = (usage[bg] ??= rec0());
      rec.bgArea += Math.min(r.width * r.height, 1_500_000);
      rec.bgCount += 1;
      if (isCta) rec.onCta += 1;
    }
    if ((el.textContent ?? '').trim() && el.children.length === 0) {
      const rec = (usage[cs.color] ??= rec0());
      rec.textCount += 1;
      if (isCta) rec.onCta += 1;
    }
    // Painted gradients: what's actually on screen, area-weighted (CSS text
    // alone can't tell a hero atmosphere from an unused utility class).
    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage.includes('gradient')) {
      gradientUsage[bgImage] = (gradientUsage[bgImage] ?? 0) + Math.min(r.width * r.height, 3_000_000);
    }
    // Visible borders carry brand neutrals (dividers, input strokes).
    if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') {
      const bc = cs.borderTopColor;
      if (bc && !bc.includes('0, 0, 0, 0')) (usage[bc] ??= rec0()).bgCount += 1;
    }
  }
  // Illustration/icon fills: SVG artwork carries accents the DOM walk misses.
  for (const el of [...document.querySelectorAll<SVGElement>('svg *')].slice(0, 2_000)) {
    if (performance.now() > walkDeadline + 500) break;
    const cs = getComputedStyle(el);
    for (const val of [cs.fill, cs.stroke]) {
      if (val && val !== 'none' && !val.includes('url(') && !val.includes('0, 0, 0, 0')) {
        (usage[val] ??= rec0()).svgCount += 1;
      }
    }
  }

  // --- CSS text + custom props (same-origin sheets only) ---
  const styleSheets: Array<{ href: string | null; text: string }> = [];
  let cssBudget = 600_000;
  const customProps: Record<string, string> = {};
  for (const sheet of document.styleSheets) {
    try {
      let sheetText = '';
      for (const rule of sheet.cssRules) {
        if (cssBudget > 0) {
          sheetText += rule.cssText + '\n';
          cssBudget -= rule.cssText.length;
        }
        if (rule instanceof CSSStyleRule && /:root|^html|^body|\[data-theme|theme/i.test(rule.selectorText)) {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) customProps[prop] = rule.style.getPropertyValue(prop).trim();
          }
        }
      }
      if (sheetText) styleSheets.push({ href: sheet.href, text: sheetText });
    } catch {
      // cross-origin stylesheet — href collected below and fetched server-side
    }
  }
  const sheetHrefs = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    .map((l) => l.href)
    .filter(Boolean);
  const googleFontLinks = sheetHrefs.filter((h) => h.includes('fonts.googleapis.com'));

  // --- copy for the voice pass ---
  const headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => (h.textContent ?? '').trim()).filter(Boolean);
  const paras = [...document.querySelectorAll('p, li')]
    .map((p) => (p.textContent ?? '').trim())
    .filter((t) => t.length > 30 && t.length < 400)
    .slice(0, 40);
  const navLabels = [...document.querySelectorAll('header a, nav a')]
    .map((a) => (a.textContent ?? '').trim())
    .filter((t) => t && t.length < 30)
    .slice(0, 20);
  const copy = cap(
    `TITLE: ${document.title}\nNAV: ${navLabels.join(' | ')}\nHEADINGS:\n${headings.join('\n')}\nBODY:\n${paras.join('\n')}`,
    6000
  );

  // --- logo capture (header + footer) ---
  const logos: Array<{ location: 'header' | 'footer'; src: string | null; inlineSvg: string | null }> = [];
  for (const location of ['header', 'footer'] as const) {
    const scope = document.querySelector(location) ?? (location === 'header' ? document.querySelector('nav') : null);
    if (!scope) continue;
    const homeLinks = [...scope.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => {
      try {
        return new URL(a.href, location.toString()).pathname === '/';
      } catch {
        return false;
      }
    });
    const candidates = homeLinks.length ? homeLinks : [scope];
    for (const holder of candidates) {
      const img = [...holder.querySelectorAll<HTMLImageElement>('img')].find(
        (i) => i.getAttribute('aria-hidden') !== 'true' && i.getBoundingClientRect().width > 8
      );
      const svg = holder.querySelector('svg');
      if (img?.src) {
        logos.push({ location, src: img.src, inlineSvg: null });
        break;
      }
      if (svg && /<path|<circle|<rect|<polygon|<ellipse/i.test(svg.outerHTML) && svg.outerHTML.length < 20000) {
        logos.push({ location, src: null, inlineSvg: svg.outerHTML });
        break;
      }
    }
  }

  return {
    title: document.title,
    metaDescription:
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
      '',
    html: cap(document.documentElement.outerHTML, 400_000),
    styleSheets,
    customProps,
    typeEntries,
    buttons,
    colorUsage: usage,
    gradientUsage,
    copy,
    logos,
    sheetHrefs,
    googleFontLinks,
  };
}

async function settle(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25_000 });
  } catch {
    // Long-polling sites never reach networkidle — settle on DOM + a beat.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
  }
  await page.waitForTimeout(1_500);
}

export async function renderSite(domain: string): Promise<RenderResult> {
  const url = `https://${domain}/`;
  const browser = await getBrowser();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  });
  try {
    const page = await context.newPage();
    await settle(page, url);

    const light = await page.evaluate(inPageExtraction);
    const desktopShot = await page.screenshot({ type: 'jpeg', quality: 80 });

    // Dark pass: only re-capture the logos (sites swap assets via
    // prefers-color-scheme or <picture> sources).
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(800);
    const dark = await page.evaluate(inPageExtraction);
    await page.emulateMedia({ colorScheme: 'light' });

    // Cross-origin stylesheets: fetch server-side, keep per-sheet provenance so
    // relative @font-face src URLs can be resolved against the sheet's own URL.
    const fetchedSheets: Array<{ href: string; text: string }> = [];
    const inPageHrefs = new Set(light.styleSheets.map((s) => s.href).filter(Boolean));
    for (const href of light.sheetHrefs.filter((h) => !inPageHrefs.has(h)).slice(0, 8)) {
      try {
        const res = await fetch(href, { signal: AbortSignal.timeout(6000) });
        if (res.ok) fetchedSheets.push({ href, text: (await res.text()).slice(0, 300_000) });
      } catch {
        // best-effort
      }
    }
    const styleSheets = [...light.styleSheets, ...fetchedSheets];

    // Mobile screenshot in its own context (390×844, full page capped by fullPage).
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 2,
      colorScheme: 'light',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    let mobileShot: Buffer;
    try {
      const mobilePage = await mobileContext.newPage();
      await settle(mobilePage, url);
      mobileShot = await mobilePage.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
    } finally {
      await mobileContext.close();
    }

    return {
      finalUrl: page.url(),
      title: light.title,
      metaDescription: light.metaDescription,
      html: light.html,
      cssText: styleSheets.map((s) => s.text).join('\n'),
      styleSheets,
      customProps: light.customProps,
      typeEntries: light.typeEntries,
      buttons: light.buttons,
      colorUsage: light.colorUsage,
      gradientUsage: light.gradientUsage,
      copy: light.copy,
      logos: [
        ...light.logos.map((l) => ({ scheme: 'light' as const, ...l })),
        ...dark.logos.map((l) => ({ scheme: 'dark' as const, ...l })),
      ],
      googleFontLinks: light.googleFontLinks,
      mobileShot,
      desktopShot,
    };
  } finally {
    await context.close();
  }
}
