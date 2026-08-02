import { Vibrant } from 'node-vibrant/node';
import { css_to_tokens } from '@projectwallace/css-design-tokens';
import type { RenderResult, ButtonSample } from './render';
import type { ColorRole, CtaSpec, DeepColor, DeepGradient, LogoVariants, TypeScaleRow } from '../brand-kit-types';

/**
 * Deterministic post-processing of a rendered site: color roles via
 * area/usage heuristics (60-30-10), gradient mining, type-scale assembly from
 * computed styles, CTA classification by geometry, and logo variant
 * resolution. No LLM here — Claude only labels/writes on top of this.
 */

export interface DeterministicDraft {
  /** Role-classified fallback palette (~12) used when the Claude pass is unavailable. */
  colors: DeepColor[];
  /** Full candidate pool (≤24, with usage stats) for LLM curation. */
  colorCandidates: ColorCandidate[];
  gradients: DeepGradient[];
  typeScale: TypeScaleRow[];
  ctaSpecs: CtaSpec[];
  logos: LogoVariants;
  headingFamily: string;
  bodyFamily: string;
  fontWeights: Record<string, number[]>;
}

export interface ColorCandidate {
  hex: string;
  bgArea: number;
  bgCount: number;
  textCount: number;
  onCta: number;
  svgCount: number;
  sources: Array<'dom' | 'svg' | 'vibrant' | 'token' | 'customProp'>;
  luminance: number;
  saturation: number;
  /** Deterministic 60-30-10 guess; the LLM curation may regroup. */
  roleHint: ColorRole;
}

// ---------- color helpers ----------

function cssColorToHex(value: string): string | null {
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/.exec(value);
  if (rgb) {
    const alpha = rgb[4] !== undefined ? parseFloat(rgb[4]) : 1;
    if (alpha < 0.25) return null; // effectively invisible
    // Semi-transparent brand washes (cream section tints) matter: composite
    // over white (light-scheme render) instead of discarding.
    const to2 = (n: string) => Math.round(parseInt(n, 10) * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
    return `#${to2(rgb[1]!)}${to2(rgb[2]!)}${to2(rgb[3]!)}`;
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `#${h.toLowerCase()}`;
  }
  return null;
}

function rgbOf(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(hex: string): number {
  const { r, g, b } = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function saturation(hex: string): number {
  const { r, g, b } = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function near(a: string, b: string, tolerance = 16): boolean {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b) < tolerance;
}

/** Nearest candidate hex within tolerance — used to snap LLM-returned hexes to the pool. */
export function nearestHex(hex: string, pool: string[], tolerance = 16): string | null {
  const c = rgbOf(hex);
  let best: string | null = null;
  let bestDist = tolerance;
  for (const p of pool) {
    const q = rgbOf(p);
    const d = Math.abs(c.r - q.r) + Math.abs(c.g - q.g) + Math.abs(c.b - q.b);
    if (d < bestDist || (d === bestDist && best === null)) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

type Stats = { bgArea: number; bgCount: number; textCount: number; onCta: number; svgCount: number; sources: Set<ColorCandidate['sources'][number]> };

const prominence = (s: Stats) => s.onCta * 1_000_000 + s.bgArea + s.textCount * 5000 + s.svgCount * 3000;

/**
 * Candidate pool for LLM curation: every plausible brand color with usage
 * stats, deduped tightly (tol 16) and ranked by prominence. No role caps here
 * — curation (or the role-based fallback) decides what ships.
 */
export async function buildColorCandidates(render: RenderResult, mobileShot: Buffer): Promise<ColorCandidate[]> {
  const byHex = new Map<string, Stats>();
  const stat = (hex: string): Stats => {
    let rec = byHex.get(hex);
    if (!rec) {
      rec = { bgArea: 0, bgCount: 0, textCount: 0, onCta: 0, svgCount: 0, sources: new Set() };
      byHex.set(hex, rec);
    }
    return rec;
  };

  for (const [css, u] of Object.entries(render.colorUsage)) {
    const hex = cssColorToHex(css);
    if (!hex) continue;
    const rec = stat(hex);
    rec.bgArea += u.bgArea;
    rec.bgCount += u.bgCount;
    rec.textCount += u.textCount;
    rec.onCta += u.onCta;
    rec.svgCount += u.svgCount;
    rec.sources.add(u.svgCount > 0 && u.bgCount === 0 && u.textCount === 0 ? 'svg' : 'dom');
  }

  // Screenshot palette (area-true perception), design tokens, custom props.
  try {
    const palette = await Vibrant.from(mobileShot).getPalette();
    for (const swatch of Object.values(palette)) {
      if (!swatch) continue;
      const hex = swatch.hex.toLowerCase();
      const rec = stat(hex);
      rec.bgArea = Math.max(rec.bgArea, swatch.population * 400);
      rec.sources.add('vibrant');
    }
  } catch {
    // vibrant is supplemental
  }
  try {
    const tokens = css_to_tokens(render.cssText) as unknown as Record<string, Record<string, { $value?: unknown }>>;
    for (const token of Object.values(tokens?.color ?? {})) {
      const hex = typeof token?.$value === 'string' ? cssColorToHex(token.$value) : null;
      if (hex) stat(hex).sources.add('token');
    }
  } catch {
    // wallace is supplemental
  }
  for (const value of Object.values(render.customProps)) {
    const hex = cssColorToHex(value.trim());
    if (hex) stat(hex).sources.add('customProp');
  }

  // Tight dedupe: merge near-twins into the more prominent survivor. Curation
  // is the dedupe of last resort, so keep this conservative (tol 16).
  const ordered = [...byHex.entries()].sort((a, b) => prominence(b[1]) - prominence(a[1]));
  const kept: Array<[string, Stats]> = [];
  for (const [hex, s] of ordered) {
    const twin = kept.find(([k]) => near(k, hex, 16));
    if (twin) {
      twin[1].bgArea += s.bgArea;
      twin[1].bgCount += s.bgCount;
      twin[1].textCount += s.textCount;
      twin[1].onCta += s.onCta;
      twin[1].svgCount += s.svgCount;
      for (const src of s.sources) twin[1].sources.add(src);
    } else {
      kept.push([hex, s]);
    }
  }
  if (kept.length === 0) return [];

  const maxBgArea = Math.max(...kept.map(([, s]) => s.bgArea), 1);
  const canvasHex =
    kept.filter(([hex]) => luminance(hex) > 0.55).sort((a, b) => b[1].bgArea - a[1].bgArea)[0]?.[0] ?? kept[0]![0];
  const inkHex = kept
    .filter(([hex]) => !near(hex, canvasHex, 36) && luminance(hex) < 0.45)
    .sort((a, b) => b[1].textCount - a[1].textCount)[0]?.[0];

  return kept.slice(0, 24).map(([hex, s]) => {
    const lum = luminance(hex);
    const sat = saturation(hex);
    let roleHint: ColorRole;
    if (hex === canvasHex || (lum > 0.55 && s.bgArea > 0.15 * maxBgArea && sat < 0.18)) roleHint = 'canvas';
    else if (hex === inkHex) roleHint = 'ink';
    else if (sat > 0.18) roleHint = 'accent';
    else roleHint = 'neutral';
    return {
      hex,
      bgArea: Math.round(s.bgArea),
      bgCount: s.bgCount,
      textCount: s.textCount,
      onCta: s.onCta,
      svgCount: s.svgCount,
      sources: [...s.sources],
      luminance: Math.round(lum * 100) / 100,
      saturation: Math.round(sat * 100) / 100,
      roleHint,
    };
  });
}

/**
 * Role-based fallback palette (~12) when the Claude pass is unavailable.
 * Coarser dedupe (tol 24) so no-LLM kits don't ship five near-identical greys.
 */
export function candidatesToRoleColors(candidates: ColorCandidate[]): DeepColor[] {
  if (candidates.length === 0) return [];
  const canvas = candidates.find((c) => c.roleHint === 'canvas') ?? candidates[0]!;
  const ink = candidates.find((c) => c.roleHint === 'ink');
  const pickDistinct = (pool: ColorCandidate[], max: number, taken: string[]): ColorCandidate[] => {
    const out: ColorCandidate[] = [];
    for (const c of pool) {
      if (out.length >= max) break;
      if ([...taken, ...out.map((o) => o.hex)].some((h) => near(h, c.hex, 24))) continue;
      out.push(c);
    }
    return out;
  };
  const taken = [canvas.hex, ...(ink ? [ink.hex] : [])];
  const accents = pickDistinct(candidates.filter((c) => c.roleHint === 'accent'), 6, taken);
  const neutrals = pickDistinct(
    candidates.filter((c) => c.roleHint === 'neutral' || (c.roleHint === 'canvas' && c !== canvas)),
    4,
    [...taken, ...accents.map((a) => a.hex)]
  );
  return [
    { hex: canvas.hex, role: 'canvas' as const },
    ...(ink ? [{ hex: ink.hex, role: 'ink' as const }] : []),
    ...accents.map((c): DeepColor => ({ hex: c.hex, role: 'accent' })),
    ...neutrals.map((c): DeepColor => ({ hex: c.hex, role: 'neutral' })),
  ];
}

// ---------- gradients ----------

/** Ordered hex stops parsed out of a gradient's CSS value. */
export function parseGradientStops(css: string): string[] {
  const stops: string[] = [];
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
    const hex = cssColorToHex(m[0]);
    if (hex) stops.push(hex);
  }
  return stops;
}

export function extractGradients(render: RenderResult): DeepGradient[] {
  // Painted gradients (area-weighted, from the DOM walk) outrank CSS-text-only
  // matches: a hero atmosphere beats an unused utility class.
  const found = new Map<string, { area: number; count: number }>();
  const add = (raw: string, area: number) => {
    for (const m of raw.matchAll(/(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/g)) {
      const css = m[0].replace(/\s+/g, ' ').trim();
      if (css.length > 400) continue;
      const rec = found.get(css) ?? { area: 0, count: 0 };
      rec.area += area;
      rec.count += 1;
      found.set(css, rec);
    }
  };
  for (const [css, area] of Object.entries(render.gradientUsage)) add(css, area);
  add([render.cssText, ...render.buttons.map((b) => b.backgroundImage), ...Object.values(render.customProps)].join('\n'), 0);

  // Identity test: chromatic stop OR a low-chroma atmosphere painted across a
  // large surface (Hightouch's sky-to-meadow). Grey-only small scrims are noise.
  const isIdentity = (stops: string[], area: number): boolean => {
    if (stops.length < 2) return false;
    const chromatic = stops.some((h) => saturation(h) > 0.08 && luminance(h) > 0.08 && luminance(h) < 0.97);
    return chromatic || area > 250_000;
  };

  return [...found.entries()]
    .map(([css, rec]) => ({ css, stops: parseGradientStops(css), ...rec }))
    .filter((g) => isIdentity(g.stops, g.area))
    .sort((a, b) => b.area - a.area || b.count - a.count)
    .slice(0, 6)
    .map(({ css, stops }) => ({ css, stops }));
}

// ---------- typography ----------

const SCALE_LABELS: Record<string, string> = { h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', p: 'Body', body: 'Body', small: 'Overline', overline: 'Overline' };
const LABEL_ORDER = ['H1', 'H2', 'H3', 'H4', 'Body', 'Overline'];

function firstFamily(fontFamily: string): string {
  return (fontFamily.split(',')[0] ?? '').replace(/['"]/g, '').trim();
}

type TypeEntry = RenderResult['typeEntries'][number];

/** Real copy only — hidden-embed junk (GTM noscript iframes, raw URLs) is not a specimen. */
function cleanExampleText(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  if (/<\/?[a-z][^>]*>|https?:\/\/|^\{|^\[/i.test(t)) return undefined;
  return t.slice(0, 80);
}

function rowFromEntry(label: string, e: TypeEntry): TypeScaleRow {
  return {
    label,
    px: Math.round(parseFloat(e.fontSize)) || 16,
    weight: parseInt(e.fontWeight, 10) || 400,
    lineHeight: e.lineHeight,
    family: firstFamily(e.fontFamily),
    letterSpacing: e.letterSpacing === 'normal' ? undefined : e.letterSpacing,
    textTransform: e.textTransform === 'none' ? undefined : e.textTransform,
    exampleText: cleanExampleText(e.text),
  };
}

/**
 * Pick each level's canonical entry: modal rounded px across all sampled
 * instances (a lone footer h2 can't outvote the marquee sections), ties broken
 * by on-screen area. The representative entry (largest area at the modal size)
 * supplies weight/leading/family and the real-copy exampleText.
 */
function pickModal(entries: TypeEntry[]): TypeEntry | null {
  if (entries.length === 0) return null;
  const byPx = new Map<number, TypeEntry[]>();
  for (const e of entries) {
    const px = Math.round(parseFloat(e.fontSize)) || 16;
    (byPx.get(px) ?? byPx.set(px, []).get(px)!).push(e);
  }
  const [, group] = [...byPx.entries()].sort(
    (a, b) => b[1].length - a[1].length || Math.max(...b[1].map((e) => e.area ?? 0)) - Math.max(...a[1].map((e) => e.area ?? 0))
  )[0]!;
  return group.sort((a, b) => (b.area ?? 0) - (a.area ??  0))[0]!;
}

export function buildTypeScale(render: RenderResult): { typeScale: TypeScaleRow[]; headingFamily: string; bodyFamily: string } {
  const pools = new Map<string, TypeEntry[]>();
  for (const e of render.typeEntries) {
    const label = SCALE_LABELS[e.selector];
    if (!label) continue;
    (pools.get(label) ?? pools.set(label, []).get(label)!).push(e);
  }

  const rows: TypeScaleRow[] = [];
  for (const label of LABEL_ORDER) {
    const pool = pools.get(label);
    const chosen = pool ? pickModal(pool) : null;
    if (chosen) rows.push(rowFromEntry(label, chosen));
  }

  // Monotonicity repair: H1 ≥ H2 ≥ H3 ≥ H4 > Body. A violating level was
  // mis-sampled (e.g. a card h2 beating the marquee 33px h2) — re-pick the
  // largest-area entry that fits under the level above.
  const headingRows = rows.filter((r) => /^H\d$/.test(r.label));
  for (let i = 1; i < headingRows.length; i += 1) {
    const prev = headingRows[i - 1]!;
    const row = headingRows[i]!;
    if (row.px > prev.px) {
      const pool = (pools.get(row.label) ?? []).filter((e) => (Math.round(parseFloat(e.fontSize)) || 16) <= prev.px);
      const repick = pickModal(pool);
      if (repick) {
        const fixed = rowFromEntry(row.label, repick);
        rows[rows.indexOf(row)] = fixed;
        headingRows[i] = fixed;
      }
    }
  }

  const h1 = pools.get('H1') ? pickModal(pools.get('H1')!) : null;
  const heading = h1 ?? (pools.get('H2') ? pickModal(pools.get('H2')!) : null);
  const body = render.typeEntries.find((e) => e.selector === 'p') ?? render.typeEntries.find((e) => e.selector === 'body');
  return {
    typeScale: rows,
    headingFamily: heading ? firstFamily(heading.fontFamily) : 'Poppins',
    bodyFamily: body ? firstFamily(body.fontFamily) : 'Inter',
  };
}

export function extractFontWeights(render: RenderResult): Record<string, number[]> {
  const weights: Record<string, Set<number>> = {};
  for (const m of render.cssText.matchAll(/@font-face\s*{([^}]+)}/g)) {
    const block = m[1]!;
    const family = /font-family:\s*['"]?([^;'"]+)/.exec(block)?.[1]?.trim();
    const weight = parseInt(/font-weight:\s*(\d+)/.exec(block)?.[1] ?? '400', 10);
    if (family) (weights[family] ??= new Set()).add(weight);
  }
  return Object.fromEntries(Object.entries(weights).map(([f, w]) => [f, [...w].sort((a, b) => a - b)]));
}

// ---------- CTAs ----------

function isTransparent(bg: string): boolean {
  return bg === 'transparent' || bg.includes('0, 0, 0, 0');
}

export function classifyCtas(allButtons: ButtonSample[]): CtaSpec[] {
  // Cookie banners and utility chrome aren't brand CTAs.
  const buttons = allButtons.filter(
    (b) => !/cookie|consent|accept all|reject|dismiss|got it|preferences|copy \.|sign in|log ?in/i.test(b.text)
  );
  const specs: CtaSpec[] = [];
  const radiusOf = (b: ButtonSample) => parseFloat(b.borderRadius) || 0;

  // Prominence: a real primary CTA is dark or saturated, not canvas-colored.
  const prominence = (b: ButtonSample): number => {
    const hex = cssColorToHex(b.backgroundColor);
    if (!hex) return 0;
    return saturation(hex) + (1 - luminance(hex)) + radiusOf(b) / 100;
  };
  const primary = buttons
    .filter((b) => !isTransparent(b.backgroundColor) && cssColorToHex(b.backgroundColor) !== null)
    .filter((b) => {
      const hex = cssColorToHex(b.backgroundColor);
      return hex ? Math.abs(luminance(hex) - (cssColorToHex(b.color) ? luminance(cssColorToHex(b.color)!) : 1)) > 0.3 : false;
    })
    .sort((a, b) => prominence(b) - prominence(a))[0];
  if (primary) {
    specs.push({
      kind: 'primary',
      label: primary.text,
      background: primary.backgroundImage !== 'none' ? primary.backgroundImage : primary.backgroundColor,
      color: primary.color,
      borderRadius: primary.borderRadius,
      border: 'none',
      fontSize: primary.fontSize,
      fontWeight: primary.fontWeight,
    });
  }

  const secondary = buttons.find(
    (b) => isTransparent(b.backgroundColor) === false
      ? b !== primary && !/none/.test(b.border) && !b.border.startsWith('0px')
      : !/none/.test(b.border) && !b.border.startsWith('0px')
  );
  if (secondary && secondary !== primary) {
    specs.push({
      kind: 'secondary',
      label: secondary.text,
      background: isTransparent(secondary.backgroundColor) ? 'transparent' : secondary.backgroundColor,
      color: secondary.color,
      borderRadius: secondary.borderRadius,
      border: secondary.border,
      fontSize: secondary.fontSize,
      fontWeight: secondary.fontWeight,
    });
  }

  const link = buttons.find(
    (b) => b.tag === 'a' && isTransparent(b.backgroundColor) && (b.border.startsWith('0px') || /none/.test(b.border))
  );
  if (link) {
    specs.push({
      kind: 'link',
      label: link.text,
      background: 'transparent',
      color: link.color,
      borderRadius: '0px',
      border: 'none',
      fontSize: link.fontSize,
      fontWeight: link.fontWeight,
    });
  }
  return specs;
}

// ---------- logos ----------

function svgToDataUri(svg: string): string {
  const withNs = /xmlns=/.test(svg) ? svg : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(withNs);
}

/** Recolor a captured SVG's dark fills to white to synthesize the inverse variant. */
function synthesizeInverse(svg: string): string | null {
  const fills = [...svg.matchAll(/fill=["'](#[0-9a-fA-F]{3,6})["']/g)].map((m) => m[1]!.toLowerCase());
  const distinct = [...new Set(fills)];
  if (distinct.length > 2) return null; // multi-color mark — recoloring would butcher it
  let out = svg;
  for (const fill of distinct) {
    const hex = cssColorToHex(fill);
    if (hex && luminance(hex) < 0.5) out = out.split(fill).join('#ffffff');
  }
  if (out === svg) {
    // No explicit fills (inherits currentColor) — force white.
    out = out.replace(/<svg\b/i, '<svg fill="#ffffff"');
  }
  return out;
}

export function resolveLogos(render: RenderResult): LogoVariants {
  const pick = (scheme: 'light' | 'dark'): string | null => {
    const captures = render.logos.filter((l) => l.scheme === scheme);
    const header = captures.find((l) => l.location === 'header') ?? captures[0];
    if (!header) return null;
    if (header.inlineSvg) return svgToDataUri(header.inlineSvg);
    return header.src;
  };

  let light = pick('light');
  let dark = pick('dark');
  if (dark === light) dark = null; // site doesn't swap — treat as unknown

  // Synthesize the missing dark-surface variant from a simple light-surface SVG.
  if (light && !dark && light.startsWith('data:image/svg+xml')) {
    const svg = decodeURIComponent(light.split(',', 2)[1] ?? '');
    const inverse = synthesizeInverse(svg);
    if (inverse) dark = svgToDataUri(inverse);
  }
  return { light, dark };
}

// ---------- assembly ----------

export async function buildDraft(render: RenderResult): Promise<DeterministicDraft> {
  const { typeScale, headingFamily, bodyFamily } = buildTypeScale(render);
  const colorCandidates = await buildColorCandidates(render, render.mobileShot);
  return {
    colors: candidatesToRoleColors(colorCandidates),
    colorCandidates,
    gradients: extractGradients(render),
    typeScale,
    ctaSpecs: classifyCtas(render.buttons),
    logos: resolveLogos(render),
    headingFamily,
    bodyFamily,
    fontWeights: extractFontWeights(render),
  };
}
